/**
 * バトルログ: 1戦ごとに全ターンの局面・行動・CPUの判断根拠・結果を記録し、
 * JSON としてダウンロードできるようにする。解析しやすいよう、
 * 各ターンは「行動前の局面 → 両者の行動 → CPUの判断 → 結果」をフラットに持つ。
 */

export const LOG_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'battleCharge_battleLogs';
const MAX_STORED = 100;

const STAT_KEYS = ['name', 'id', 'hp', 'atk', 'winE', 'chgE', 'chgC', 'grdC', 'atkC', 'startE',
    'tempAtk', 'tempGrdC', 'tempChgE', 'tempChgC', 'tempDmgReduce', 'skillCostBonus', 'skillEffectBonus'];

let current = null;

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function pickStats(c) {
    if (!c) return null;
    const out = {};
    STAT_KEYS.forEach(k => { if (c[k] !== undefined) out[k] = c[k]; });
    if (c.traits) out.traits = clone(c.traits);
    if (c.passive) out.passive = clone(c.passive);
    return out;
}

function pickSkill(s) {
    if (!s) return null;
    return { id: s.id, name: s.name, cost: s.cost, category: s.category, rarity: s.rarity, effectValues: clone(s.effectValues) };
}

/** 局面のスナップショット（行動前・行動後で共通の形）。 */
export function snapshotState(gs) {
    return {
        pHP: gs.pHP, pEnergy: gs.pEnergy,
        cHP: gs.cHP, cEnergy: gs.cEnergy,
        pEffects: clone(gs.player?.effects || []),
        cEffects: clone(gs.cpu?.effects || []),
        pTemp: {
            atk: gs.player?.tempAtk || 0, grdC: gs.player?.tempGrdC || 0, chgE: gs.player?.tempChgE || 0,
            chgC: gs.player?.tempChgC || 0, dmgReduce: gs.player?.tempDmgReduce || 0
        },
        cTemp: {
            atk: gs.cpu?.tempAtk || 0, grdC: gs.cpu?.tempGrdC || 0, chgE: gs.cpu?.tempChgE || 0,
            chgC: gs.cpu?.tempChgC || 0, dmgReduce: gs.cpu?.tempDmgReduce || 0
        }
    };
}

function makeId() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${Math.random().toString(36).slice(2, 6)}`;
}

/** バトル開始時に呼ぶ。 */
export function startBattleLog(gs) {
    current = {
        schemaVersion: LOG_SCHEMA_VERSION,
        id: makeId(),
        startedAt: new Date().toISOString(),
        endedAt: null,
        mode: gs.gameMode,
        aiLevel: gs.aiLevel,
        floor: gs.gameMode === 'tower' ? gs.floor : null,
        towerDifficulty: gs.gameMode === 'tower' ? (gs.towerDifficulty || null) : null,
        isBoss: !!gs.currentBattle?.isBoss,
        battleMod: gs.currentBattle?.mod || null,
        player: pickStats(gs.player),
        cpu: pickStats(gs.cpu),
        playerSkill: pickSkill(gs.playerSkill),
        initialState: snapshotState(gs),
        turns: [],
        result: null,
    };
    return current;
}

/** ターン解決の直前に呼ぶ。返り値のオブジェクトに結果を追記していく。 */
export function beginTurnLog(gs, playerMove, cpuMove, cpuDecision) {
    if (!current) return null;
    const entry = {
        turn: gs.turn,
        before: snapshotState(gs),
        playerMove,
        cpuMove,
        playerSkillUsed: playerMove === 'SKILL' ? pickSkill(gs.playerSkill) : null,
        cpuDecision: cpuDecision ? clone(cpuDecision) : null,
        steps: [],
        after: null,
        revived: false,
    };
    current.turns.push(entry);
    return entry;
}

/** calculateTurnResult 1回分の結果（ダブルアクション時は複数回）を追記。 */
export function addTurnStep(entry, cpuMoveUsed, result) {
    if (!entry) return;
    entry.steps.push({
        cpuMove: cpuMoveUsed,
        pDmgTaken: result.pDmgTaken, cDmgTaken: result.cDmgTaken,
        pHP: result.pHP, cHP: result.cHP, pEnergy: result.pEnergy, cEnergy: result.cEnergy,
    });
}

/** 効果のターン経過まで終わった後の局面を記録。 */
export function finishTurnLog(entry, gs) {
    if (!entry) return;
    entry.after = snapshotState(gs);
}

export function markRevived(entry, livesLeft) {
    if (!entry) return;
    entry.revived = true;
    entry.livesLeft = livesLeft;
}

/** 試合結果を確定し、保存する。 */
export function endBattleLog(gs, res, reason) {
    if (!current) return null;
    current.endedAt = new Date().toISOString();
    current.result = { outcome: res, reason, turns: current.turns.length, final: snapshotState(gs) };
    current.summary = summarizeBattle(current);
    const done = current;
    saveLog(done);
    current = null;
    return done;
}

export function getCurrentLog() { return current; }

/** MASTER 戦の1ターンで、プレイヤーの手を均衡の観点から評価する。 */
export function evaluatePlayerMove(t) {
    const d = t.cpuDecision;
    if (!d || d.type !== 'NASH' || !d.matrix) return null;
    const j = d.matrix.cols.indexOf(t.playerMove);
    if (j < 0) return null;
    const vals = d.playerMoveValues || {};
    const best = Math.min(...Object.values(vals));
    const column = d.matrix.values.map(row => row[j]);
    return {
        turn: t.turn,
        move: t.playerMove,
        lossVsEquilibrium: (vals[t.playerMove] ?? best) - best,
        readPenalty: Math.max(...column) - d.value,
        equilibriumProb: d.opponentEquilibrium ? (d.opponentEquilibrium[t.playerMove] ?? 0) : null,
    };
}

/** 解析用の集計（1戦分）。 */
export function summarizeBattle(log) {
    const count = moves => moves.reduce((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});
    const pMoves = log.turns.map(t => t.playerMove);
    const cMoves = log.turns.map(t => t.cpuMove);
    const pairs = {};
    log.turns.forEach(t => { const k = `${t.playerMove}/${t.cpuMove}`; pairs[k] = (pairs[k] || 0) + 1; });
    const dmg = log.turns.reduce((acc, t) => {
        t.steps.forEach(s => { acc.toPlayer += s.pDmgTaken || 0; acc.toCpu += s.cDmgTaken || 0; });
        return acc;
    }, { toPlayer: 0, toCpu: 0 });
    // MASTER の場合: CPU が自分の均衡戦略でどれだけ珍しい手を引いたか / プレイヤーの手が均衡から見て損だった量
    let nash = null;
    const nashTurns = log.turns.filter(t => t.cpuDecision?.type === 'NASH');
    if (nashTurns.length) {
        nash = {
            valueTrajectory: nashTurns.map(t => ({ turn: t.turn, value: t.cpuDecision.value })),
            // 各ターンのプレイヤーの手の評価:
            //  - lossVsEquilibrium: CPU が均衡戦略のとき、最善の手と比べて失った期待値（均衡の台に入る手は0）
            //  - readPenalty: その手を CPU に完全に読まれた場合に失う期待値（読まれやすさ・危険度）
            //  - equilibriumProb: 均衡でその手を選ぶべき確率
            playerMoves: nashTurns.map(t => evaluatePlayerMove(t)).filter(Boolean),
        };
    }
    return {
        playerMoves: count(pMoves),
        cpuMoves: count(cMoves),
        movePairs: pairs,
        damage: dmg,
        nash,
    };
}

// ---------- 保存とダウンロード ----------

function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function loadLogs() {
    const s = storage();
    if (!s) return [];
    try { return JSON.parse(s.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveLog(log) {
    const s = storage();
    if (!s) return;
    try {
        const logs = loadLogs();
        logs.push(log);
        while (logs.length > MAX_STORED) logs.shift();
        s.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
        // 容量超過などは無視（ゲーム進行を止めない）
    }
}

export function clearLogs() {
    const s = storage();
    if (s) try { s.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function getLastLog() {
    const logs = loadLogs();
    return logs.length ? logs[logs.length - 1] : null;
}

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadLastLog() {
    const log = getLastLog();
    if (!log) return false;
    downloadJson(log, `battle-log-${log.id}.json`);
    return true;
}

export function downloadAllLogs() {
    const logs = loadLogs();
    if (!logs.length) return false;
    downloadJson({ schemaVersion: LOG_SCHEMA_VERSION, exportedAt: new Date().toISOString(), battles: logs },
        `battle-logs-all-${makeId()}.json`);
    return true;
}
