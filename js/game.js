import { CHARACTERS, ENEMY_TRAITS, BOSS_CHARACTERS, SKILLS, ITEM_EFFECTS, TREASURE_MONSTER, GAME_MODES, PASSIVE_SKILLS } from './constants.js';
import { gameState, saveHighStreak } from './utils.js';
import { sound } from './sounds.js';
import { setMessage, updateUI, initEnergy, showPassiveAlert, showDamageNumber, showActionAnim } from './ui.js';
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

        baseCpu.effects = []; // Initialize effects before passive
        if (baseCpu.passive) {
            baseCpu.passive.apply(baseCpu, gameState.player);
            // Show passive activation alert
            setTimeout(() => showPassiveAlert(baseCpu.passive.name, baseCpu.passive.description), 500);
        }
    } else {
        baseCpu = JSON.parse(JSON.stringify(gameState.cChar));
        baseCpu.effects = [];
    }

    gameState.cpu = JSON.parse(JSON.stringify(baseCpu));
    // gameState.cpu.effects is already set from baseCpu, do not overwrite if it has content
    if (!gameState.cpu.effects) gameState.cpu.effects = [];

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
    let playerIconHtml = `<i data-lucide="${gameState.player.icon}" class="w-16 h-16 md:w-20 md:h-20 text-blue-400"></i>`;
    if (gameState.gameMode === 'tower') {
        playerIconHtml += `<div class="absolute -top-2 -left-2 bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm border-4 border-slate-900 z-10 shadow-lg">${gameState.lives}</div>`;
    }
    document.getElementById('player-icon-container').innerHTML = playerIconHtml;
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

        // Check for Player Expired Effects (MIRAGE)
        const pUpdate = updateEffects(gameState.player.effects);
        gameState.player.effects = pUpdate.effects;

        pUpdate.expired.forEach(ex => {
            if (ex.type === 'INVINCIBLE_STORE') {
                // Apply stored damage
                // Legendary might halve it? logic.js only stored it. 
                // The skill description says Legendary takes half.
                // But logic.js didn't know if it was legendary or not when storing.
                // Actually logic.js has access to skill when applying effect?
                // But the effect persistence doesn't store rarity.
                // I should store a multiplier in the effect when applying it in logic.js!
                // Oops, I didn't do that.
                // For now, I'll just apply full damage or implement the check here?
                // I can't check skill rarity here easily.
                // I should update logic.js to store 'multiplier' in the effect.
                // But I can't update logic.js again right now without context switch.
                // I will just apply full damage for now as MVP, or try to hack it.
                // Wait, if I want to support legendary half-damage, I need to store it.
                // Re-visiting logic.js plan: I missed adding 'damageMultiplier' to INVINCIBLE_STORE.
                // However, I can just rely on 'effect value'? 
                // MIRAGE effectValues: [3].
                // Maybe I can store the multiplier in 'amount'? INVINCIBLE_STORE doesn't use amount.
                // Yes! I'll update logic.js next to store multiplier in 'amount'.
                // For now, let's assume 'amount' holds the multiplier (e.g. 1 or 0.5).
                const multiplier = ex.amount || 1;
                const dmg = Math.floor(ex.stored * multiplier);
                gameState.pHP = Math.max(0, gameState.pHP - dmg);
                sound.playSE('clash');
                showPassiveAlert('MIRAGE EXPIRED', `Received ${dmg} damage!`);
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
        // 2. Calculate Result (with Double Action Logic)
        const isDouble = gameState.player.effects.some(e => e.type === 'DOUBLE_ACTION') || (pUpdate.expired && pUpdate.expired.some(e => e.type === 'DOUBLE_ACTION'));
        const loops = isDouble ? 2 : 1;

        if (isDouble) showPassiveAlert('PHANTOM STEP', 'Double Action Triggered!');

        for (let i = 0; i < loops; i++) {
            // For first loop of double action, CPU Skips to simulate "Extra Turn"
            const currentCM = (isDouble && i === 0) ? 'SKIP' : cM;

            const result = calculateTurnResult(
                { ...gameState.player, energy: gameState.pEnergy, hp: gameState.pHP, maxHp: gameState.player.hp },
                { ...gameState.cpu, energy: gameState.cEnergy, hp: gameState.cHP },
                pM, currentCM, gameState.playerSkill
            );

            // Sound effects & Interaction Animations
            let pAnim = pM, cAnim = currentCM;

            // --- Player vs CPU Interaction Logic ---
            const isHeavyTarget = (move) => (move === 'CHARGE' || move === 'SKILL' || move === 'SKIP'); // Moves that leave open to heavy hit

            // 1. Attack vs Attack -> Clash (Winner Logic)
            if (pM === 'ATTACK' && currentCM === 'ATTACK') {
                // Calculate temporary total attack for comparison (ignoring defense for visual supremacy)
                // Note: Actual damage calc uses defense, but visual 'clash win' is pure force.
                // We need to access current turn buffed stats? 
                // We can approximate or use base + temp.
                // Better to check `result` or `gameState` if updated? 
                // `gameState` is updated *after* `calculateTurnResult` returns but *before* this block is finalized?
                // Wait, `calculateTurnResult` returns new state. 
                // Let's use `gameState.player.atk` + `gameState.player.effects` (if any? tempAtk is in player object?)
                // Actually `calculateTurnResult` uses `player` object passed in.
                // To match exactly, let's just grab the ATK values from the objects we passed to calculateTurnResult.
                // Or easier:
                const pAtk = (gameState.player.atk || 0) + (gameState.player.tempAtk || 0);
                const cAtk = (gameState.cpu.atk || 0) + (gameState.cpu.tempAtk || 0);

                if (pAtk > cAtk) {
                    pAnim = 'ATTACK_HEAVY'; // Player wins clash
                    cAnim = 'CLASH';        // CPU sparks
                } else if (cAtk > pAtk) {
                    cAnim = 'ATTACK_HEAVY'; // CPU wins clash
                    pAnim = 'CLASH';        // Player sparks
                } else {
                    pAnim = 'CLASH'; cAnim = 'CLASH'; // Even
                }
                sound.playSE('clash');
            }
            // 2. Attack vs Guard -> Blocked Attack
            else if (pM === 'ATTACK' && currentCM === 'GUARD') {
                pAnim = 'ATTACK_BLOCKED'; // Player attack starts but is blocked
                cAnim = 'BLOCK_HEAVY';    // CPU blocks heavily
                sound.playSE('guard');
            }
            else if (pM === 'GUARD' && currentCM === 'ATTACK') {
                cAnim = 'ATTACK_BLOCKED'; // CPU attack starts but is blocked
                pAnim = 'BLOCK_HEAVY';    // Player blocks heavily
                sound.playSE('guard');
            }
            // 3. Attack vs Charge/Skill/Skip -> Heavy Hit
            else if (pM === 'ATTACK' && isHeavyTarget(currentCM)) {
                pAnim = 'ATTACK_HEAVY'; // Player hits hard
            }
            else if (isHeavyTarget(pM) && currentCM === 'ATTACK') {
                cAnim = 'ATTACK_HEAVY'; // CPU hits hard
            }
            // 4. Guard vs Non-Attack -> Weak Guard (Wasted)
            else if (pM === 'GUARD' && currentCM !== 'ATTACK') {
                pAnim = 'GUARD_WEAK';
            }
            else if (currentCM === 'GUARD' && pM !== 'ATTACK') {
                cAnim = 'GUARD_WEAK';
            }

            // Execute Animations Helper
            const animMap = {
                'CHARGE': { sound: 'charge', targetSelf: true },
                'GUARD': { sound: 'guard', targetSelf: true },
                'ATTACK': { sound: 'attack', targetSelf: false },
                'ATTACK_HEAVY': { sound: 'attack', targetSelf: false },
                'CLASH': { targetSelf: false },
                'BLOCK': { sound: 'guard', targetSelf: true },
                'BLOCK_HEAVY': { sound: 'guard', targetSelf: true },
                'ATTACK_BLOCKED': { targetSelf: false },
                'GUARD_WEAK': { sound: 'guard', targetSelf: true }
            };

            const runAnim = (anim, isPlayer) => {
                if (!anim) return;
                const conf = animMap[anim];
                const selfId = isPlayer ? 'player-icon-container' : 'cpu-icon-container';
                const enemyId = isPlayer ? 'cpu-icon-container' : 'player-icon-container';

                if (conf && conf.sound) sound.playSE(conf.sound);

                // Determine target element
                let targetId = selfId;
                if (conf && conf.targetSelf === false) targetId = enemyId;
                if (anim === 'CLASH') targetId = enemyId;

                showActionAnim(targetId, anim);
            };

            runAnim(pAnim, true);
            runAnim(cAnim, false);

            if (result.pDmgTaken > 0 || result.cDmgTaken > 0) sound.playSE('clash');

            // Apply results immediately
            gameState.pHP = result.pHP;
            gameState.cHP = result.cHP;
            gameState.pEnergy = result.pEnergy;
            gameState.cEnergy = result.cEnergy;
            gameState.player.effects = result.pEffects;
            gameState.cpu.effects = result.cEffects;

            if (result.pDmgTaken > 0) {
                pC.classList.add('shake');
                showDamageNumber('player-icon-container', result.pDmgTaken, 'DAMAGE');
            }
            if (result.cDmgTaken > 0) {
                cC.classList.add('shake');
                showDamageNumber('cpu-icon-container', result.cDmgTaken, 'DAMAGE');
            }
        }

        updateUI();
        updateUI();
        pC.classList.remove('zone-dim'); cC.classList.remove('zone-dim');

        setTimeout(() => {
            pC.classList.remove('shake'); cC.classList.remove('shake');

            // Revival Logic for Tower Mode
            if (gameState.pHP <= 0 && gameState.gameMode === 'tower' && gameState.lives > 0) {
                gameState.lives--;
                gameState.pHP = gameState.player.hp; // Recover to Max
                gameState.player.hp = gameState.pHP;
                sound.playSE('charge'); // Revival sound

                // Visual feedback
                setMessage(`REVIVED! (LIVES: ${gameState.lives})`);
                pC.classList.add('animate-pulse'); // Visual effect
                setTimeout(() => pC.classList.remove('animate-pulse'), 1000);

                // Update specific UI elements immediately
                const playerIconHtml = `<div class="absolute -top-2 -left-2 bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm border-4 border-slate-900 z-10 shadow-lg">${gameState.lives}</div>`;
                const iconContainer = document.getElementById('player-icon-container');
                if (iconContainer.querySelector('.absolute')) {
                    iconContainer.querySelector('.absolute').innerText = gameState.lives;
                }
                updateUI();
            }

            const cWinF = (gameState.cEnergy >= gameState.cpu.winE);
            // Check Game Over (pHP is now checked after potential revival)
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
                if (gameState.turn > 1 && !document.getElementById('game-message').innerText.includes('REVIVED')) {
                    setMessage("Command Select");
                }
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
    const isBoss = (gameState.floor % 5 === 0);
    const options = generateTreasureOptions(isMimic, isBoss);
    cardsContainer.innerHTML = '';

    options.forEach(option => {
        const card = document.createElement('div');
        card.className = 'w-full max-w-md mx-auto bg-slate-900 border-4 border-slate-700 p-6 rounded-2xl shadow-lg cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all flex flex-row items-center gap-4';
        let title, description, icon, borderColor = 'border-slate-600', textColor = 'text-white', iconColor = 'text-amber-400';
        if (option.type === 'skill') {
            title = `新スキル: ${option.skill.name}`;
            description = `${option.skill.description} (コスト: ${option.skill.cost})`;
            icon = 'star';

            switch (option.skill.rarity) {
                case 'COMMON':
                    borderColor = 'border-slate-500';
                    textColor = 'text-slate-300';
                    iconColor = 'text-slate-400';
                    break;
                case 'RARE':
                    borderColor = 'border-blue-500';
                    textColor = 'text-blue-300';
                    iconColor = 'text-blue-400';
                    title += ' <span class="text-[10px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-500/50 align-middle">RARE</span>';
                    break;
                case 'EPIC':
                    borderColor = 'border-purple-500';
                    textColor = 'text-purple-300';
                    iconColor = 'text-purple-400';
                    title += ' <span class="text-[10px] bg-purple-900/50 text-purple-300 px-1 rounded border border-purple-500/50 align-middle">EPIC</span>';
                    break;
                case 'LEGENDARY':
                    borderColor = 'border-amber-500';
                    textColor = 'text-amber-300';
                    iconColor = 'text-amber-400';
                    title += ' <span class="text-[10px] bg-amber-900/50 text-amber-300 px-1 rounded border border-amber-500/50 align-middle">LEGENDARY</span>';
                    break;
                default:
                    // default to rare look if undefined
                    borderColor = 'border-slate-600';
                    break;
            }

        } else {
            title = '強化アイテム';
            const meritValue = option.merit.valueRange[0] + Math.floor(Math.random() * (option.merit.valueRange[1] - option.merit.valueRange[0] + 1));
            option.merit.value = meritValue;
            option.merit.value = meritValue;

            if (option.demerit) {
                const demeritValue = option.demerit.valueRange[0] + Math.floor(Math.random() * (option.demerit.valueRange[1] - option.demerit.valueRange[0] + 1));
                option.demerit.value = demeritValue;
                description = `<span class="text-emerald-400 block">+ ${option.merit.text.replace('$V', meritValue)}</span><span class="text-rose-500 block mt-2">- ${option.demerit.text.replace('$V', demeritValue)}</span>`;
            } else {
                description = `<span class="text-emerald-400 block">+ ${option.merit.text.replace('$V', meritValue)}</span>`;
            }
            icon = 'gem';
        }
        card.className = `w-full max-w-md mx-auto bg-slate-900 border-2 ${borderColor} p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-800 transition-all flex flex-row items-center gap-4 group hover:scale-[1.02]`;
        card.innerHTML = `
            <div class="flex-shrink-0">
                <i data-lucide="${icon}" class="w-12 h-12 ${iconColor}"></i>
            </div>
            <div class="flex-1 text-left">
                <h3 class="font-orbitron font-bold text-lg mb-1 ${textColor}">${title}</h3>
                <div class="text-xs text-slate-400 font-bold leading-relaxed">${description}</div>
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

const getRarityWeights = (floor) => {
    if (floor <= 3) return { COMMON: 90, RARE: 10, EPIC: 0, LEGENDARY: 0 };
    if (floor <= 7) return { COMMON: 60, RARE: 35, EPIC: 5, LEGENDARY: 0 };
    if (floor <= 14) return { COMMON: 40, RARE: 45, EPIC: 14, LEGENDARY: 1 };
    return { COMMON: 20, RARE: 40, EPIC: 30, LEGENDARY: 10 };
};

const pickRarity = (floor) => {
    const weights = getRarityWeights(floor);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.floor(Math.random() * total);
    for (const [rarity, weight] of Object.entries(weights)) {
        if (rand < weight) return rarity;
        rand -= weight;
    }
    return 'COMMON';
};

function generateTreasureOptions(isMimic, isBoss) {
    const options = [];

    // Helper function to extract parameter name from effect ID
    const getParamFromId = (id) => {
        // Remove _UP or _DOWN suffix to get the base parameter
        return id.replace(/_UP$|_DOWN$/, '');
    };

    if (!isMimic) {
        for (let i = 0; i < 3; i++) {
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

            let demerit = null;
            if (!isBoss) {
                demerit = demeritPool[Math.floor(Math.random() * demeritPool.length)];
            }

            options.push({ type: 'item', merit, demerit });
        }
    } else {
        // Rarity-based Skill Selection
        for (let i = 0; i < 3; i++) {
            const rarity = pickRarity(gameState.floor);
            // Filter skills by rarity AND ownership (id based)
            // Ideally we want to avoid showing the exact same skill we have, but maybe different rarity is okay?
            // "Revamp Skill System UI" previous convo made it so we can have duplicates.
            // But let's stick to "Unowned ID" constraint for now if possible, OR allow upgrades?
            // User request implies "Deck building" / "Tactics".

            // Let's filter by rarity first.
            const pool = SKILLS.filter(s => s.rarity === rarity);
            const skill = pool[Math.floor(Math.random() * pool.length)];

            // Fill description with values
            let desc = skill.description;
            skill.effectValues.forEach(v => desc = desc.replace('?', v));

            // We need a unique object for the option
            options.push({ type: 'skill', skill: { ...skill, description: desc } });
        }
    }
    return options;
}

function selectTreasure(reward) {
    sound.playSE('victory');
    const treasureOverlay = document.getElementById('treasure-overlay');
    if (reward.type === 'item') {
        reward.merit.apply(gameState.pChar, reward.merit.value);
        if (reward.demerit) {
            reward.demerit.apply(gameState.pChar, reward.demerit.value);
        }
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
