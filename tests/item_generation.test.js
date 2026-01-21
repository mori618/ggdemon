
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTreasureOptions } from '../js/game.js';
import { gameState } from '../js/utils.js';
import { ITEM_EFFECTS, RISK_MAPPING } from '../js/constants.js';

// Mock DOM elements required by game.js logic if any (though generateTreasureOptions should be pure logic usually, but sometimes accesses DOM indirectly via UI calls if entangled)
// Based on previous code, generateTreasureOptions updates UI? No, showTreasure does. generateTreasureOptions returns options array.
// So we should be safe.

describe('Item Generation Logic', () => {
    beforeEach(() => {
        // Reset gameState
        gameState.pChar = {
            hp: 20,
            atk: 5,
            level: 1,
            maxHp: 20,
            skillCostBonus: 0,
            grdC: 1,
            atkC: 1,
            chgE: 2,
            winE: 10,
            startE: 0
        };
        gameState.playerSkill = {
            name: 'Test Skill',
            cost: 3 // Default cost > 1
        };
        gameState.floor = 1;
        gameState.winsSinceChest = 3;
    });

    it('should NOT generate SKILL_COST_DOWN if skill cost is 1 or less', () => {
        // Set skill cost to 1 (effectively 1 with bonus 0)
        gameState.playerSkill.cost = 1;
        gameState.pChar.skillCostBonus = 0;

        // Run multiple times to ensure it never appears (statistically)
        for (let i = 0; i < 50; i++) {
            const options = generateTreasureOptions(false, false, false);
            const costDownItems = options.filter(o => o.type === 'item' && o.merit.id === 'SKILL_COST_DOWN');
            expect(costDownItems.length).toBe(0);
        }

        // Set skill cost to 0
        gameState.playerSkill.cost = 0;
        for (let i = 0; i < 50; i++) {
            const options = generateTreasureOptions(false, false, false);
            const costDownItems = options.filter(o => o.type === 'item' && o.merit.id === 'SKILL_COST_DOWN');
            expect(costDownItems.length).toBe(0);
        }
    });

    it('should generate SKILL_COST_DOWN if skill cost is > 1', () => {
        gameState.playerSkill.cost = 2;

        // We can't guarantee it appears in one run, but with many runs it should appear eventually.
        let appeared = false;
        for (let i = 0; i < 200; i++) {
            const options = generateTreasureOptions(false, false, false);
            if (options.some(o => o.type === 'item' && o.merit.id === 'SKILL_COST_DOWN')) {
                appeared = true;
                break;
            }
        }
        expect(appeared).toBe(true);
    });

    it('should preferentially select mapped risks for a given merit', () => {
        // Test with ATK_UP which maps to ['HP_DOWN', 'ATKC_UP', 'CHGE_DOWN', 'SKILL_EFFECT_DOWN']
        // We need to force a scenario where we pick ATK_UP logic or simply check the statistical outcome.
        // It's hard to force specific merit selection without mocking Math.random inside the function.
        // Let's mock Math.random to control merit selection partially or just observe many runs.

        let atkUpCount = 0;
        let mappedRiskCount = 0;
        const mappedRisks = RISK_MAPPING['ATK_UP'];

        for (let i = 0; i < 500; i++) {
            const options = generateTreasureOptions(false, false, false);
            options.forEach(opt => {
                if (opt.type === 'item' && opt.merit.id === 'ATK_UP' && opt.demerit) {
                    atkUpCount++;
                    if (mappedRisks.includes(opt.demerit.id)) {
                        mappedRiskCount++;
                    }
                }
            });
        }

        // We expect high correlation but due to random other items appearing it might be diluted?
        // No, for a specific item pair, if ATK_UP is chosen, demerit logic runs.
        // Logic says 70% chance to pick from mapped risks.
        // So mappedRiskCount / atkUpCount should be close to 0.7 or higher (since they might also be picked by fallback random chance).

        if (atkUpCount > 0) {
            const ratio = mappedRiskCount / atkUpCount;
            // console.log(`ATK_UP Count: ${atkUpCount}, Mapped Risk Count: ${mappedRiskCount}, Ratio: ${ratio}`);
            expect(ratio).toBeGreaterThan(0.6);
        }
    });

    it('should include enemiesDefeated and defeatedBosses in stats', () => {
        // Check initial state
        // Actually this tests gameState structure more than logic, but good sanity check
        expect(gameState.enemiesDefeated).toBeDefined();
        // Default might be undefined until initialized in game or main?
        // We initialized in utils.js but that object is imported.
        // Actually in utils.js we set them.

        // Let's mock a victory update flow
        gameState.enemiesDefeated = 5;
        gameState.defeatedBosses = ['skull'];
        expect(gameState.enemiesDefeated).toBe(5);
        expect(gameState.defeatedBosses).toContain('skull');
    });
});
