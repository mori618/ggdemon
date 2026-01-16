import { CHARACTERS, ENEMY_TRAITS, BOSS_CHARACTERS, SKILLS, ITEM_EFFECTS, TREASURE_MONSTER, GAME_MODES, PASSIVE_SKILLS } from './constants.js';
import { gameState, saveHighStreak } from './utils.js';
import { sound } from './sounds.js';
import { setMessage, updateUI, initEnergy } from './ui.js';
import { calculateTurnResult, updateEffects, getCpuMoveLogic, generateTowerEnemy } from './logic.js';

export function setupBattleState() {
    gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
    gameState.player.effects = [];
    gameState.player.tempAtk = gameState.player.tempGrdC = gameState.player.tempChgE = gameState.player.tempChgC = gameState.player.tempDmgReduce = 0;

    const isBoss = (gameState.gameMode === 'tower' && gameState.floor > 0 && gameState.floor % 5 === 0);
    let baseCpu;

    if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
        // Online: cChar is set via network sync
        baseCpu = JSON.parse(JSON.stringify(gameState.cChar));
    } else if (gameState.gameMode === 'tower') {
        const cyclePos = (gameState.floor - 1) % 5;
        if (cyclePos === 0 && !isBoss && gameState.floor > 0) {
            gameState.treasureFloorOffset = Math.floor(Math.random() * 4);
        }

        const isTreasure = (!isBoss && gameState.floor > 0 && cyclePos === gameState.treasureFloorOffset);

        const result = generateTowerEnemy(gameState.floor, gameState.mobDeck, gameState.bossDeck, isTreasure);
        baseCpu = result.cpu;
        gameState.aiLevel = result.aiLevel;

        if (baseCpu.passive) {
            baseCpu.passive.apply(baseCpu, gameState.player);
        }
    } else {
        baseCpu = JSON.parse(JSON.stringify(gameState.cChar));
    }

    gameState.cpu = JSON.parse(JSON.stringify(baseCpu));
    gameState.cpu.effects = [];
    gameState.cpu.tempAtk = gameState.cpu.tempGrdC = gameState.cpu.tempChgE = gameState.cpu.tempChgC = gameState.cpu.tempDmgReduce = 0;
    gameState.cpuHistory = [];


    document.getElementById('cmd-SKILL').classList.toggle('hidden', gameState.gameMode !== 'tower');
    document.getElementById('tower-indicator').classList.toggle('hidden', gameState.gameMode !== 'tower');

    const badge = document.getElementById('cpu-level-badge');
    badge.classList.remove('bg-purple-600', 'animate-pulse', 'bg-slate-700', 'bg-rose-600', 'bg-amber-600', 'bg-blue-600');

    if (gameState.gameMode === 'tower') {
        document.getElementById('current-floor-val').innerText = gameState.floor;
        const bossIn = 5 - ((gameState.floor - 1) % 5);
        document.getElementById('boss-in-val').innerText = isBoss ? 'BOSS' : bossIn;

        let badgeText = `FLOOR ${gameState.floor}`;
        let badgeClass = 'bg-slate-700';

        if (gameState.floor === 0) {
            badgeText = 'START';
            badgeClass = 'bg-amber-600';
        } else if (isBoss) {
            badgeText = 'BOSS';
            badgeClass = 'bg-purple-600 animate-pulse';
        } else if (gameState.cpu.id === TREASURE_MONSTER.id) {
            badgeText = 'TREASURE';
            badgeClass = 'bg-amber-600';
        }

        badge.innerText = badgeText;
        badge.classList.add(...badgeClass.split(' '));
        badge.classList.remove('hidden');
    } else if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
        gameState.playerSkill = null;
        badge.innerText = "PLAYER 2";
        badge.classList.add('bg-blue-600');
        badge.classList.remove('hidden');
    } else {
        gameState.playerSkill = null;
        badge.innerText = gameState.aiLevel;
        badge.classList.add('bg-rose-600');
        badge.classList.remove('hidden');
    }

    gameState.pHP = gameState.player.hp;
    gameState.cHP = gameState.cpu.hp;
    gameState.pEnergy = gameState.player.startE;
    gameState.cEnergy = gameState.cpu.startE;
    gameState.turn = 1; gameState.selectedCmd = null; gameState.isProc = false; gameState.gameOver = false;

    document.getElementById('player-name-label').innerText = gameState.player.name;
    document.getElementById('cpu-name-label').innerText = gameState.cpu.name;
    document.getElementById('player-icon-container').innerHTML = `<i data-lucide="${gameState.player.icon}" class="w-16 h-16 md:w-20 md:h-20 text-blue-400"></i>`;
    document.getElementById('cpu-icon-container').innerHTML = `<i data-lucide="${gameState.cpu.icon}" class="w-16 h-16 md:w-20 md:h-20 ${isBoss ? 'text-purple-500' : 'text-rose-500/50'}"></i>`;

    initEnergy();
    updateUI();
    document.getElementById('command-wrapper').classList.remove('ui-hidden');
    document.getElementById('btn-ready').classList.remove('hidden');
    setMessage(isBoss ? "WARNING: BOSS ENCOUNTER" : "Command Select");
    lucide.createIcons();
}

export function getCpuMove() {
    return getCpuMoveLogic({
        player: gameState.player,
        cpu: gameState.cpu,
        pEnergy: gameState.pEnergy,
        cEnergy: gameState.cEnergy,
        aiLevel: gameState.aiLevel,
        gameMode: gameState.gameMode,
        floor: gameState.floor,
        cHP: gameState.cHP,
        pHP: gameState.pHP,
        playerHistory: gameState.playerHistory,
        cpuHistory: gameState.cpuHistory

    });
}

export function executeTurn(pM, cM) {
    // 1. Update Effects
    // 1. Update Effects
    const pUpdate = updateEffects(gameState.player.effects);
    gameState.player.effects = pUpdate.effects;
    Object.assign(gameState.player, pUpdate.totals);

    // Handle Expired Effects (Player)
    if (pUpdate.expired) {
        pUpdate.expired.forEach(ex => {
            if (ex.type === 'DOOM') {
                gameState.pHP = Math.max(0, gameState.pHP - ex.damage);
                gameState.player.hp = gameState.pHP; // Sync
                // Optional: Sound or Visual for Doom triggering
                sound.playSE('clash'); // Generic damage sound for now
            }
        });
    }

    const cUpdate = updateEffects(gameState.cpu.effects);
    gameState.cpu.effects = cUpdate.effects;
    Object.assign(gameState.cpu, cUpdate.totals);

    // Handle Expired Effects (CPU)
    if (cUpdate.expired) {
        cUpdate.expired.forEach(ex => {
            if (ex.type === 'DOOM') {
                gameState.cHP = Math.max(0, gameState.cHP - ex.damage);
                gameState.cpu.hp = gameState.cHP; // Sync
                sound.playSE('clash');
            }
        });
    }

    gameState.playerHistory.push(pM);
    if (gameState.playerHistory.length > 5) gameState.playerHistory.shift();

    gameState.cpuHistory.push(cM);
    if (gameState.cpuHistory.length > 5) gameState.cpuHistory.shift();


    // UI Reveal (Dialog)
    const dialogOverlay = document.getElementById('battle-dialog-overlay');
    const pC = document.getElementById('player-card'), cC = document.getElementById('cpu-card');

    // Dim cards
    pC.classList.add('zone-dim'); cC.classList.add('zone-dim');

    const icons = { 'ATTACK': 'sword', 'CHARGE': 'zap', 'GUARD': 'shield', 'SKILL': 'star' };

    // Inject Dialog Content
    dialogOverlay.innerHTML = `
        <div class="battle-dialog-card battle-reveal">
            <div class="action-icon-box">
                <i data-lucide="${icons[pM]}" class="w-12 h-12 md:w-16 md:h-16 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]"></i>
                <span class="text-[10px] font-black font-orbitron text-blue-200 tracking-widest uppercase">${pM}</span>
            </div>
            <div class="font-orbitron text-3xl font-black italic text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] px-2">VS</div>
            <div class="action-icon-box">
                <i data-lucide="${icons[cM]}" class="w-12 h-12 md:w-16 md:h-16 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]"></i>
                <span class="text-[10px] font-black font-orbitron text-rose-300 tracking-widest uppercase">${cM}</span>
            </div>
        </div>
    `;

    lucide.createIcons();
    dialogOverlay.classList.remove('hidden');
    setTimeout(() => dialogOverlay.classList.remove('opacity-0'), 10);

    // Hide Ready Button (controlled by disabled state in UI)

    setTimeout(() => {
        // 2. Calculate Result
        const result = calculateTurnResult(
            { ...gameState.player, energy: gameState.pEnergy, hp: gameState.pHP, maxHp: gameState.player.hp },
            { ...gameState.cpu, energy: gameState.cEnergy, hp: gameState.cHP },
            pM, cM, gameState.playerSkill
        );

        // Sound effects
        if (pM === 'CHARGE') sound.playSE('charge');
        if (pM === 'ATTACK') sound.playSE('attack');
        if (pM === 'GUARD') sound.playSE('guard');
        if (result.pDmgTaken > 0 || result.cDmgTaken > 0) sound.playSE('clash');

        // Apply results
        gameState.pHP = result.pHP;
        gameState.cHP = result.cHP;
        gameState.pEnergy = result.pEnergy;
        gameState.cEnergy = result.cEnergy;
        gameState.player.effects = result.pEffects;
        gameState.cpu.effects = result.cEffects;

        if (result.pDmgTaken > 0) pC.classList.add('shake');
        if (result.cDmgTaken > 0) cC.classList.add('shake');

        updateUI();
        updateUI();
        pC.classList.remove('zone-dim'); cC.classList.remove('zone-dim');

        setTimeout(() => {
            pC.classList.remove('shake'); cC.classList.remove('shake');
            const cWinF = (gameState.cEnergy >= gameState.cpu.winE);
            if (gameState.pHP <= 0 || gameState.cHP <= 0 || gameState.pEnergy >= gameState.player.winE || cWinF) {
                // 戦闘終了時にダイアログを確実に非表示
                dialogOverlay.classList.add('opacity-0');
                setTimeout(() => dialogOverlay.classList.add('hidden'), 300);
                showFinal(cWinF);
            } else {
                gameState.turn++; gameState.isProc = false; gameState.selectedCmd = null;

                // Hide Dialog
                dialogOverlay.classList.add('opacity-0');
                setTimeout(() => dialogOverlay.classList.add('hidden'), 300);

                document.getElementById('command-wrapper').classList.remove('ui-hidden');

                updateUI();
                setMessage("Command Select");
            }
        }, 500);
    }, 800);
}

function showFinal(cpuEWin) {
    gameState.gameOver = true;

    // バトルダイアログを強制的に非表示
    const dialogOverlay = document.getElementById('battle-dialog-overlay');
    dialogOverlay.classList.add('opacity-0', 'hidden');

    const ov = document.getElementById('result-overlay'), tit = document.getElementById('result-title'), desc = document.getElementById('result-desc'), nextB = document.getElementById('btn-next-stage'), streakB = document.getElementById('streak-result-box');
    let res = "DRAW", d = "SIMULTANEOUS";
    if (gameState.pHP <= 0 && gameState.cHP <= 0) { res = "DRAW"; d = "DOUBLE K.O."; }
    else if (gameState.cHP <= 0) { res = "VICTORY"; d = "ENEMY DESTROYED"; sound.playSE('victory'); }
    else if (gameState.pHP <= 0) { res = "DEFEAT"; d = "HP EXHAUSTED"; sound.playSE('defeat'); }
    else if (gameState.pEnergy >= gameState.player.winE) { res = "VICTORY"; d = "CHARGED UP"; sound.playSE('victory'); }
    else if (cpuEWin) { res = "DEFEAT"; d = "CPU CHARGED UP"; sound.playSE('defeat'); }
    tit.innerText = res; desc.innerText = d; tit.className = `text-5xl font-black italic font-orbitron mb-4 ${res === 'VICTORY' ? 'text-emerald-400' : res === 'DEFEAT' ? 'text-rose-500' : 'text-white'}`;

    nextB.classList.add('hidden'); streakB.classList.add('hidden');

    if (res === 'VICTORY' && gameState.gameMode === 'tower') {
        handleTowerVictory();
    } else if (gameState.gameMode === 'tower') {
        streakB.classList.remove('hidden');
        document.getElementById('final-streak-val').innerText = gameState.floor;
        if (gameState.floor > gameState.highStreak) {
            gameState.highStreak = gameState.floor;
            saveHighStreak(gameState.highStreak);
        }
        ov.classList.remove('hidden'); setTimeout(() => ov.classList.add('opacity-100'), 10);
    } else {
        ov.classList.remove('hidden'); setTimeout(() => ov.classList.add('opacity-100'), 10);
    }
}

function handleTowerVictory() {
    document.getElementById('result-overlay').classList.add('hidden');
    showFloorClearAnim(() => showTreasure());
}

function showFloorClearAnim(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[300] bg-slate-950/90 flex flex-col items-center justify-center animate-fade-in';
    const nextIsBoss = ((gameState.floor + 1) % 5 === 0);
    const accentColor = nextIsBoss ? 'text-rose-500' : 'text-emerald-500';

    overlay.innerHTML = `
        <div class="text-center">
            <div class="font-orbitron text-slate-500 text-sm font-black tracking-[0.5em] mb-4 uppercase">Floor Cleared</div>
            <div class="flex items-center justify-center gap-8 mb-8">
                <div class="flex flex-col">
                    <span class="font-orbitron text-slate-700 text-xs font-bold uppercase">Current</span>
                    <span class="font-orbitron text-slate-500 text-5xl font-black italic">F${gameState.floor}</span>
                </div>
                <i data-lucide="chevrons-right" class="w-12 h-12 ${accentColor} ${nextIsBoss ? 'animate-ping' : 'animate-side-pulse'}"></i>
                <div class="flex flex-col">
                    <span class="${accentColor} font-orbitron text-xs font-bold uppercase">${nextIsBoss ? 'CAUTION' : 'Next'}</span>
                    <span class="font-orbitron text-white text-7xl font-black italic ${nextIsBoss ? 'drop-shadow-[0_0_25px_rgba(244,63,94,0.7)]' : 'drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]'}">F${gameState.floor + 1}</span>
                </div>
            </div>
            <div class="font-orbitron ${accentColor} text-[10px] font-black uppercase tracking-[0.3em]">${nextIsBoss ? 'High energy reading detected ahead...' : 'Ascending to the next level...'}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    lucide.createIcons();

    setTimeout(() => {
        overlay.style.transition = 'all 0.5s'; overlay.style.opacity = '0'; overlay.style.transform = 'scale(1.1)';
        setTimeout(() => { document.body.removeChild(overlay); callback(); }, 500);
    }, 2200);
}

function showTreasure() {
    const treasureOverlay = document.getElementById('treasure-overlay');
    const cardsContainer = document.getElementById('treasure-cards-container');
    const isMimic = (gameState.cpu.id === 'TREASURE_CHEST');
    const options = generateTreasureOptions(isMimic);
    cardsContainer.innerHTML = '';

    options.forEach(option => {
        const card = document.createElement('div');
        card.className = 'w-full max-w-md mx-auto bg-slate-900 border-4 border-slate-700 p-6 rounded-2xl shadow-lg cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all flex flex-row items-center gap-4';
        let title, description, icon;
        if (option.type === 'skill') {
            title = `新スキル: ${option.skill.name}`;
            description = `${option.skill.description} (コスト: ${option.skill.cost})`;
            icon = 'star';
        } else {
            title = '強化アイテム';
            const meritValue = option.merit.valueRange[0] + Math.floor(Math.random() * (option.merit.valueRange[1] - option.merit.valueRange[0] + 1));
            option.merit.value = meritValue;
            const demeritValue = option.demerit.valueRange[0] + Math.floor(Math.random() * (option.demerit.valueRange[1] - option.demerit.valueRange[0] + 1));
            option.demerit.value = demeritValue;
            description = `<span class="text-emerald-400 block">+ ${option.merit.text.replace('$V', meritValue)}</span><span class="text-rose-500 block mt-2">- ${option.demerit.text.replace('$V', demeritValue)}</span>`;
            icon = 'gem';
        }
        card.innerHTML = `
            <div class="flex-shrink-0">
                <i data-lucide="${icon}" class="w-12 h-12 ${option.type === 'skill' ? 'text-purple-400' : 'text-amber-400'}"></i>
            </div>
            <div class="flex-1 text-left">
                <h3 class="font-orbitron font-bold text-lg mb-2 text-white">${title}</h3>
                <div class="text-sm text-slate-400 font-bold">${description}</div>
            </div>
        `;
        card.onclick = () => selectTreasure(option);
        cardsContainer.appendChild(card);
    });

    // Add Skip Button
    const skipCard = document.createElement('div');
    skipCard.className = 'w-full max-w-md mx-auto bg-slate-800 border-4 border-slate-600 p-6 rounded-2xl shadow-lg cursor-pointer hover:border-slate-400 hover:scale-[1.02] transition-all flex flex-row items-center gap-4';
    skipCard.innerHTML = `
        <div class="flex-shrink-0">
            <i data-lucide="skip-forward" class="w-12 h-12 text-slate-400"></i>
        </div>
        <div class="flex-1 text-left">
            <h3 class="font-orbitron font-bold text-lg mb-2 text-white">SKIP</h3>
            <div class="text-sm text-slate-500 font-bold uppercase">能力を変更せずに進む</div>
        </div>
    `;
    skipCard.onclick = () => selectTreasure({ type: 'skip' });
    cardsContainer.appendChild(skipCard);

    lucide.createIcons();
    treasureOverlay.classList.remove('hidden');
    setTimeout(() => treasureOverlay.classList.add('opacity-100'), 10);
}

function generateTreasureOptions(isMimic) {
    const options = [];

    // Helper function to extract parameter name from effect ID
    const getParamFromId = (id) => {
        // Remove _UP or _DOWN suffix to get the base parameter
        return id.replace(/_UP$|_DOWN$/, '');
    };

    for (let i = 0; i < 3; i++) {
        if (!isMimic) {
            const availableMerits = ITEM_EFFECTS.MERITS.filter(item => !item.condition || item.condition(gameState.pChar, gameState.playerSkill));
            const merit = availableMerits[Math.floor(Math.random() * availableMerits.length)];

            // Get the parameter affected by the selected merit
            const meritParam = getParamFromId(merit.id);

            // Filter out demerits that affect the same parameter as the merit
            const availableDemerits = ITEM_EFFECTS.DEMERITS.filter(item => {
                if (item.condition && !item.condition(gameState.pChar, gameState.playerSkill)) {
                    return false;
                }
                const demeritParam = getParamFromId(item.id);
                return demeritParam !== meritParam; // Exclude if same parameter
            });

            // If no non-conflicting demerits available, use all available demerits
            const demeritPool = availableDemerits.length > 0 ? availableDemerits : ITEM_EFFECTS.DEMERITS.filter(item => !item.condition || item.condition(gameState.pChar, gameState.playerSkill));
            const demerit = demeritPool[Math.floor(Math.random() * demeritPool.length)];

            options.push({ type: 'item', merit, demerit });
        } else {
            const unownedSkills = SKILLS.filter(s => !gameState.playerSkill || s.id !== gameState.playerSkill.id);
            const skillPool = unownedSkills.length > 0 ? unownedSkills : SKILLS;
            const skill = skillPool[Math.floor(Math.random() * skillPool.length)];
            const [minCost, maxCost] = skill.costRange;
            const cost = minCost + Math.floor(Math.random() * (maxCost - minCost + 1));
            const effectValues = skill.effectRanges.map(([min, max]) => min + Math.floor(Math.random() * (max - min + 1)));
            let desc = skill.description; effectValues.forEach(v => desc = desc.replace('?', v));
            options.push({ type: 'skill', skill: { ...skill, cost, effectValues, description: desc } });
        }
    }
    return options;
}

function selectTreasure(reward) {
    sound.playSE('victory');
    const treasureOverlay = document.getElementById('treasure-overlay');
    if (reward.type === 'item') {
        reward.merit.apply(gameState.pChar, reward.merit.value);
        reward.demerit.apply(gameState.pChar, reward.demerit.value);
    } else if (reward.type === 'skill') {
        gameState.playerSkill = reward.skill;
    }
    // 'skip' does nothing

    gameState.winsSinceChest = 0;
    treasureOverlay.classList.remove('opacity-100');
    setTimeout(() => {
        treasureOverlay.classList.add('hidden');
        gameState.winStreak++; gameState.floor++;
        gameState.cChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        setupBattleState();
    }, 500);
}
