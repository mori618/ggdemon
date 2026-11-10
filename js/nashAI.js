/**
 * 最強CPU (MASTER) 用のゲーム理論AI。
 *
 * 基本3アクション (CHARGE / ATTACK / GUARD) の同時手番ゲームを
 * 確率ゲームとして扱い、Shapley の値反復でナッシュ均衡を求める。
 *
 * - 状態: (cpuHP, cpuE, playerHP, playerE)
 * - 各状態で 3x3 以下のゼロ和行列ゲームを解く（Shapley–Snow のサポート列挙）
 * - 値: CPU勝ち=+1 / CPU負け=-1 / 引き分け=0
 * - ターン解決は logic.js の calculateTurnResult と同じ順序（コスト→チャージ→ダメージ→軽減）
 * - 勝敗判定は game.js の判定順（両者HP0=引分 → 敵HP0 → 自HP0 → プレイヤーE → CPU E）
 *
 * 均衡戦略は「相手が確率を知っていても期待値で突けない」ため、人間の読みに強い。
 * スキル・持続効果は、現在有効な補正値を固定値として扱う近似で対応する。
 */

export const ACTIONS = ['CHARGE', 'ATTACK', 'GUARD'];
const EPS = 1e-9;

// ---------- 小さな行列ゲームのソルバー ----------

/** n元連立一次方程式 (n<=4) をガウスの消去法で解く。特異なら null。 */
function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        if (Math.abs(M[p][c]) < 1e-12) return null;
        [M[c], M[p]] = [M[p], M[c]];
        for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const f = M[r][c] / M[c][c];
            if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

function subsets(n) {
    const out = [];
    for (let mask = 1; mask < (1 << n); mask++) {
        const s = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) s.push(i);
        out.push(s);
    }
    return out.sort((a, b) => a.length - b.length);
}
const SUBSETS = [null, subsets(1), subsets(2), subsets(3)];

/**
 * ゼロ和行列ゲーム M (行=最大化側) の均衡を求める。
 * @returns {{value:number, row:number[], col:number[]}}
 */
export function solveMatrixGame(M) {
    const m = M.length, n = M[0].length;
    // 高速パス: 純粋戦略の鞍点（行の最小値の最大 = 列の最大値の最小）
    let maximin = -Infinity, bi = 0;
    for (let i = 0; i < m; i++) {
        let w = Infinity;
        for (let j = 0; j < n; j++) if (M[i][j] < w) w = M[i][j];
        if (w > maximin) { maximin = w; bi = i; }
    }
    let minimax = Infinity, bj = 0;
    for (let j = 0; j < n; j++) {
        let w = -Infinity;
        for (let i = 0; i < m; i++) if (M[i][j] > w) w = M[i][j];
        if (w < minimax) { minimax = w; bj = j; }
    }
    if (minimax - maximin < 1e-12) {
        const row = new Array(m).fill(0), col = new Array(n).fill(0);
        row[bi] = 1; col[bj] = 1;
        return { value: maximin, row, col };
    }
    // 高速パス: 鞍点のない 2x2 は閉じた式で完全混合
    if (m === 2 && n === 2) {
        const [[a, b], [c, d]] = M;
        const den = a - b - c + d;
        if (Math.abs(den) > 1e-12) {
            const p = (d - c) / den, q = (d - b) / den;
            return { value: (a * d - b * c) / den, row: [p, 1 - p], col: [q, 1 - q] };
        }
    }
    for (const S of SUBSETS[m]) {
        for (const T of SUBSETS[n]) {
            if (S.length !== T.length) continue;
            const k = S.length;
            // 行戦略 x (S上): 各 j∈T で Σ x_i M_ij = v, Σ x_i = 1
            const Ax = [], bx = [];
            for (const j of T) { Ax.push([...S.map(i => M[i][j]), -1]); bx.push(0); }
            Ax.push([...S.map(() => 1), 0]); bx.push(1);
            const xs = solveLinear(Ax, bx);
            if (!xs) continue;
            const v = xs[k];
            if (xs.slice(0, k).some(p => p < -EPS)) continue;
            // 列戦略 y (T上): 各 i∈S で Σ M_ij y_j = v, Σ y_j = 1
            const Ay = [], by = [];
            for (const i of S) { Ay.push([...T.map(j => M[i][j]), -1]); by.push(0); }
            Ay.push([...T.map(() => 1), 0]); by.push(1);
            const ys = solveLinear(Ay, by);
            if (!ys) continue;
            if (ys.slice(0, k).some(p => p < -EPS)) continue;
            const x = new Array(m).fill(0), y = new Array(n).fill(0);
            S.forEach((i, idx) => { x[i] = Math.max(0, xs[idx]); });
            T.forEach((j, idx) => { y[j] = Math.max(0, ys[idx]); });
            // 最適性チェック: どの列も v 未満にできない / どの行も v 超えにできない
            let ok = true;
            for (let j = 0; j < n && ok; j++) {
                let s = 0; for (let i = 0; i < m; i++) s += x[i] * M[i][j];
                if (s < v - 1e-7) ok = false;
            }
            for (let i = 0; i < m && ok; i++) {
                let s = 0; for (let j = 0; j < n; j++) s += M[i][j] * y[j];
                if (s > v + 1e-7) ok = false;
            }
            if (ok) return { value: v, row: x, col: y };
        }
    }
    // 理論上ここには来ないが、念のためマキシミン純粋戦略
    let best = 0, bestV = -Infinity;
    M.forEach((row, i) => { const w = Math.min(...row); if (w > bestV) { bestV = w; best = i; } });
    return { value: bestV, row: M.map((_, i) => (i === best ? 1 : 0)), col: new Array(n).fill(1 / n) };
}

// ---------- 対戦モデル ----------

/** 現在有効な補正込みの静的パラメータに正規化する。 */
export function makeFighter(c) {
    return {
        atk: Math.max(0, (c.atk || 0) + (c.tempAtk || 0)),
        atkC: Math.max(0, c.atkC || 0),
        grdC: Math.max(0, (c.grdC || 0) + (c.tempGrdC || 0)),
        chgC: Math.max(0, (c.chgC || 0) + (c.tempChgC || 0)),
        chgE: Math.max(0, (c.chgE || 0) + (c.tempChgE || 0)),
        winE: c.winE || 10,
        dmgReduce: Math.max(0, c.tempDmgReduce || 0),
    };
}

function cost(f, a) {
    return a === 'CHARGE' ? f.chgC : a === 'ATTACK' ? f.atkC : f.grdC;
}

export function legalActions(f, e) {
    const acts = ACTIONS.filter(a => e >= cost(f, a));
    return acts.length ? acts : ['CHARGE'];
}

/** 1ターン解決。s = [cHP, cE, pHP, pE]（A=CPU, B=プレイヤー） */
export function stepState(s, a, b, A, B) {
    let [ha, ea, hb, eb] = s;
    ea -= cost(A, a); eb -= cost(B, b);
    if (a === 'CHARGE') ea += A.chgE;
    if (b === 'CHARGE') eb += B.chgE;
    ea = Math.max(0, Math.min(ea, A.winE));
    eb = Math.max(0, Math.min(eb, B.winE));
    let da = 0, db = 0;
    if (a === 'ATTACK') {
        if (b === 'CHARGE') db += A.atk;
        else if (b === 'ATTACK') {
            if (A.atk > B.atk) db += A.atk;
            else if (B.atk > A.atk) da += B.atk;
        }
    } else if (a === 'CHARGE' && b === 'ATTACK') {
        da += B.atk;
    }
    da = Math.max(0, da - A.dmgReduce);
    db = Math.max(0, db - B.dmgReduce);
    return [Math.max(0, ha - da), ea, Math.max(0, hb - db), eb];
}

/** 終局判定（CPU視点）。続行なら null。game.js の判定順に合わせる。 */
export function terminalValue(s, A, B, simultaneousEnergyWin = 'PLAYER') {
    const [ha, ea, hb, eb] = s;
    if (ha <= 0 && hb <= 0) return 0;
    if (hb <= 0) return 1;
    if (ha <= 0) return -1;
    const wa = ea >= A.winE, wb = eb >= B.winE;
    if (wa && wb) return simultaneousEnergyWin === 'DRAW' ? 0 : -1;
    if (wb) return -1;
    if (wa) return 1;
    return null;
}

// ---------- 値反復 ----------

const cache = new Map();
const MAX_STATES = 60000;

function keyOf(A, B, opts) {
    return JSON.stringify([A, B, opts.simultaneousEnergyWin || 'PLAYER']);
}

/**
 * 与えられた対戦カードの全状態の均衡値を求める（結果はキャッシュ）。
 * 状態数が多すぎる場合は null。
 */
export function solveMatch(A, B, start, opts = {}) {
    const key = keyOf(A, B, opts);
    let entry = cache.get(key);
    const tie = opts.simultaneousEnergyWin || 'PLAYER';
    const enc = s => s.join(',');
    if (entry && entry.V.has(enc(start))) return entry;
    if (!entry) { entry = { V: new Map(), A, B, tie }; cache.set(key, entry); }

    // 到達可能な非終端状態を列挙（既知状態はスキップ）
    const fresh = [];
    const stack = [start];
    const seen = new Set([enc(start)]);
    while (stack.length) {
        const s = stack.pop();
        if (terminalValue(s, A, B, tie) !== null) continue;
        if (entry.V.has(enc(s))) continue;
        fresh.push(s);
        if (fresh.length + entry.V.size > MAX_STATES) return null;
        for (const a of legalActions(A, s[1])) {
            for (const b of legalActions(B, s[3])) {
                const t = stepState(s, a, b, A, B);
                const k = enc(t);
                if (!seen.has(k)) { seen.add(k); stack.push(t); }
            }
        }
    }
    const nodes = fresh.map(s => {
        const ra = legalActions(A, s[1]), rb = legalActions(B, s[3]);
        const next = ra.map(a => rb.map(b => {
            const t = stepState(s, a, b, A, B);
            const tv = terminalValue(t, A, B, tie);
            return tv !== null ? { fixed: tv } : { key: enc(t) };
        }));
        return { s, key: enc(s), next };
    });
    nodes.forEach(n => entry.V.set(n.key, 0));

    // HPは減る一方なので、(cpuHP, playerHP) が同じ状態を1つの層とし、
    // HP合計が小さい層から順に収束させる（下位層は確定済みになる）。
    const layers = new Map();
    for (const n of nodes) {
        const lk = n.s[0] * 1000 + n.s[2];
        if (!layers.has(lk)) layers.set(lk, []);
        layers.get(lk).push(n);
    }
    const order = [...layers.values()].sort((x, y) => (x[0].s[0] + x[0].s[2]) - (y[0].s[0] + y[0].s[2]));

    const val = c => (c.fixed !== undefined ? c.fixed : entry.V.get(c.key));
    const maxIter = opts.maxIter || 2000;
    const tol = opts.tol || 1e-7;
    for (const layer of order) {
        // エネルギーが高い（勝利に近い）状態から更新
        layer.sort((x, y) => (y.s[1] + y.s[3]) - (x.s[1] + x.s[3]));
        for (let it = 0; it < maxIter; it++) {
            let delta = 0;
            for (const n of layer) {
                const M = n.next.map(row => row.map(val));
                const { value } = solveMatrixGame(M);
                const d = Math.abs(value - entry.V.get(n.key));
                if (d > delta) delta = d;
                entry.V.set(n.key, value);
            }
            if (delta < tol) break;
        }
    }
    return entry;
}

/**
 * 現在の局面での CPU の均衡混合戦略を返す。
 * @returns {{value:number, strategy:Object<string,number>, opponent:Object<string,number>}|null}
 */
export function getNashStrategy({ cpu, player, cHP, cEnergy, pHP, pEnergy, forbidden = [], simultaneousEnergyWin }) {
    const A = makeFighter(cpu), B = makeFighter(player);
    const s = [Math.max(0, cHP), Math.max(0, cEnergy), Math.max(0, pHP), Math.max(0, pEnergy)];
    const opts = { simultaneousEnergyWin };
    const entry = solveMatch(A, B, s, opts);
    if (!entry) return null;
    const tie = entry.tie;
    let ra = legalActions(A, s[1]).filter(a => !forbidden.includes(a));
    if (!ra.length) ra = legalActions(A, s[1]);
    const rb = legalActions(B, s[3]);
    const M = ra.map(a => rb.map(b => {
        const t = stepState(s, a, b, A, B);
        const tv = terminalValue(t, A, B, tie);
        return tv !== null ? tv : (entry.V.get(t.join(',')) ?? 0);
    }));
    const { value, row, col } = solveMatrixGame(M);
    const strategy = {}, opponent = {}, playerMoveValues = {};
    ra.forEach((a, i) => { strategy[a] = row[i]; });
    rb.forEach((b, j) => {
        opponent[b] = col[j];
        // CPU が均衡戦略を取ったとき、プレイヤーがこの手を選んだ場合の CPU 期待値
        playerMoveValues[b] = ra.reduce((sum, _, i) => sum + row[i] * M[i][j], 0);
    });
    const matrix = { rows: ra, cols: rb, values: M };
    return { value, strategy, opponent, playerMoveValues, matrix };
}

/** 混合戦略から1手を抽選する。 */
export function sampleAction(strategy, rng = Math.random) {
    const entries = Object.entries(strategy);
    const total = entries.reduce((s, [, p]) => s + p, 0);
    let r = rng() * total;
    for (const [a, p] of entries) {
        r -= p;
        if (r < 0) return a;
    }
    return entries[entries.length - 1][0];
}

export function clearNashCache() {
    cache.clear();
}
