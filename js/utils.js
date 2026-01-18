export const gameState = {
    selectionState: 'PLAYER',
    aiLevel: 'NORMAL',
    gameMode: 'normal',
    winStreak: 0,
    highStreak: 0,
    pChar: null,
    cChar: null,
    player: null,
    cpu: null,
    pHP: 0,
    cHP: 0,
    pEnergy: 0,
    cEnergy: 0,
    turn: 1,
    selectedCmd: null,
    isProc: false,
    gameOver: false,
    isPaused: false,
    floor: 1,
    winsSinceChest: 0,
    playerSkill: null,
    playerHistory: [],
    treasureFloorOffset: 0, // Offset within a 5-floor cycle (0-4, but Floor 5/10 are bosses)
    mobDeck: null,
    bossDeck: null
};

export class Deck {
    constructor(items) {
        this.masterList = [...items];
        this.currentDeck = [];
    }

    draw() {
        if (this.currentDeck.length === 0) {
            this.currentDeck = this.shuffle([...this.masterList]);
        }
        return this.currentDeck.pop();
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }
}

export const MAX_HISTORY = 5;

export function loadHighStreak() {
    const saved = sessionStorage.getItem('bc_high_streak');
    if (saved) {
        gameState.highStreak = parseInt(saved);
    }
}

export function saveHighStreak(val) {
    sessionStorage.setItem('bc_high_streak', val);
}
