import { CHARACTERS, GAME_MODES, NETWORK_EVENTS } from './constants.js';
import { sound } from './sounds.js';
import { gameState, loadHighStreak } from './utils.js';
import { syncAudioUI, renderChars, updateUI, showCommandDetail, setMessage, addLog } from './ui.js';
import { setupBattleState, getCpuMove, executeTurn } from './game.js';
import { network } from './network.js';

window.onload = () => {
    lucide.createIcons();
    renderChars(handleCharSelect);
    loadHighStreak();
    syncAudioUI();

    // Setup network logger
    network.setOnLog((msg) => addLog(msg));
};

// Online UI Handlers
window.showOnlineMenu = () => {
    sound.playSE('click');
    document.getElementById('title-screen').classList.add('hidden');
    const onlineScreen = document.getElementById('online-screen');
    onlineScreen.classList.remove('hidden');

    // Reset to step 1
    document.getElementById('online-step-1').classList.remove('hidden');
    document.getElementById('online-step-host').classList.add('hidden');
    document.getElementById('online-step-client').classList.add('hidden');
};

window.exitOnline = () => {
    sound.playSE('click');
    document.getElementById('online-screen').classList.add('hidden');
    document.getElementById('online-step-connecting').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    // Disconnect if active
    if (network.peer) {
        network.peer.destroy();
        network.peer = null;
    }
};

window.setupOnline = (role) => {
    sound.playSE('click');
    document.getElementById('online-step-1').classList.add('hidden');

    if (role === 'HOST') {
        document.getElementById('online-step-host').classList.remove('hidden');
        network.init(true, (id) => {
            document.getElementById('host-id-display').innerText = id;
        });

        network.setOnConnect((peerId) => {
            console.log('Opponent connected:', peerId);
            gameState.gameMode = GAME_MODES.ONLINE_HOST;
            gameState.selectionState = 'PLAYER';
            network.send(NETWORK_EVENTS.CONNECTED, {});
            goToSelection(GAME_MODES.ONLINE_HOST);
        });
    } else {
        document.getElementById('online-step-client').classList.remove('hidden');
        // Client peer will be created when joining
    }
};

window.joinRoom = () => {
    const id = document.getElementById('join-id-input').value.trim().toLowerCase();
    if (!id) return;
    sound.playSE('click');

    // Show connecting screen
    document.getElementById('online-step-client').classList.add('hidden');
    document.getElementById('online-step-connecting').classList.remove('hidden');
    document.getElementById('connecting-room-id').innerText = id;

    // Initialize peer for client and connect after it's ready
    network.init(false, () => {
        network.connect(id);
    });

    network.setOnConnect((peerId) => {
        console.log('Connected to host:', peerId);
        gameState.gameMode = GAME_MODES.ONLINE_CLIENT;
        gameState.selectionState = 'PLAYER';
        // Wait for host to send CONNECTED (or sending it ourselves is fine too)
    });
};

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
    gameState.gameMode = mode;
    gameState.selectionState = 'PLAYER';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('online-screen').classList.add('hidden');
    document.getElementById('online-step-connecting').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    document.getElementById('difficulty-selector').classList.add('hidden');
    document.getElementById('select-title').innerText = "Select Your Hero";
    renderChars(handleCharSelect);
};

window.setAiLevel = (lv) => {
    sound.playSE('click');
    gameState.aiLevel = lv;
    ['EASY', 'NORMAL', 'HARD'].forEach(l => {
        document.getElementById(`lvl-${l}`).classList.toggle('selected', l === lv);
    });
};

window.togglePause = () => {
    sound.playSE('click');
    if (gameState.gameOver) return;
    gameState.isPaused = !gameState.isPaused;
    const el = document.getElementById('pause-overlay');
    if (gameState.isPaused) {
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('opacity-100'), 10);
    } else {
        el.classList.remove('opacity-100');
        setTimeout(() => el.classList.add('hidden'), 300);
    }
};

window.retryGame = () => {
    setupBattleState();
    if (gameState.isPaused) window.togglePause();
};

window.restartApp = () => {
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    gameState.isPaused = false;
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

    // Online Battle Handling
    if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
        if (gameState.myMoveCommitted) return; // Prevent double commit

        sound.playSE('ready');
        gameState.myMoveCommitted = true;
        document.getElementById('command-wrapper').classList.add('ui-hidden');
        showCommandDetail(null);
        setMessage("Waiting for opponent...");

        // 1. Send Commit
        network.send(NETWORK_EVENTS.MOVE_COMMIT, {});

        // 2. If opponent already committed, we can reveal our move now
        if (gameState.opponentCommitted) {
            network.send(NETWORK_EVENTS.MOVE_REVEAL, { move: gameState.selectedCmd });
        }
        return;
    }

    gameState.isProc = true;
    sound.playSE('ready');
    document.getElementById('command-wrapper').classList.add('ui-hidden');
    setMessage("BATTLE!!");
    showCommandDetail(null);
    setTimeout(() => executeTurn(gameState.selectedCmd, getCpuMove()), 300);
};

function handleCharSelect(id) {
    sound.playSE('click');
    let selected = (id === 'RANDOM') ? CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)] : CHARACTERS.find(c => c.id === id);

    // Online Config Handling
    if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
        gameState.pChar = selected;
        // Send selection to opponent
        network.send(NETWORK_EVENTS.CHAR_SELECT, { charId: selected.id });

        // Show waiting message
        setMessage("Waiting for opponent...");
        document.getElementById('select-title').innerText = "Waiting for Opponent...";
        document.getElementById('char-grid').classList.add('pointer-events-none', 'opacity-50');

        gameState.pSelected = true;
        checkOnlineStart();
        return;
    }

    if (gameState.selectionState === 'PLAYER') {
        gameState.pChar = selected;
        if (gameState.gameMode === 'tower') {
            startTower();
        } else {
            gameState.selectionState = 'CPU';
            document.getElementById('select-title').innerText = "Pick CPU Hero";
            document.getElementById('difficulty-selector').classList.remove('hidden');
            renderChars(handleCharSelect);
        }
    } else {
        gameState.cChar = selected;
        startGame();
    }
}

function checkOnlineStart() {
    if (gameState.pSelected && gameState.cSelected) {
        setTimeout(() => {
            startGame();
        }, 500);
    }
}

// Network Data Handler
network.setOnData((data) => {
    const { type, payload } = data;
    console.log('CMD RECEIVED:', type, payload);

    if (type === NETWORK_EVENTS.CONNECTED) {
        if (gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
            goToSelection(GAME_MODES.ONLINE_CLIENT);
        }
    }
    else if (type === NETWORK_EVENTS.CHAR_SELECT) {
        const charId = payload.charId;
        const selected = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0]; // Fallback
        gameState.cChar = selected;
        gameState.cSelected = true;
        checkOnlineStart();
    }
    else if (type === NETWORK_EVENTS.MOVE_COMMIT) {
        // Opponent selected a move
        gameState.opponentCommitted = true;
        setMessage("Opponent Ready!");
        // If I have also committed, exchange moves
        if (gameState.myMoveCommitted) {
            network.send(NETWORK_EVENTS.MOVE_REVEAL, { move: gameState.selectedCmd });
        }
    }
    else if (type === NETWORK_EVENTS.MOVE_REVEAL) {
        const opponentMove = payload.move;
        executeTurn(gameState.selectedCmd, opponentMove);
        gameState.opponentCommitted = false;
        gameState.myMoveCommitted = false;
        // gameState.selectedCmd is cleared in executeTurn
    }
});

function startTower() {
    gameState.floor = 0;
    gameState.winStreak = 0;
    gameState.winsSinceChest = 0;
    gameState.playerSkill = null;
    gameState.aiLevel = 'NORMAL';
    gameState.cChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('tower-indicator').classList.remove('hidden');
    setupBattleState();
}

function startGame() {
    sound.playSE('ready');
    document.getElementById('select-screen').classList.add('hidden');
    setupBattleState();
}
