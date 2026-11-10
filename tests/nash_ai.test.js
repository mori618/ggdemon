import { describe, it, expect } from 'vitest';
import { solveMatrixGame, getNashStrategy } from '../js/nashAI.js';
import { CHARACTERS } from '../js/constants.js';

const C = Object.fromEntries(Object.values(CHARACTERS).map(c => [c.id, c]));

describe('solveMatrixGame', () => {
    it('じゃんけん型は均等混合・値0', () => {
        const r = solveMatrixGame([[0, -1, 1], [1, 0, -1], [-1, 1, 0]]);
        expect(r.value).toBeCloseTo(0, 6);
        r.row.forEach(p => expect(p).toBeCloseTo(1 / 3, 6));
    });
    it('鞍点のある行列は純粋戦略', () => {
        const r = solveMatrixGame([[3, 2], [1, 0]]);
        expect(r.value).toBe(2);
        expect(r.row).toEqual([1, 0]);
    });
    it('2x2 の完全混合（マッチングペニー）', () => {
        const r = solveMatrixGame([[1, -1], [-1, 1]]);
        expect(r.value).toBeCloseTo(0, 9);
        expect(r.row[0]).toBeCloseTo(0.5, 9);
    });
});

describe('getNashStrategy', () => {
    it('Python版ソルバーと同じ均衡を返す（Striker vs Tactician 開幕）', () => {
        const r = getNashStrategy({
            cpu: C.STRIKER, player: C.TACTICIAN,
            cHP: 2, cEnergy: 1, pHP: 3, pEnergy: 3, simultaneousEnergyWin: 'DRAW'
        });
        expect(r.value).toBeCloseTo(0.4334, 3);
        expect(r.strategy.CHARGE).toBeCloseTo(0.569, 2);
        expect(r.strategy.GUARD).toBeCloseTo(0.431, 2);
    });
    it('相手が攻撃できず、チャージで勝てるなら必ずチャージ', () => {
        const r = getNashStrategy({
            cpu: C.NORMAL, player: C.NORMAL, cHP: 3, cEnergy: 4, pHP: 3, pEnergy: 0
        });
        expect(r.strategy.CHARGE).toBeCloseTo(1, 9);
        expect(r.value).toBe(1);
    });
    it('払えない行動は戦略に含まれない', () => {
        const r = getNashStrategy({
            cpu: C.STRIKER, player: C.NORMAL, cHP: 2, cEnergy: 1, pHP: 3, pEnergy: 1
        });
        expect(r.strategy.ATTACK).toBeUndefined();
    });
});

describe('getCpuMoveLogic (MASTER)', async () => {
    const { getCpuMoveLogic } = await import('../js/logic.js');
    const base = (over) => ({
        player: { ...C.NORMAL }, cpu: { ...C.NORMAL, effects: [] },
        pEnergy: 0, cEnergy: 4, cHP: 3, pHP: 3, aiLevel: 'MASTER',
        gameMode: 'normal', floor: 0, playerHistory: [], cpuHistory: [], ...over
    });
    it('勝ちが確定する局面では必ずその手を選ぶ', () => {
        for (let i = 0; i < 20; i++) expect(getCpuMoveLogic(base())).toBe('CHARGE');
    });
    it('呪縛(BIND)中は直前の行動を選ばない', () => {
        const args = base({ cpu: { ...C.NORMAL, effects: [{ type: 'BIND', turns: 2 }] }, cpuHistory: ['CHARGE'] });
        for (let i = 0; i < 20; i++) expect(getCpuMoveLogic(args)).not.toBe('CHARGE');
    });
});
