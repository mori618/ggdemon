// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../js/constants.js';
import { createMatch, resolveTurn, legalMoves, isLegalMove, defaultMove, judgeOutcome, viewFor, PVP_MOVES, MAX_TURNS } from '../js/online/pvp.js';
import { expectedScore, updateRatings, MIN_RATING } from '../js/online/rating.js';
import { findPairs, needsRetry, ratingWindow, OPEN_AFTER_MS } from '../js/online/matchmaking.js';
import { makeCommit, verifyCommit } from '../js/online/commit.js';
import { sanitizeName, NAME_MAX_LENGTH } from '../js/online/protocol.js';

describe('対人戦エンジン', () => {
    it('初期状態はキャラクターのHPと初期エネルギー', () => {
        const m = createMatch(['TANK', 'OVERDRIVE']);
        expect(m.sides).toEqual([{ charId: 'TANK', hp: 5, energy: 0 }, { charId: 'OVERDRIVE', hp: 2, energy: 6 }]);
        expect(m.turn).toBe(1);
    });

    it('存在しないキャラクターやボスは使えない', () => {
        expect(() => createMatch(['NORMAL', 'VOID_EATER'])).toThrow();
        expect(() => createMatch(['NORMAL'])).toThrow();
    });

    it('エネルギーが足りない手は選べない', () => {
        const m = createMatch(['NORMAL', 'TACTICIAN']);
        expect(legalMoves(m, 0)).toEqual(['CHARGE', 'GUARD']); // 攻撃コスト1・エネルギー0
        expect(legalMoves(m, 1)).toEqual(['CHARGE', 'ATTACK', 'GUARD']);
        expect(isLegalMove(m, 0, 'ATTACK')).toBe(false);
        expect(isLegalMove(m, 0, 'SKILL')).toBe(false);
        expect(defaultMove(m, 0)).toBe('CHARGE');
    });

    it('不正な手を渡されても安全な手に置き換えて進む', () => {
        const m = createMatch(['NORMAL', 'NORMAL']);
        const out = resolveTurn(m, ['ATTACK', 'HACK']);
        expect(out.moves).toEqual(['CHARGE', 'CHARGE']);
        expect(m.sides.map(s => s.energy)).toEqual([1, 1]);
    });

    it('攻撃はチャージ中の相手に当たり、ガードには防がれる', () => {
        const m = createMatch(['NORMAL', 'NORMAL']);
        resolveTurn(m, ['CHARGE', 'CHARGE']);
        resolveTurn(m, ['ATTACK', 'CHARGE']);
        expect(m.sides[1].hp).toBe(2);
        expect(m.sides[0].energy).toBe(0);
        resolveTurn(m, ['CHARGE', 'ATTACK']);
        expect(m.sides[0].hp).toBe(2);
        resolveTurn(m, ['ATTACK', 'GUARD']);
        expect(m.sides[1].hp).toBe(2);
    });

    it('どの組み合わせでも、左右を入れ替えると結果も入れ替わる（左右対称）', () => {
        const ids = CHARACTERS.map(c => c.id);
        for (const a of ids) for (const b of ids) {
            for (const ma of PVP_MOVES) for (const mb of PVP_MOVES) {
                const m1 = createMatch([a, b]), m2 = createMatch([b, a]);
                // 手の選択肢を広げるため、両者にエネルギーを持たせる
                for (const m of [m1, m2]) m.sides.forEach(s => { s.energy = 4; });
                const o1 = resolveTurn(m1, [ma, mb]);
                const o2 = resolveTurn(m2, [mb, ma]);
                expect(m1.sides[0]).toEqual(m2.sides[1]);
                expect(m1.sides[1]).toEqual(m2.sides[0]);
                expect(o1.moves).toEqual([o2.moves[1], o2.moves[0]]);
                const flip = o => o && { ...o, winner: o.winner === -1 ? -1 : 1 - o.winner };
                expect(o1.outcome).toEqual(flip(o2.outcome));
            }
        }
    });

    it('勝敗判定: KOがエネルギー達成より優先され、同時は引き分け', () => {
        const s = (hp, energy) => ({ hp, energy, winE: 5 });
        expect(judgeOutcome(s(1, 0), s(1, 0))).toBeNull();
        expect(judgeOutcome(s(1, 0), s(0, 0))).toEqual({ winner: 0, reason: 'ko' });
        expect(judgeOutcome(s(0, 5), s(1, 0))).toEqual({ winner: 1, reason: 'ko' });
        expect(judgeOutcome(s(0, 0), s(0, 0))).toEqual({ winner: -1, reason: 'double_ko' });
        expect(judgeOutcome(s(1, 5), s(1, 0))).toEqual({ winner: 0, reason: 'charge' });
        expect(judgeOutcome(s(1, 5), s(1, 5))).toEqual({ winner: -1, reason: 'double_charge' });
        expect(judgeOutcome(s(1, 0), s(1, 0), MAX_TURNS)).toEqual({ winner: -1, reason: 'turn_limit' });
    });

    it('エネルギー達成で勝利し、決着後は進められない', () => {
        const m = createMatch(['ASSASSIN', 'TANK']); // ASSASSIN は WinE 4
        let out;
        for (let i = 0; i < 4; i++) out = resolveTurn(m, ['CHARGE', 'GUARD']);
        expect(out.outcome).toEqual({ winner: 0, reason: 'charge' });
        expect(out.turn).toBe(4);
        expect(() => resolveTurn(m, ['CHARGE', 'CHARGE'])).toThrow();
    });

    it('お互いガードし続けるとターン上限で引き分け', () => {
        const m = createMatch(['NORMAL', 'NORMAL']);
        let out;
        for (let i = 0; i < MAX_TURNS; i++) out = resolveTurn(m, ['GUARD', 'GUARD']);
        expect(out.outcome).toEqual({ winner: -1, reason: 'turn_limit' });
    });

    it('viewFor は自分を先頭にした局面を返す', () => {
        const m = createMatch(['TANK', 'SAGE']);
        expect(viewFor(m, 1).map(s => s.charId)).toEqual(['SAGE', 'TANK']);
    });
});

describe('レート計算', () => {
    it('同レートなら期待勝率は5割で、勝つと+16', () => {
        expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
        expect(updateRatings(1500, 1500, 1)).toEqual([1516, 1484]);
        expect(updateRatings(1500, 1500, 0.5)).toEqual([1500, 1500]);
    });

    it('格上に勝つほど多く上がり、変動は両者で釣り合う', () => {
        const [a, b] = updateRatings(1400, 1800, 1);
        expect(a - 1400).toBeGreaterThan(16);
        expect(a - 1400).toBe(1800 - b);
        const [c] = updateRatings(1800, 1400, 1);
        expect(c - 1800).toBeLessThan(16);
    });

    it('下限を下回らない', () => {
        expect(updateRatings(MIN_RATING, MIN_RATING, 0)[0]).toBe(MIN_RATING);
    });
});

describe('マッチング', () => {
    const e = (key, mode, rating, joinedAt, playerId = key) => ({ key, playerId, mode, rating, joinedAt });

    it('カジュアルは先着順、モードが違う人とは組まない', () => {
        const pairs = findPairs([e('a', 'casual', 1000, 1), e('r', 'ranked', 1000, 2), e('b', 'casual', 2000, 3), e('c', 'casual', 1500, 4)], 10);
        expect(pairs.map(p => p.map(x => x.key))).toEqual([['a', 'b']]);
    });

    it('レート戦はレートが近い相手を優先する', () => {
        const pairs = findPairs([e('a', 'ranked', 1500, 0), e('b', 'ranked', 1590, 0), e('c', 'ranked', 1510, 0), e('d', 'ranked', 1600, 0)], 0);
        expect(pairs.map(p => p.map(x => x.key).sort())).toEqual([['a', 'c'], ['b', 'd']]);
    });

    it('レート差が大きいとすぐには組まないが、待つと組む', () => {
        const entries = [e('a', 'ranked', 1500, 0), e('b', 'ranked', 1900, 0)];
        const early = findPairs(entries, 1000);
        expect(early).toEqual([]);
        expect(needsRetry(entries, early)).toBe(true);
        expect(findPairs(entries, 13000)).toHaveLength(1); // 100 + 25*13 = 425 ≥ 400
        expect(ratingWindow(OPEN_AFTER_MS)).toBe(Infinity);
        expect(findPairs([e('a', 'ranked', 100, 0), e('b', 'ranked', 3000, 0)], OPEN_AFTER_MS)).toHaveLength(1);
    });

    it('同じプレイヤー同士は組まない', () => {
        const entries = [e('a1', 'ranked', 1500, 0, 'a'), e('a2', 'ranked', 1500, 1, 'a'), e('c1', 'casual', 1500, 0, 'c'), e('c2', 'casual', 1500, 1, 'c')];
        const pairs = findPairs(entries, 99999);
        expect(pairs).toEqual([]);
        expect(needsRetry(entries, pairs)).toBe(false);
    });

    it('1人だけ、またはカジュアルだけの待機なら再判定は不要', () => {
        expect(needsRetry([e('a', 'ranked', 1500, 0)], [])).toBe(false);
        expect(needsRetry([e('a', 'casual', 1500, 0)], [])).toBe(false);
    });
});

describe('コミット＆リビール', () => {
    it('正しい手と乱数でだけ検証が通る', async () => {
        const { hash, nonce } = await makeCommit('move|0|3|H', 'ATTACK');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(await verifyCommit(hash, 'move|0|3|H', 'ATTACK', nonce)).toBe(true);
        expect(await verifyCommit(hash, 'move|0|3|H', 'GUARD', nonce)).toBe(false);  // 後から手を変えた
        expect(await verifyCommit(hash, 'move|0|4|H', 'ATTACK', nonce)).toBe(false); // 別ターンへの使い回し
        expect(await verifyCommit(hash, 'move|0|3|G', 'ATTACK', nonce)).toBe(false); // 相手のコミットの流用
        expect(await verifyCommit(hash, 'move|0|3|H', 'ATTACK', 'x')).toBe(false);
        expect(await verifyCommit(hash, 'move|0|3|H', 'ATTACK', undefined)).toBe(false);
    });

    it('同じ手でもハッシュは毎回変わる（ハッシュから手を推測できない）', async () => {
        const a = await makeCommit('c', 'CHARGE'), b = await makeCommit('c', 'CHARGE');
        expect(a.hash).not.toBe(b.hash);
    });
});

describe('表示名の正規化', () => {
    it('空白を詰め、長すぎる名前は切り詰める', () => {
        expect(sanitizeName('  モリ   太郎 ')).toBe('モリ 太郎');
        expect(Array.from(sanitizeName('あ'.repeat(30)))).toHaveLength(NAME_MAX_LENGTH);
        expect(sanitizeName('😀'.repeat(20))).toBe('😀'.repeat(NAME_MAX_LENGTH));
    });

    it('空・制御文字だけ・文字列以外は使えない', () => {
        expect(sanitizeName('')).toBeNull();
        expect(sanitizeName('   ')).toBeNull();
        expect(sanitizeName(String.fromCharCode(0, 7, 0x200b, 0x2028))).toBeNull();
        expect(sanitizeName(123)).toBeNull();
        expect(sanitizeName('a' + String.fromCharCode(10) + 'b')).toBe('ab');
    });
});
