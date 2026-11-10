#!/usr/bin/env node
/**
 * バトルログ(JSON)の解析ツール。
 *
 * 使い方:
 *   node scripts/analyze-logs.mjs battle-logs-all-*.json [battle-log-*.json ...]
 *   node scripts/analyze-logs.mjs --json logs.json   # 集計結果を JSON で出力
 *
 * ゲーム内の「Battle Logs (JSON)」「Download Battle Log (JSON)」で保存したファイルを読み込み、
 * - 勝率（モード・AIレベル別）
 * - プレイヤーの手の傾向（全体 / 局面別 / 直前の手からの遷移）
 * - MASTER(ナッシュ均衡AI)戦での、プレイヤーの手の「均衡から見た損失」
 * を集計する。局面別の傾向は、AI の搾取モードの調整材料になる。
 */
import { readFileSync } from 'node:fs';
import { evaluatePlayerMove } from '../js/battleLog.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const files = args.filter(a => a !== '--json');
if (!files.length) {
    console.error('usage: node scripts/analyze-logs.mjs [--json] <log.json> [...]');
    process.exit(1);
}

/** 単体ログ・全件エクスポートのどちらでも battles 配列に正規化する。 */
export function loadBattles(paths) {
    const battles = [];
    for (const p of paths) {
        const data = JSON.parse(readFileSync(p, 'utf8'));
        if (Array.isArray(data.battles)) battles.push(...data.battles);
        else if (Array.isArray(data)) battles.push(...data);
        else if (data.turns) battles.push(data);
    }
    // 同じバトルが複数ファイルに含まれていても1回だけ数える
    const seen = new Set();
    return battles.filter(b => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

const inc = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const pct = (obj) => {
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = `${v} (${(100 * v / total).toFixed(1)}%)`;
    return out;
};

/** 局面をざっくり分類するラベル（プレイヤー視点）。 */
function situation(t, battle) {
    const b = t.before;
    const p = battle.player || {}, c = battle.cpu || {};
    const pAtk = (p.atk || 0) + (b.pTemp?.atk || 0);
    const cAtk = (c.atk || 0) + (b.cTemp?.atk || 0);
    const cpuCanAttack = b.cEnergy >= (c.atkC ?? 1);
    const playerCanAttack = b.pEnergy >= (p.atkC ?? 1);
    const tags = [];
    tags.push(cpuCanAttack ? 'CPU攻撃可' : 'CPU攻撃不可');
    if (cpuCanAttack && b.pHP <= cAtk) tags.push('自分が一撃圏内');
    if (playerCanAttack && b.cHP <= pAtk) tags.push('相手が一撃圏内');
    const pChg = (p.chgE || 0) + (b.pTemp?.chgE || 0);
    const cChg = (c.chgE || 0) + (b.cTemp?.chgE || 0);
    if (b.pEnergy + pChg >= (p.winE || Infinity)) tags.push('自分があと1チャージで勝利');
    if (b.cEnergy + cChg >= (c.winE || Infinity)) tags.push('相手があと1チャージで勝利');
    return tags;
}

export function analyze(battles) {
    const report = {
        battles: battles.length,
        turns: 0,
        outcomes: {},
        outcomesByLevel: {},
        playerMoves: {},
        playerMovesBySituation: {},
        playerTransitions: {},
        movePairs: {},
        master: { turns: 0, totalLoss: 0, totalReadPenalty: 0, byMove: {}, worstTurns: [] },
    };
    for (const b of battles) {
        inc(report.outcomes, b.result?.outcome || 'UNFINISHED');
        const lvKey = `${b.mode}/${b.aiLevel}`;
        report.outcomesByLevel[lvKey] = report.outcomesByLevel[lvKey] || {};
        inc(report.outcomesByLevel[lvKey], b.result?.outcome || 'UNFINISHED');
        let prev = null;
        for (const t of b.turns || []) {
            report.turns++;
            inc(report.playerMoves, t.playerMove);
            inc(report.movePairs, `${t.playerMove} vs ${t.cpuMove}`);
            for (const tag of situation(t, b)) {
                report.playerMovesBySituation[tag] = report.playerMovesBySituation[tag] || {};
                inc(report.playerMovesBySituation[tag], t.playerMove);
            }
            if (prev) {
                report.playerTransitions[prev] = report.playerTransitions[prev] || {};
                inc(report.playerTransitions[prev], t.playerMove);
            }
            prev = t.playerMove;
            const ev = evaluatePlayerMove(t);
            if (ev) {
                const m = report.master;
                m.turns++;
                m.totalLoss += ev.lossVsEquilibrium;
                m.totalReadPenalty += ev.readPenalty;
                m.byMove[ev.move] = m.byMove[ev.move] || { n: 0, loss: 0, readPenalty: 0, eqProb: 0 };
                m.byMove[ev.move].n++;
                m.byMove[ev.move].loss += ev.lossVsEquilibrium;
                m.byMove[ev.move].readPenalty += ev.readPenalty;
                m.byMove[ev.move].eqProb += ev.equilibriumProb || 0;
                m.worstTurns.push({ battle: b.id, turn: t.turn, move: ev.move, readPenalty: +ev.readPenalty.toFixed(4), loss: +ev.lossVsEquilibrium.toFixed(4), eqProb: +(ev.equilibriumProb ?? 0).toFixed(3), state: t.before && { pHP: t.before.pHP, pE: t.before.pEnergy, cHP: t.before.cHP, cE: t.before.cEnergy } });
            }
        }
    }
    report.master.worstTurns.sort((a, b) => (b.loss - a.loss) || (b.readPenalty - a.readPenalty));
    report.master.worstTurns = report.master.worstTurns.slice(0, 10);
    report.master.avgLoss = report.master.turns ? report.master.totalLoss / report.master.turns : null;
    report.master.avgReadPenalty = report.master.turns ? report.master.totalReadPenalty / report.master.turns : null;
    return report;
}

function printReport(r) {
    const line = s => console.log(s);
    line(`# バトルログ解析  (${r.battles}戦 / ${r.turns}ターン)\n`);
    line('## 勝敗（プレイヤー視点）');
    line(JSON.stringify(pct(r.outcomes)));
    for (const [k, v] of Object.entries(r.outcomesByLevel)) line(`  ${k}: ${JSON.stringify(pct(v))}`);
    line('\n## プレイヤーの手（全体）');
    line(JSON.stringify(pct(r.playerMoves)));
    line('\n## プレイヤーの手（局面別）');
    for (const [k, v] of Object.entries(r.playerMovesBySituation)) line(`  ${k}: ${JSON.stringify(pct(v))}`);
    line('\n## 直前の手 → 次の手');
    for (const [k, v] of Object.entries(r.playerTransitions)) line(`  ${k} → ${JSON.stringify(pct(v))}`);
    line('\n## 手の組み合わせ');
    line(JSON.stringify(pct(r.movePairs)));
    if (r.master.turns) {
        line('\n## MASTER 戦: 均衡から見たプレイヤーの手');
        line(`  平均損失: ${r.master.avgLoss.toFixed(4)}（均衡で選ぶべきでない手を選んだ量。0 = 常に均衡の範囲内）`);
        line(`  平均の読まれリスク: ${r.master.avgReadPenalty.toFixed(4)}（手を完全に読まれたら失う期待値）`);
        for (const [m, v] of Object.entries(r.master.byMove)) {
            line(`  ${m}: ${v.n}回, 平均損失 ${(v.loss / v.n).toFixed(4)}, 読まれリスク ${(v.readPenalty / v.n).toFixed(4)}, 均衡での平均確率 ${(100 * v.eqProb / v.n).toFixed(1)}%`);
        }
        line('  要注意ターン（損失・読まれリスク順）:');
        r.master.worstTurns.forEach(w => line(`    ${w.battle} T${w.turn} ${w.move} loss=${w.loss} read=${w.readPenalty} eq=${w.eqProb} ${JSON.stringify(w.state)}`));
    }
}

const report = analyze(loadBattles(files));
if (asJson) console.log(JSON.stringify(report, null, 2));
else printReport(report);
