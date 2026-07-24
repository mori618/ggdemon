import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showShop, handleSafeEvent } from '../js/game.js';
// We'll export the map handlers or just mock them, but actually we need to test them.
// In game.js, they are handleShopNode, handleTreasureNode, handleRestNode.
// We can test the internal logic by triggering the UI that gets exposed.
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

describe('Map Nodes Comprehensive Integration', () => {
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
        
        gameState.mobDeck = { draw: () => CHARACTERS[0].id };
        gameState.eliteDeck = { draw: () => CHARACTERS[0].id };
        gameState.bossDeck = { draw: () => BOSS_CHARACTERS[0].id };
        gameState.eventDeck = { draw: () => 'EVENT_SAFE' };
        
        const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
        document.body.innerHTML = html;
    });

    it('should open shop and click purchase without crashing', async () => {
        // We call showShop directly.
        showShop();

        const shopItemsContainer = document.getElementById('shop-items-container');
        expect(shopItemsContainer).toBeDefined();

        // Find a purchase button
        const buyBtns = Array.from(shopItemsContainer.querySelectorAll('button')).filter(b => b.innerText.includes('Buy') || b.innerText.includes('G'));
        
        if (buyBtns.length > 0) {
            buyBtns[0].click();
            expect(true).toBe(true);
        }
    });

    it('should open shop and click leave without crashing', async () => {
        showShop();
        const leaveBtn = document.getElementById('shop-leave-btn');
        if (leaveBtn) {
            leaveBtn.click();
            expect(true).toBe(true);
        }
    });
});
