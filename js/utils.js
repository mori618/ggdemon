import { GAME_MODES } from './constants.js';

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
    lives: 0,
    mobDeck: null,
    bossDeck: null,
    // Tracking stats
    enemiesDefeated: 0,
    defeatedBosses: [],
    gold: 0,
    towerMap: [],
    currentMapNode: null,
    currentFloorIndex: 0,
    inBattle: false
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
    let saved = null;
    try {
        saved = localStorage.getItem('bc_high_streak') || sessionStorage.getItem('bc_high_streak');
    } catch (e) { /* storage unavailable */ }
    if (saved) {
        gameState.highStreak = parseInt(saved);
    }
}

export function saveHighStreak(val) {
    try { localStorage.setItem('bc_high_streak', val); } catch (e) { /* storage unavailable */ }
}

const SAVE_KEY = 'ggdemon_save';

export function saveGameState() {
    // オンラインモードはセーブ対象外
    if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) return;
    
    try {
        const data = JSON.stringify(gameState);
        localStorage.setItem(SAVE_KEY, data);
    } catch (e) {
        console.error('Failed to save game state:', e);
    }
}

export function loadGameState() {
    try {
        const data = localStorage.getItem(SAVE_KEY);
        if (!data) return false;
        
        const parsed = JSON.parse(data);
        // 旧バージョンでセーブされたオンライン対戦は再開しない
        if (parsed.gameMode === GAME_MODES.ONLINE_HOST || parsed.gameMode === GAME_MODES.ONLINE_CLIENT) {
            localStorage.removeItem(SAVE_KEY);
            return false;
        }
        Object.assign(gameState, parsed);
        // セーブデータ内の現在ノードをマップ上の実体と結び付け直す
        if (gameState.currentMapNode && Array.isArray(gameState.towerMap)) {
            const id = gameState.currentMapNode.id;
            for (const layer of gameState.towerMap) {
                const found = layer.find(n => n.id === id);
                if (found) { gameState.currentMapNode = found; break; }
            }
        }
        
        // Deckインスタンスの復元
        if (parsed.mobDeck) {
            gameState.mobDeck = new Deck([]);
            Object.assign(gameState.mobDeck, parsed.mobDeck);
        }
        if (parsed.bossDeck) {
            gameState.bossDeck = new Deck([]);
            Object.assign(gameState.bossDeck, parsed.bossDeck);
        }
        return true;
    } catch (e) {
        console.error('Failed to load game state:', e);
        return false;
    }
}

export function clearGameState() {
    localStorage.removeItem(SAVE_KEY);
}

export function hasSaveData() {
    return localStorage.getItem(SAVE_KEY) !== null;
}
