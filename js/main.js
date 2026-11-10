import { CHARACTERS, GAME_MODES, BOSS_CHARACTERS } from './constants.js';
import { downloadLastLog, downloadAllLogs } from './battleLog.js';
import { sound } from './sounds.js';
import { gameState, loadHighStreak, Deck, hasSaveData, loadGameState, clearGameState, saveGameState } from './utils.js';
import { syncAudioUI, renderChars, updateUI, showCommandDetail, setMessage } from './ui.js';
import { setupBattleState, getCpuMove, executeTurn, generateTowerMap, showMap, resumeGame } from './game.js';
import { online } from './online/controller.js';

window.onload = () => {
    lucide.createIcons();
    renderChars(handleCharSelect);
    loadHighStreak();
    syncAudioUI();
    online.init({ showCharSelect: showOnlineCharSelect, closePause: () => { if (gameState.isPaused) window.togglePause(); } });

    if (hasSaveData()) {
        const btn = document.getElementById('continue-btn');
        btn.classList.remove('hidden');
        // ローカルストレージの内容を少し見てモードを判別する
        try {
            const data = JSON.parse(localStorage.getItem('ggdemon_save'));
            if (data.gameMode === 'normal') {
                btn.innerText = 'CONTINUE (VS CPU)';
            } else if (data.gameMode === 'tower') {
                btn.innerText = 'CONTINUE (TOWER)';
            }
        } catch (e) {
            btn.innerText = 'CONTINUE';
        }
    }
};

window.debugForceEvent = async () => {
    const eType = prompt("強制発生させるイベントIDを入力してください\n(例: GOLD, SHOP, REST, TREASURE, WEAK_ENEMY, TRIAL...)");
    if (!eType) return;
    
    // Close map if open
    const mapOverlay = document.getElementById('map-overlay');
    if (mapOverlay) mapOverlay.classList.add('hidden');
    
    const game = await import('./game.js');
    if (eType === 'SHOP') {
        game.handleShopRoom();
    } else if (eType === 'TREASURE') {
        // Need to set a dummy node to avoid errors
        gameState.currentMapNode = { type: 'TREASURE', floor: gameState.floor };
        game.handleTreasureRoom();
    } else {
        game.showEvent(null, eType);
    }
};

// オンライン対戦（処理の本体は js/online/controller.js）
window.showOnlineMenu = () => online.openLobby();
window.exitOnline = () => online.exit();
window.onlineStart = (mode) => online.start(mode);
window.onlineShowFriend = () => online.showFriendMenu();
window.onlineHostRoom = () => online.hostRoom();
window.onlineShowJoin = () => online.showJoin();
window.onlineJoinRoom = () => online.joinRoom();
window.onlineCancel = () => online.cancel();
window.onlineCopyCode = () => online.copyRoomCode();
window.onlineEditName = () => online.editName();
window.onlineShowRanking = () => online.showRanking();
window.onlineBackToLobby = () => online.backToLobby();
window.onlineAgain = () => online.again();

// オンライン対戦用のキャラクター選択画面を開く
function showOnlineCharSelect() {
    gameState.selectionState = 'PLAYER';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('online-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    document.getElementById('difficulty-selector').classList.add('hidden');
    document.getElementById('select-title').innerText = "Select Your Hero";
    renderChars(handleCharSelect);
}

// Global handlers (attached to window for HTML onclick attributes)
window.toggleMute = () => {
    if (sound.isMuted) sound.unmute();
    else sound.mute();
    syncAudioUI();
};

window.changeVolume = (val) => {
    const v = val / 100;
    sound.setVolume(v);
    syncAudioUI();
};

window.showTutorial = () => {
    sound.playSE('click');
    document.getElementById('tutorial-screen').classList.add('active-overlay');
    lucide.createIcons();
};

window.hideTutorial = () => {
    sound.playSE('click');
    document.getElementById('tutorial-screen').classList.remove('active-overlay');
};

window.goToSelection = (mode) => {
    sound.playSE('click');
    if (mode === 'normal' || mode === 'tower') {
        clearGameState(); // 新規スタート時は古いセーブを消去
    }
    gameState.gameMode = mode;
    gameState.selectionState = 'PLAYER';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('online-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    document.getElementById('difficulty-selector').classList.add('hidden');
    document.getElementById('select-title').innerText = "Select Your Hero";
    renderChars(handleCharSelect);
};

window.downloadBattleLog = () => {
    sound.playSE('click');
    if (!downloadLastLog()) alert('まだバトルログがありません');
};

window.downloadAllBattleLogs = () => {
    sound.playSE('click');
    if (!downloadAllLogs()) alert('まだバトルログがありません');
};

window.setAiLevel = (lv) => {
    sound.playSE('click');
    gameState.aiLevel = lv;
    ['EASY', 'NORMAL', 'HARD', 'MASTER'].forEach(l => {
        document.getElementById(`lvl-${l}`).classList.toggle('selected', l === lv);
    });
};

window.togglePause = () => {
    sound.playSE('click');
    if (gameState.gameOver) return;
    gameState.isPaused = !gameState.isPaused;
    const el = document.getElementById('pause-overlay');
    // オンライン対戦中はやり直し不可。相手は待ってくれないので持ち時間も止まらない
    const inOnlineMatch = online.inMatch();
    document.getElementById('btn-pause-retry').classList.toggle('hidden', inOnlineMatch);
    document.getElementById('btn-pause-title').innerText = inOnlineMatch ? '降参してタイトルへ' : 'タイトルへ';
    if (gameState.isPaused) {
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('opacity-100'), 10);
    } else {
        el.classList.remove('opacity-100');
        setTimeout(() => el.classList.add('hidden'), 300);
    }
};

window.retryGame = () => {
    if (online.isOnlineMode()) return;
    setupBattleState();
    if (gameState.isPaused) window.togglePause();
};

// VS CPU: 同じ組み合わせでもう一度対戦（ランダム選択していた側は再抽選）
window.rematchGame = () => {
    const pickRandom = () => JSON.parse(JSON.stringify(CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]));
    if (gameState.pRandomSelect) gameState.pChar = pickRandom();
    if (gameState.cRandomSelect) gameState.cChar = pickRandom();

    const ov = document.getElementById('result-overlay');
    ov.classList.add('hidden');
    ov.classList.remove('opacity-100');
    sound.playSE('ready');
    setupBattleState();
};

window.restartApp = () => {
    if (online.inMatch() && !window.confirm('対戦中です。降参してタイトルに戻りますか？')) return;
    online.shutdown();
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.remove('opacity-100');
    document.getElementById('pause-overlay').classList.remove('opacity-100');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    gameState.isPaused = false;
};

window.retryTower = () => {
    sound.playSE('click');
    // Reset game state for Tower Mode retry
    gameState.gameOver = false;
    gameState.floor = 0;
    gameState.enemiesDefeated = 0;
    gameState.defeatedBosses = [];
    gameState.playerSkill = null;
    gameState.winsSinceChest = 0;

    // Hide overlays
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.remove('opacity-100');
    document.getElementById('tower-result-stats').classList.add('hidden');

    // Navigate to character selection (keeping tower mode)
    document.getElementById('game-container')?.classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    gameState.selectionState = 'PLAYER';
};

window.openStatusOverlay = (side) => {
    sound.playSE('click');
    const char = (side === 'PLAYER') ? gameState.player : gameState.cpu;
    const baseChar = (side === 'PLAYER') ? gameState.pChar : CHARACTERS.find(c => c.id === gameState.cpu.id) || gameState.cpu;

    const content = document.getElementById('status-info-content');
    content.innerHTML = `
        <div class="flex flex-col items-center">
            <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 border-2 border-slate-700">
                <i data-lucide="${char.icon}" class="w-10 h-10 ${side === 'PLAYER' ? 'text-blue-400' : 'text-rose-500'}"></i>
            </div>
            <h2 class="font-orbitron font-black text-2xl mb-1 uppercase text-white">${char.name}</h2>
            <p class="text-[10px] text-slate-500 italic mb-6">"${baseChar.tagline}"</p>
            <div class="w-full space-y-3 text-left">
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Health</span>
                    <span class="font-black text-white font-orbitron">${char.hp} MAX</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Atk Power</span>
                    <span class="font-black text-rose-400 font-orbitron">${char.atk} DMG</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Atk Cost</span>
                    <span class="font-black text-yellow-400 font-orbitron">${char.atkC} ENERGY</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Charge Efficiency</span>
                    <span class="font-black text-emerald-400 font-orbitron">+${char.chgE} / TURN</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Guard Cost</span>
                    <span class="font-black text-sky-400 font-orbitron">${char.grdC} ENERGY</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest font-orbitron">Victory Goal</span>
                    <span class="font-black text-amber-500 font-orbitron">${char.winE} ENERGY</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('char-status-overlay').classList.add('active-overlay');
    lucide.createIcons();
};

window.closeStatusOverlay = () => {
    sound.playSE('click');
    document.getElementById('char-status-overlay').classList.remove('active-overlay');
};

window.selectCommand = (c) => {
    if (gameState.isProc) return;
    sound.playSE('click');
    if (gameState.selectedCmd === c) {
        gameState.selectedCmd = null;
        showCommandDetail(null);
    } else {
        gameState.selectedCmd = c;
        showCommandDetail(c);
    }
    setMessage("");
    updateUI();
};

window.confirmCommand = () => {
    if (!gameState.selectedCmd || gameState.isProc) return;

    // オンライン対戦: 手を送信して相手を待つ
    if (online.isOnlineMode()) {
        online.submitMove(gameState.selectedCmd);
        return;
    }

    gameState.isProc = true;
    sound.playSE('ready');
    document.getElementById('command-wrapper').classList.add('ui-hidden');
    setMessage("BATTLE!!");
    showCommandDetail(null);
    // CPUの行動を決めた時点で保存し、リロードによるやり直しを防ぐ
    const pM = gameState.selectedCmd;
    const cM = getCpuMove();
    gameState.pendingTurn = { pM, cM };
    saveGameState();
    setTimeout(() => executeTurn(pM, cM), 300);
};

window.backToTitle = () => {
    sound.playSE('click');
    if (online.isOnlineMode()) {
        // オンライン対戦のキャラクター選択から戻る → ロビーへ（部屋に入っていれば退出する）
        online.onBackFromSelect();
        return;
    }
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    gameState.selectionState = 'PLAYER';
};

window.confirmCharChoice = (id) => {
    const char = (id === 'RANDOM') ? { name: 'RANDOM SELECT' } : CHARACTERS.find(c => c.id === id);
    const overlay = document.getElementById('confirm-overlay');
    const msg = document.getElementById('confirm-dialog-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    msg.innerText = `${char.name} にしますか？`;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('opacity-100'), 10);

    okBtn.onclick = () => {
        sound.playSE('click');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        executeCharSelect(id);
    };

    cancelBtn.onclick = () => {
        sound.playSE('click');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    };
};

function handleCharSelect(id) {
    confirmCharChoice(id);
}

function executeCharSelect(id) {
    let selected = (id === 'RANDOM') ? CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)] : CHARACTERS.find(c => c.id === id);

    // オンライン対戦: 選んだキャラクターを通知して対戦開始を待つ
    if (online.isOnlineMode()) {
        online.onCharChosen(selected.id);
        return;
    }

    if (gameState.selectionState === 'PLAYER') {
        gameState.pChar = JSON.parse(JSON.stringify(selected));
        gameState.pRandomSelect = (id === 'RANDOM');
        if (gameState.gameMode === GAME_MODES.TOWER) {
            // タワーモードの場合は難易度選択を表示
            document.getElementById('select-screen').classList.add('hidden');
            document.getElementById('tower-difficulty-screen').classList.remove('hidden');
        } else {
            gameState.selectionState = 'CPU';
            document.getElementById('select-title').innerText = "Pick CPU Hero";
            document.getElementById('difficulty-selector').classList.remove('hidden');
            renderChars(handleCharSelect);
        }
    } else {
        gameState.cChar = JSON.parse(JSON.stringify(selected));
        gameState.cRandomSelect = (id === 'RANDOM');
        // キャラを選び直したら連戦成績をリセット
        gameState.series = { wins: 0, losses: 0, draws: 0, history: [] };
        startGame();
    }
}

window.selectTowerDifficulty = (diff) => {
    sound.playSE('click');
    document.getElementById('tower-difficulty-screen').classList.add('hidden');
    startTower(diff);
};

window.cancelDifficultySelection = () => {
    sound.playSE('click');
    document.getElementById('tower-difficulty-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
};

function startTower(diff = 'NORMAL') {
    gameState.floor = 0;
    gameState.currentFloorIndex = 0;
    gameState.towerDifficulty = diff;
    gameState.gold = 0;

    // 難易度に応じた残機設定
    if (diff === 'EASY') gameState.lives = 3;
    else if (diff === 'HARD') gameState.lives = 1;
    else gameState.lives = 2; // NORMAL

    gameState.winStreak = 0;
    gameState.winsSinceChest = 0;
    gameState.playerSkill = null;
    gameState.aiLevel = 'NORMAL';
    gameState.pHP = gameState.pChar.hp; // タワーではHPを持ち越す
    gameState.player = { ...JSON.parse(JSON.stringify(gameState.pChar)), effects: [] };
    gameState.inBattle = false;
    gameState.nextBattleEffects = [];
    gameState.nextBattleMod = null;
    gameState.nextBattleIsElite = false;
    gameState.nextBattleIsWeak = false;
    gameState.pendingTurn = null;
    gameState.pendingVictory = false;
    gameState.pendingTreasure = null;
    gameState.currentBattle = null;
    
    // Tower Stats reset
    gameState.enemiesDefeated = 0;
    gameState.defeatedBosses = [];

    // Initialize Decks
    gameState.mobDeck = new Deck(CHARACTERS.map(c => c.id));
    gameState.bossDeck = new Deck(BOSS_CHARACTERS.map(c => c.id));

    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('tower-indicator').classList.remove('hidden');
    
    // マップの生成と表示
    gameState.towerMap = generateTowerMap(7);
    gameState.currentMapNode = gameState.towerMap[0][0]; // START node
    
    showMap();
}

function startGame() {
    sound.playSE('ready');
    document.getElementById('select-screen').classList.add('hidden');
    setupBattleState();
}

window.continueGame = () => {
    sound.playSE('click');
    if (loadGameState()) {
        resumeGame();
    }
};
