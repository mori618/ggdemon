import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTreasureOptions, selectTreasure, showTreasure } from '../js/game.js';
import { gameState } from '../js/utils.js';
import { SKILLS, ITEM_EFFECTS } from '../js/constants.js';

// Mocks
vi.mock('../js/sounds.js', () => ({
    sound: { playSE: vi.fn() }
}));

// Mock globally used functions if any
global.lucide = { createIcons: vi.fn() };

describe('Boss Reward Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="treasure-overlay">
                <h2>Title</h2>
                <p>Desc</p>
                <div id="treasure-cards-container"></div>
            </div>
        `;

        // Reset gameState
        Object.assign(gameState, {
            floor: 5, // Boss floor
            cpu: { id: 'BOSS' },
            pChar: { hp: 10, atk: 2 },
            playerSkill: null,
            towerDifficulty: 'NORMAL',
            winStreak: 0
        });
    });

    describe('generateTreasureOptions for Boss', () => {
        it('should generate items without demerits for boss phase 1', () => {
            const options = generateTreasureOptions(false, true, false);
            expect(options.length).toBe(3);
            options.forEach(opt => {
                expect(opt.type).toBe('item');
                expect(opt.demerit).toBeNull();
            });
        });

        it('should generate 1 LEGENDARY and 2 EPIC skills for forceSkillPhase', () => {
            const options = generateTreasureOptions(false, true, true);
            expect(options.length).toBe(3);

            const rarities = options.map(opt => opt.skill.rarity);
            expect(rarities.filter(r => r === 'LEGENDARY').length).toBe(1);
            expect(rarities.filter(r => r === 'EPIC').length).toBe(2);
        });

        it('should include at least one exclusive skill in boss skill phase', () => {
            const exclusiveIds = ['PHANTOM_STEP', 'GRAVITY_ZONE', 'GAMBLER', 'OVERCLOCK', 'ZERO_FORM', 'MIRAGE'];
            // Run multiple times to reduce chance of lucky pass
            for (let i = 0; i < 10; i++) {
                const options = generateTreasureOptions(false, true, true);
                const hasExclusive = options.some(opt => exclusiveIds.includes(opt.skill.id));
                expect(hasExclusive).toBe(true);
            }
        });
    });

    describe('selectTreasure boss flow', () => {
        it('should transition to skill phase after picking an item from boss', () => {
            // Need to mock showTreasure for this part if possible, 
            // but selectTreasure calls showTreasure(true).
            // Since we imported it from the same file, we can't easily spy on it unless we export it differently or use a workaround.
            // But we can check if it successfully calls the logic that would trigger showTreasure.

            const reward = { type: 'item', merit: { apply: vi.fn(), valueRange: [1, 1] }, value: 1 };

            // We can't easily verify the showTreasure(true) call here without complex mocking,
            // but we can check if it DOES NOT increment floor immediately.
            const initialFloor = gameState.floor;
            selectTreasure(reward);

            // Should stay on same floor to show second phase
            expect(gameState.floor).toBe(initialFloor);
        });
    });
});
