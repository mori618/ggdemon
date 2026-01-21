import { describe, it, expect, vi } from 'vitest';
import { generateTowerEnemy } from '../js/logic.js';
import { SKILLS, CHARACTERS, BOSS_CHARACTERS } from '../js/constants.js';

class MockDeck {
    constructor(ids) { this.ids = ids; }
    draw() { return this.ids[0]; }
}

describe('Tower Difficulty Logic', () => {
    const mobDeck = new MockDeck(['NORMAL']);
    const bossDeck = new MockDeck(['VOID_EATER']);

    describe('generateTowerEnemy scaling', () => {
        it('should have higher HP in HARD than EASY on the same floor', () => {
            const floor = 10;
            const easy = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'EASY');
            const hard = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'HARD');

            expect(hard.cpu.hp).toBeGreaterThan(easy.cpu.hp);
        });

        it('should have different AI levels based on difficulty', () => {
            const floor = 5; // Boss floor
            const easy = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'EASY');
            const hard = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'HARD');

            expect(easy.aiLevel).toBe('EASY');
            expect(hard.aiLevel).toBe('HARD');
        });

        it('should apply more traits in HARD difficulty (Floor 3)', () => {
            const floor = 3;
            // Floor 3 base traitCount = 0
            // Easy = 0 traits, Hard = 1 traits

            const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

            const easy = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'EASY');
            const hard = generateTowerEnemy(floor, mobDeck, bossDeck, false, 'HARD');

            // Hard should have more traits than Easy
            expect(hard.cpu.name.length).toBeGreaterThan(easy.cpu.name.length);
            expect(easy.cpu.name).toBe('Normal');
            expect(hard.cpu.name).toContain('迅雷の');

            spy.mockRestore();
        });
    });
});
