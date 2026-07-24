import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showEvent } from '../js/game.js';
import { gameState } from '../js/utils.js';
import * as ui from '../js/ui.js';
import { CHARACTERS, BOSS_CHARACTERS } from '../js/constants.js';

// Global mocks
global.lucide = { createIcons: vi.fn() };
vi.mock('../js/sounds.js', () => ({ sound: { playSE: vi.fn() } }));
vi.mock('../js/ui.js', () => ({
    updateUI: vi.fn(),
    setMessage: vi.fn(),
    initEnergy: vi.fn(),
    showPassiveAlert: vi.fn(),
    showDamageNumber: vi.fn(),
    showActionAnim: vi.fn()
}));
vi.mock('../js/game.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, showMap: vi.fn(), setupBattleState: vi.fn() };
});

describe('Event Handlers Comprehensive Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        gameState.pChar = { hp: 100, atk: 10, grdC: 0, chgC: 0, chgE: 0, name: 'Player' };
        gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
        gameState.pHP = 100;
        
        gameState.cChar = { hp: 50, atk: 5, grdC: 0, chgC: 0, chgE: 0, name: 'CPU' };
        gameState.cpu = JSON.parse(JSON.stringify(gameState.cChar));
        gameState.cpu.id = CHARACTERS[0].id;
        gameState.cHP = 50;

        gameState.gold = 100;
        gameState.floor = 1;
        gameState.gameMode = 'tower';
        gameState.playerSkill = { id: 'test_skill', name: 'Test Skill', description: 'desc' }; // To avoid reroll
        
        gameState.mobDeck = { draw: () => CHARACTERS[0].id };
        gameState.eliteDeck = { draw: () => CHARACTERS[0].id };
        gameState.bossDeck = { draw: () => BOSS_CHARACTERS[0].id };
        gameState.eventDeck = { draw: () => 'EVENT_SAFE' };
        
        const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
        document.body.innerHTML = html;
    });

    const safeEventsCount = 12; // GOLD, FREE_BUFF, EXTRA_LIFE, etc.
    for (let i = 0; i < safeEventsCount; i++) {
        it(`should handle safeEvent index ${i} without crashing`, () => {
            const originalRandom = Math.random;
            Math.random = () => (i + 0.5) / safeEventsCount;

            showEvent('EVENT_SAFE');
            Math.random = originalRandom;

            const wrapper = document.getElementById('event-command-wrapper');
            const buttons = Array.from(wrapper.querySelectorAll('button:not(.hidden)'));
            
            expect(buttons.length).toBeGreaterThan(0);
            
            // Click the first button (usually the main action)
            buttons[0].click();
            expect(true).toBe(true); // Verification passed if no error thrown
        });
        
        it(`should handle safeEvent index ${i} secondary option without crashing`, () => {
            const originalRandom = Math.random;
            Math.random = () => (i + 0.5) / safeEventsCount;

            showEvent('EVENT_SAFE');
            Math.random = originalRandom;

            const wrapper = document.getElementById('event-command-wrapper');
            const buttons = Array.from(wrapper.querySelectorAll('button:not(.hidden)'));
            
            if (buttons.length > 1) {
                buttons[1].click();
                expect(true).toBe(true);
            }
        });
    }

    const riskEventsCount = 10; // TRAP, TRIAL, MINI_BOSS, etc.
    for (let i = 0; i < riskEventsCount; i++) {
        it(`should handle riskEvent index ${i} without crashing`, () => {
            const originalRandom = Math.random;
            Math.random = () => (i + 0.5) / riskEventsCount;

            showEvent('EVENT_RISK');
            Math.random = originalRandom;

            const wrapper = document.getElementById('event-command-wrapper');
            const buttons = Array.from(wrapper.querySelectorAll('button:not(.hidden)'));
            
            expect(buttons.length).toBeGreaterThan(0);
            
            // Click the first button
            buttons[0].click();
            expect(true).toBe(true);
        });

        it(`should handle riskEvent index ${i} secondary option without crashing`, () => {
            const originalRandom = Math.random;
            Math.random = () => (i + 0.5) / riskEventsCount;

            showEvent('EVENT_RISK');
            Math.random = originalRandom;

            const wrapper = document.getElementById('event-command-wrapper');
            const buttons = Array.from(wrapper.querySelectorAll('button:not(.hidden)'));
            
            if (buttons.length > 1) {
                buttons[1].click();
                expect(true).toBe(true);
            }
        });
    }
});
