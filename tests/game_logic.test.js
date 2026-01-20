import { describe, it, expect, vi } from 'vitest';
import { calculateTurnResult, updateEffects, getCpuMoveLogic } from '../js/logic.js';

describe('Game Logic', () => {
    const baseChar = {
        hp: 10, atk: 2, atkC: 2, chgE: 2, grdC: 1, winE: 10,
        energy: 0, effects: [], tempAtk: 0, tempGrdC: 0, tempChgE: 0, tempChgC: 0, tempDmgReduce: 0
    };

    describe('calculateTurnResult', () => {
        it('should swap damage when both attack', () => {
            const p = { ...baseChar, energy: 2, atk: 3 };
            const c = { ...baseChar, energy: 2, atk: 2 };
            const res = calculateTurnResult(p, c, 'ATTACK', 'ATTACK');

            expect(res.cDmgTaken).toBe(3);
            expect(res.pDmgTaken).toBe(0);
            expect(res.cHP).toBe(7);
        });

        it('should deal damage to charger', () => {
            const p = { ...baseChar, energy: 2, atk: 3 };
            const c = { ...baseChar, energy: 0 };
            const res = calculateTurnResult(p, c, 'ATTACK', 'CHARGE');

            expect(res.cDmgTaken).toBe(3);
            expect(res.cEnergy).toBe(2); // Charger still gains energy
        });

        it('should deal no damage if blocked', () => {
            const p = { ...baseChar, energy: 2, atk: 3 };
            const c = { ...baseChar, energy: 1 };
            const res = calculateTurnResult(p, c, 'ATTACK', 'GUARD');

            expect(res.cDmgTaken).toBe(0);
            expect(res.pDmgTaken).toBe(0);
        });

        it('should apply skill effects: CONVERT', () => {
            const p = { ...baseChar, hp: 10, energy: 0 };
            const c = { ...baseChar };
            const skill = { id: 'CONVERT', category: 'SPECIAL', cost: 0, effectValues: [2, 5] };
            const res = calculateTurnResult(p, c, 'SKILL', 'CHARGE', skill);

            expect(res.pHP).toBe(8);
            expect(res.pEnergy).toBe(5);
        });
    });

    describe('updateEffects', () => {
        it('should decrement turns and remove expired effects', () => {
            const effects = [{ type: 'ATK_UP', amount: 2, turns: 1 }];
            const res = updateEffects(effects);
            expect(res.effects.length).toBe(0);
            expect(res.totals.tempAtk).toBe(0);
        });

        it('should accumulate totals for active effects', () => {
            const effects = [
                { type: 'ATK_UP', amount: 2, turns: 2 },
                { type: 'CHGE_UP', amount: 1, turns: 2 }
            ];
            const res = updateEffects(effects);
            expect(res.effects.length).toBe(2);
            expect(res.totals.tempAtk).toBe(2);
            expect(res.totals.tempChgE).toBe(1);
        });
    });

    describe('getCpuMoveLogic', () => {
        it('should always attack if it can kill the player', () => {
            const p = { ...baseChar, hp: 1 };
            const c = { ...baseChar, atk: 2, atkC: 0, energy: 10 };

            // Mock random to return high value to pick ATTACK (weight is 230+)
            const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

            const move = getCpuMoveLogic({ player: p, cpu: c, pEnergy: 0, cEnergy: 10, aiLevel: 'NORMAL', cHP: 10, pHP: 1 });
            expect(move).toBe('ATTACK');

            spy.mockRestore();
        });
    });
});
