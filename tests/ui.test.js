import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderChars, updateUI, setMessage, initEnergy } from '../js/ui.js';
import { gameState } from '../js/utils.js';

// Global mocks
global.lucide = {
    createIcons: vi.fn(),
};

vi.mock('../js/sounds.js', () => ({
    sound: {
        playSE: vi.fn(),
    },
}));

describe('UI Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="char-grid"></div>
            <div id="player-hp-bar" style="width: 0%"></div>
            <div id="cpu-hp-bar" style="width: 0%"></div>
            <div id="player-hp-text"></div>
            <div id="cpu-hp-text"></div>
            <div id="player-chge-val"></div>
            <div id="player-atk-val"></div>
            <div id="player-cost-val"></div>
            <div id="cpu-chge-val"></div>
            <div id="cpu-atk-val"></div>
            <div id="cpu-cost-val"></div>
            <div id="player-energy-bar"></div>
            <div id="cpu-energy-bar"></div>
            <div id="turn-display"></div>
            <div id="game-message"></div>
            <div id="badge-charge-val"></div>
            <div id="badge-attack-val"></div>
            <div id="badge-guard-val"></div>
            <div id="badge-skill-val"></div>
            <div id="cmd-CHARGE"></div>
            <div id="cmd-ATTACK"></div>
            <div id="cmd-GUARD"></div>
            <div id="cmd-SKILL"></div>
            <div id="eff-charge"></div>
            <div id="eff-attack"></div>
            <div id="eff-skill"></div>
            <button id="btn-ready"></button>
            <div id="player-effects-display"></div>
            <div id="cpu-effects-display"></div>
        `;

        // Dummy game state
        gameState.player = { hp: 10, atk: 2, atkC: 2, chgE: 2, grdC: 1, winE: 10, effects: [] };
        gameState.cpu = { hp: 10, atk: 2, atkC: 2, chgE: 2, grdC: 1, winE: 10, effects: [] };
        gameState.pHP = 10;
        gameState.cHP = 10;
        gameState.pEnergy = 0;
        gameState.cEnergy = 0;
        gameState.turn = 1;
        gameState.isProc = false;
        gameState.selectedCmd = null;
        gameState.playerSkill = null;
        gameState.pChar = { skillCostBonus: 0 };
    });

    describe('renderChars', () => {
        it('should render character list into the grid', () => {
            const handleSelect = vi.fn();
            renderChars(handleSelect);

            const grid = document.getElementById('char-grid');
            expect(grid.children.length).toBeGreaterThan(1); // Random + characters
            expect(grid.innerHTML).toContain('Random');
        });
    });

    describe('setMessage', () => {
        it('should update the game message text', () => {
            setMessage('TEST MESSAGE');
            expect(document.getElementById('game-message').innerText).toBe('TEST MESSAGE');
        });
    });

    describe('updateUI', () => {
        it('should update HP bars and text', () => {
            gameState.pHP = 5;
            gameState.cHP = 2;
            updateUI();

            expect(document.getElementById('player-hp-bar').style.width).toBe('50%');
            expect(document.getElementById('cpu-hp-bar').style.width).toBe('20%');
            expect(document.getElementById('player-hp-text').innerText).toBe('HP 5 / 10');
            expect(document.getElementById('cpu-hp-text').innerText).toBe('HP 2 / 10');
        });

        it('should disable buttons when energy is insufficient', () => {
            gameState.pEnergy = 0; // Not enough for ATTACK (cost 2)
            updateUI();

            const attackBtn = document.getElementById('cmd-ATTACK');
            expect(attackBtn.classList.contains('is-disabled')).toBe(true);
        });

        it('should enable ready button when a valid command is selected', () => {
            gameState.pEnergy = 10;
            gameState.selectedCmd = 'CHARGE';
            updateUI();

            expect(document.getElementById('btn-ready').disabled).toBe(false);
        });
    });

    describe('initEnergy', () => {
        it('should create energy dot elements', () => {
            initEnergy();
            const pBar = document.getElementById('player-energy-bar');
            expect(pBar.children.length).toBe(10); // winE is 10
        });
    });
});
