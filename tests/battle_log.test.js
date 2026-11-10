import { describe, it, expect, beforeEach } from 'vitest';
import { startBattleLog, beginTurnLog, addTurnStep, finishTurnLog, endBattleLog, loadLogs, clearLogs, getLastLog } from '../js/battleLog.js';

const gs = () => ({
    gameMode: 'normal', aiLevel: 'MASTER', turn: 1,
    player: { name: 'Normal', id: 'NORMAL', hp: 3, atk: 1, winE: 5, chgE: 1, grdC: 0, atkC: 1, startE: 0, effects: [] },
    cpu: { name: 'Striker', id: 'STRIKER', hp: 2, atk: 3, winE: 6, chgE: 1, grdC: 0, atkC: 2, startE: 1, effects: [] },
    pHP: 3, cHP: 2, pEnergy: 0, cEnergy: 1, playerSkill: null, currentBattle: { isBoss: false }
});

describe('battleLog', () => {
    beforeEach(() => clearLogs());

    it('1戦分のターンと結果を記録し、保存する', () => {
        const s = gs();
        startBattleLog(s);
        const decision = { type: 'NASH', value: 0.2, strategy: { CHARGE: 1 }, playerMoveValues: { CHARGE: 0.3, GUARD: 0.1 } };
        const t = beginTurnLog(s, 'CHARGE', 'CHARGE', decision);
        decision.value = 999; // 後から書き換えてもログは影響を受けない
        s.pEnergy = 1; s.cEnergy = 2;
        addTurnStep(t, 'CHARGE', { pDmgTaken: 0, cDmgTaken: 0, pHP: 3, cHP: 2, pEnergy: 1, cEnergy: 2 });
        finishTurnLog(t, s);
        const log = endBattleLog(s, 'DEFEAT', 'CPU CHARGED UP');

        expect(log.turns).toHaveLength(1);
        expect(log.turns[0].before.pEnergy).toBe(0);
        expect(log.turns[0].after.pEnergy).toBe(1);
        expect(log.turns[0].cpuDecision.value).toBe(0.2);
        expect(log.result.outcome).toBe('DEFEAT');
        expect(log.summary.playerMoves).toEqual({ CHARGE: 1 });
        expect(log.summary.nash.valueTrajectory[0].value).toBe(0.2);
        expect(loadLogs()).toHaveLength(1);
        expect(getLastLog().id).toBe(log.id);
        expect(() => JSON.stringify(getLastLog())).not.toThrow();
    });

    it('開始していないバトルのターンは記録しない', () => {
        expect(beginTurnLog(gs(), 'CHARGE', 'CHARGE', null)).toBeNull();
        expect(endBattleLog(gs(), 'VICTORY', '')).toBeNull();
    });
});

describe('evaluatePlayerMove', async () => {
    const { evaluatePlayerMove } = await import('../js/battleLog.js');
    it('均衡外の手は損失、読まれた場合の損失も計算する', () => {
        const t = {
            turn: 3, playerMove: 'CHARGE',
            cpuDecision: {
                type: 'NASH', value: 0.5,
                matrix: { rows: ['CHARGE', 'ATTACK'], cols: ['CHARGE', 'GUARD'], values: [[0.4, 0.6], [1, 0.2]] },
                playerMoveValues: { CHARGE: 0.7, GUARD: 0.5 },
                opponentEquilibrium: { CHARGE: 0, GUARD: 1 }
            }
        };
        const ev = evaluatePlayerMove(t);
        expect(ev.lossVsEquilibrium).toBeCloseTo(0.2, 9);
        expect(ev.readPenalty).toBeCloseTo(0.5, 9);
        expect(ev.equilibriumProb).toBe(0);
    });
});
