/**
 * 対人戦の試合エンジン。
 * DOM に依存しない純粋なロジックで、ブラウザ（P2P のフレンド戦）と
 * サーバー（ランダム/レート戦の判定）の両方から同じコードを使う。
 *
 * 対人戦で使えるのは基本キャラクターと基本3行動（CHARGE / ATTACK / GUARD）のみ。
 * 乱数を使わないので、同じ入力からは必ず同じ結果になる。
 */
import { CHARACTERS } from '../constants.js';
import { calculateTurnResult } from '../logic.js';
import { END_REASONS } from './protocol.js';

export const PVP_MOVES = ['CHARGE', 'ATTACK', 'GUARD'];
export const MAX_TURNS = 60; // これを超えたら引き分け（千日手防止）

export function getPvpChar(charId) {
    return CHARACTERS.find(c => c.id === charId) || null;
}

export function isPvpCharId(charId) {
    return typeof charId === 'string' && !!getPvpChar(charId);
}

export function randomPvpCharId() {
    return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
}

export function createMatch(charIds) {
    if (!Array.isArray(charIds) || charIds.length !== 2 || !charIds.every(isPvpCharId)) {
        throw new Error('invalid characters');
    }
    return {
        turn: 1,
        sides: charIds.map(id => {
            const c = getPvpChar(id);
            return { charId: id, hp: c.hp, energy: c.startE };
        }),
        outcome: null
    };
}

function moveCost(char, move) {
    if (move === 'ATTACK') return char.atkC;
    if (move === 'GUARD') return Math.max(0, char.grdC);
    if (move === 'CHARGE') return Math.max(0, char.chgC || 0);
    return Infinity;
}

export function legalMoves(match, side) {
    const s = match.sides[side];
    const c = getPvpChar(s.charId);
    return PVP_MOVES.filter(m => s.energy >= moveCost(c, m));
}

export function isLegalMove(match, side, move) {
    return legalMoves(match, side).includes(move);
}

// 時間切れなどで行動を自動決定するときの手
export function defaultMove(match, side) {
    const legal = legalMoves(match, side);
    return legal.includes('CHARGE') ? 'CHARGE' : (legal[0] || 'CHARGE');
}

/**
 * 勝敗判定。どちらの視点から呼んでも同じ結論になる（左右対称）。
 * a, b: { hp, energy, winE }
 * 戻り値: null（続行）または { winner: 0 | 1 | -1(引き分け), reason }
 */
export function judgeOutcome(a, b, turn = 1) {
    const aDead = a.hp <= 0, bDead = b.hp <= 0;
    if (aDead && bDead) return { winner: -1, reason: END_REASONS.DOUBLE_KO };
    if (bDead) return { winner: 0, reason: END_REASONS.KO };
    if (aDead) return { winner: 1, reason: END_REASONS.KO };

    const aFull = a.energy >= a.winE, bFull = b.energy >= b.winE;
    if (aFull && bFull) return { winner: -1, reason: END_REASONS.DOUBLE_CHARGE };
    if (aFull) return { winner: 0, reason: END_REASONS.CHARGE };
    if (bFull) return { winner: 1, reason: END_REASONS.CHARGE };

    if (turn >= MAX_TURNS) return { winner: -1, reason: END_REASONS.TURN_LIMIT };
    return null;
}

/**
 * 1ターン進める。match を書き換え、そのターンの結果を返す。
 * 不正な手（コスト不足など）は安全側に倒して自動の手に置き換える。
 */
export function resolveTurn(match, moves) {
    if (match.outcome) throw new Error('match already finished');
    const m = [0, 1].map(i => isLegalMove(match, i, moves[i]) ? moves[i] : defaultMove(match, i));
    const [a, b] = match.sides;
    const ca = getPvpChar(a.charId), cb = getPvpChar(b.charId);

    const r = calculateTurnResult(
        { ...ca, hp: a.hp, energy: a.energy, maxHp: ca.hp, effects: [] },
        { ...cb, hp: b.hp, energy: b.energy, effects: [] },
        m[0], m[1], null
    );

    a.hp = r.pHP; a.energy = r.pEnergy;
    b.hp = r.cHP; b.energy = r.cEnergy;

    const turn = match.turn;
    const outcome = judgeOutcome(
        { hp: a.hp, energy: a.energy, winE: ca.winE },
        { hp: b.hp, energy: b.energy, winE: cb.winE },
        turn
    );
    if (outcome) match.outcome = outcome;
    else match.turn += 1;

    return { turn, moves: m, damage: [r.pDmgTaken, r.cDmgTaken], outcome };
}

// side から見た局面（[自分, 相手] の順）
export function viewFor(match, side) {
    return [match.sides[side], match.sides[1 - side]].map(s => ({ charId: s.charId, hp: s.hp, energy: s.energy }));
}
