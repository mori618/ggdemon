// キャラクター総当たりバトルシミュレーション
// 実行: node tests/round_robin_sim.js [battlesPerMatchup]
//
// 1) AI vs AI : ゲーム内CPU AI (getCpuMoveLogic) 同士で対戦
// 2) 理論値   : 同時手番ゼロサムゲームとして後退帰納で解いた最適戦略同士の期待値
// ※ スキル・アイテム・パッシブは使用しない（素のステータスのみ）
import { CHARACTERS } from '../js/constants.js';
import { calculateTurnResult, getCpuMoveLogic } from '../js/logic.js';

const N = Number(process.argv[2]) || 10000;
const MAX_TURNS = 50;
const MOVES = ['CHARGE', 'ATTACK', 'GUARD'];

// 勝敗判定 (ゲームの判定順を左右対称にしたもの): 1=A勝ち, -1=B勝ち, 0=引き分け, null=続行
function judge(a, b, hpA, hpB, eA, eB) {
    if (hpA <= 0 && hpB <= 0) return 0;
    if (hpB <= 0) return 1;
    if (hpA <= 0) return -1;
    const wA = eA >= a.winE, wB = eB >= b.winE;
    if (wA && wB) return 0;
    if (wA) return 1;
    if (wB) return -1;
    return null;
}

// ---------- 1) AI vs AI ----------
function aiBattle(a, b) {
    let hpA = a.hp, hpB = b.hp, eA = a.startE, eB = b.startE;
    const hA = [], hB = [];
    const A = { ...a, effects: [] }, B = { ...b, effects: [] };
    for (let t = 0; t < MAX_TURNS; t++) {
        const mA = getCpuMoveLogic({ player: B, cpu: A, pEnergy: eB, cEnergy: eA, aiLevel: 'NORMAL', gameMode: 'cpu', floor: 0, cHP: hpA, pHP: hpB, playerHistory: hB, cpuHistory: hA });
        const mB = getCpuMoveLogic({ player: A, cpu: B, pEnergy: eA, cEnergy: eB, aiLevel: 'NORMAL', gameMode: 'cpu', floor: 0, cHP: hpB, pHP: hpA, playerHistory: hA, cpuHistory: hB });
        const r = calculateTurnResult({ ...A, hp: hpA, energy: eA }, { ...B, hp: hpB, energy: eB }, mA, mB, null);
        hpA = r.pHP; hpB = r.cHP; eA = r.pEnergy; eB = r.cEnergy;
        hA.push(mA); hB.push(mB);
        const j = judge(a, b, hpA, hpB, eA, eB);
        if (j !== null) return j;
    }
    return 0;
}

// ---------- 2) 理論値 (最適戦略) ----------
// 行プレイヤー最大化の小規模(<=3x3)ゼロサム行列ゲームを厳密に解く
function solveMatrix(M) {
    const m = M.length, n = M[0].length;
    const val = x => { let mn = Infinity; for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += x[i] * M[i][j]; if (s < mn) mn = s; } return mn; };
    let best = -Infinity;
    const cands = [];
    for (let i = 0; i < m; i++) { const x = Array(m).fill(0); x[i] = 1; cands.push(x); }
    for (let i1 = 0; i1 < m; i1++) for (let i2 = i1 + 1; i2 < m; i2++) for (let j1 = 0; j1 < n; j1++) for (let j2 = j1 + 1; j2 < n; j2++) {
        const d = (M[i1][j1] - M[i1][j2]) - (M[i2][j1] - M[i2][j2]);
        if (Math.abs(d) < 1e-12) continue;
        const p = -(M[i2][j1] - M[i2][j2]) / d;
        if (p < 0 || p > 1) continue;
        const x = Array(m).fill(0); x[i1] = p; x[i2] = 1 - p; cands.push(x);
    }
    if (m === 3 && n === 3) {
        // 3列すべて等しくなる内点: x·(c0-c1)=0, x·(c0-c2)=0, sum x=1
        const r1 = [0, 1, 2].map(i => M[i][0] - M[i][1]);
        const r2 = [0, 1, 2].map(i => M[i][0] - M[i][2]);
        const A = [r1, r2, [1, 1, 1]], bb = [0, 0, 1];
        const det = A => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
        const D = det(A);
        if (Math.abs(D) > 1e-12) {
            const x = [0, 1, 2].map(k => det(A.map((row, r) => row.map((v, c) => (c === k ? bb[r] : v)))) / D);
            if (x.every(v => v >= -1e-12)) cands.push(x);
        }
    }
    for (const x of cands) { const v = val(x); if (v > best) best = v; }
    return best;
}

function solveMatchup(a, b) {
    const maxE = Math.max(a.winE, b.winE);
    const key = (hA, hB, eA, eB) => ((hA * 8 + hB) * 32 + eA) * 32 + eB;
    let prev = new Map(); // 残り0ターン: 引き分け(0)
    const get = (V, hA, hB, eA, eB) => V.get(key(hA, hB, eA, eB)) || 0;
    const legal = (c, e) => MOVES.filter(mv => (mv === 'ATTACK' ? e >= c.atkC : mv === 'GUARD' ? e >= c.grdC : e >= (c.chgC || 0)));
    const A = { ...a, effects: [] }, B = { ...b, effects: [] };
    let cur;
    for (let t = 1; t <= MAX_TURNS; t++) {
        cur = new Map();
        for (let hA = 1; hA <= a.hp; hA++) for (let hB = 1; hB <= b.hp; hB++)
            for (let eA = 0; eA < a.winE; eA++) for (let eB = 0; eB < b.winE; eB++) {
                const mA = legal(a, eA), mB = legal(b, eB);
                const M = mA.map(x => mB.map(y => {
                    const r = calculateTurnResult({ ...A, hp: hA, energy: eA }, { ...B, hp: hB, energy: eB }, x, y, null);
                    const j = judge(a, b, r.pHP, r.cHP, r.pEnergy, r.cEnergy);
                    return j !== null ? j : get(prev, r.pHP, r.cHP, r.pEnergy, r.cEnergy);
                }));
                cur.set(key(hA, hB, eA, eB), solveMatrix(M));
            }
        prev = cur;
    }
    return get(cur, a.hp, b.hp, Math.min(a.startE, a.winE), Math.min(b.startE, b.winE));
}

// ---------- 実行 ----------
const chars = CHARACTERS;
const names = chars.map(c => c.id);
const ai = names.map(() => names.map(() => null));
const th = names.map(() => names.map(() => null));
const aiTot = names.map(() => ({ w: 0, l: 0, d: 0 }));

for (let i = 0; i < chars.length; i++) for (let j = 0; j < chars.length; j++) {
    if (i === j) continue;
    let w = 0, l = 0, d = 0;
    for (let k = 0; k < N; k++) { const r = aiBattle(chars[i], chars[j]); if (r > 0) w++; else if (r < 0) l++; else d++; }
    ai[i][j] = w / N;
    aiTot[i].w += w; aiTot[i].l += l; aiTot[i].d += d;
    if (i < j) { const v = solveMatchup(chars[i], chars[j]); th[i][j] = v; th[j][i] = -v; }
}

const pad = (s, n) => String(s).padStart(n);
console.log(`\n=== AI vs AI 勝率 (行キャラの勝率, 各${N}戦) ===`);
console.log(pad('', 10) + names.map(n => pad(n.slice(0, 6), 7)).join(''));
names.forEach((n, i) => console.log(pad(n, 10) + ai[i].map(v => pad(v === null ? '-' : (v * 100).toFixed(0) + '%', 7)).join('')));

console.log(`\n=== 理論値 (最適戦略同士の期待値: +1=必勝, -1=必敗) ===`);
console.log(pad('', 10) + names.map(n => pad(n.slice(0, 6), 7)).join(''));
names.forEach((n, i) => console.log(pad(n, 10) + th[i].map(v => pad(v === null ? '-' : v.toFixed(2), 7)).join('')));

console.log(`\n=== ランキング ===`);
const rows = names.map((n, i) => {
    const t = aiTot[i], tot = t.w + t.l + t.d;
    const thAvg = th[i].filter(v => v !== null).reduce((s, v) => s + v, 0) / (names.length - 1);
    const thWins = th[i].filter(v => v !== null && v > 0.01).length;
    return { n, aiRate: t.w / tot, aiLoss: t.l / tot, thAvg, thWins };
}).sort((x, y) => y.aiRate - x.aiRate);
console.log(pad('キャラ', 10) + pad('AI勝率', 9) + pad('AI敗率', 9) + pad('理論平均', 9) + pad('理論有利数', 7));
rows.forEach(r => console.log(pad(r.n, 10) + pad((r.aiRate * 100).toFixed(1) + '%', 9) + pad((r.aiLoss * 100).toFixed(1) + '%', 9) + pad(r.thAvg.toFixed(2), 9) + pad(r.thWins + '/8', 7)));
