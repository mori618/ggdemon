import { describe, it, expect } from 'vitest';
import { calculateTurnResult, getCpuMoveLogic } from '../js/logic.js';

describe('Bind Status Logic', () => {
    const baseChar = {
        hp: 10, atk: 2, atkC: 2, chgE: 2, grdC: 1, winE: 10,
        energy: 5, effects: [], tempAtk: 0, tempGrdC: 0, tempChgE: 0, tempChgC: 0, tempDmgReduce: 0,
        skillEffectBonus: 0
    };

    describe('calculateTurnResult - CURSE Skill', () => {
        it('should apply BIND status to opponent', () => {
            const p = { ...baseChar, energy: 5 };
            const c = { ...baseChar, energy: 5 };
            const skill = { id: 'CURSE', category: 'SPECIAL', cost: 3, effectValues: [3] }; // 3 turns

            const res = calculateTurnResult(p, c, 'SKILL', 'CHARGE', skill);

            expect(res.cEffects).toEqual(expect.arrayContaining([
                expect.objectContaining({ type: 'BIND', turns: 3 })
            ]));
        });
    });

    describe('getCpuMoveLogic - BIND Restriction', () => {
        it('should not select the same move twice if BIND is active', () => {
            const cpu = { ...baseChar, effects: [{ type: 'BIND', turns: 2 }] };
            const player = { ...baseChar };

            // Mock history where last move was ATTACK
            const cpuHistory = ['ATTACK'];

            // Force logic to want to ATTACK (can kill player)
            const pLow = { ...player, hp: 1 };
            const cHigh = { ...cpu, atk: 10, energy: 10 };

            // Normally this guarantees ATTACK
            // But since last move was ATTACK and BIND is active, it should NOT be ATTACK
            const move = getCpuMoveLogic({
                player: pLow, cpu: cHigh,
                pEnergy: 5, cEnergy: 10,
                aiLevel: 'HARD', gameMode: 'normal', floor: 1,
                cHP: 10, pHP: 1,
                playerHistory: [],
                cpuHistory: cpuHistory
            });

            expect(move).not.toBe('ATTACK');
        });

        it('should fallback to CHARGE if filtered pool is empty (Soft-lock prevention)', () => {
            const cpu = { ...baseChar, effects: [{ type: 'BIND', turns: 2 }] };
            const player = { ...baseChar };

            // Create a situation where only ATTACK is viable logic-wise, but it's bound
            // Using a mock where weights are manipulated is hard via the function parameters alone
            // So we rely on the soft-lock logic we added (if pool is empty)

            // If we pass an empty history, it acts normal
            // If we pass a history, it filters

            // Let's force a scenario where we pretend the ONLY valid move in pool was ATTACK
            // We can't easily force the internal pool variable to be ['ATTACK', 'ATTACK'...] via args easily without understanding weights deeply
            // However, we know if cCanKillP is true, ATTACK gets +200 weight.
            // If we make other weights 0...

            const cKiller = { ...cpu, atk: 10, energy: 10, chgE: 0, grdC: 99 };
            // grdC 99 -> cannot Guard
            // chgE 0 -> maybe Charge weight is low? Logic says: if (!canCCharge || cEnergy >= cWinLimit) weights.CHARGE = 0;
            // Let's set energy to max (winLimit) so CHARGE weight becomes 0.

            const cMax = { ...cKiller, energy: 10, winE: 10 };
            // Now CHARGE weight is 0. GUARD weight is 0 (cost 99 > 10? No, wait energy is 10. make grdC 11).
            const cNoGuard = { ...cMax, grdC: 11 };

            // So GUARD=0, CHARGE=0. ATTACK is valid.
            // Pool should only have ATTACK.

            // Now apply BIND with last move ATTACK.
            const move = getCpuMoveLogic({
                player: { ...player, hp: 1 },
                cpu: cNoGuard,
                pEnergy: 5, cEnergy: 10,
                aiLevel: 'HARD', gameMode: 'normal', floor: 1,
                cHP: 10, pHP: 1,
                playerHistory: [],
                cpuHistory: ['ATTACK']
            });

            // Should fallback to CHARGE even if weight was 0 originally
            expect(move).toBe('CHARGE');
        });
    });
});
