import { CHARACTERS, ENEMY_TRAITS, BOSS_CHARACTERS, SKILLS, ITEM_EFFECTS, TREASURE_MONSTER, GAME_MODES, PASSIVE_SKILLS, RISK_MAPPING } from './constants.js';
import { gameState, saveHighStreak, saveGameState, clearGameState } from './utils.js';
import { sound } from './sounds.js';
import { setMessage, updateUI, initEnergy, showPassiveAlert, showDamageNumber, showActionAnim } from './ui.js';
import { calculateTurnResult, updateEffects, getCpuMoveLogic, generateTowerEnemy } from './logic.js';

export function setupBattleState() {
    gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
    gameState.player.effects = gameState.nextBattleEffects ? [...gameState.nextBattleEffects] : [];
    gameState.nextBattleEffects = []; // 一度使ったらクリア
    gameState.player.tempAtk = gameState.player.tempGrdC = gameState.player.tempChgE = gameState.player.tempChgC = gameState.player.tempDmgReduce = 0;

    const isBoss = (gameState.gameMode === 'tower' && gameState.floor > 0 && gameState.floor % 7 === 0);
    let baseCpu;

    if (gameState.gameMode === GAME_MODES.ONLINE_HOST || gameState.gameMode === GAME_MODES.ONLINE_CLIENT) {
        // Online: cChar is set via network sync
        baseCpu = JSON.parse(JSON.stringify(gameState.cChar));
    } else if (gameState.gameMode === 'tower') {
        const cyclePos = (gameState.floor - 1) % 7;
        if (cyclePos === 0 && !isBoss && gameState.floor > 0) {
            gameState.treasureFloorOffset = Math.floor(Math.random() * 4);
        }

        const isTreasure = (!isBoss && gameState.floor > 0 && cyclePos === gameState.treasureFloorOffset);

        const difficulty = gameState.towerDifficulty || 'NORMAL';
        const result = generateTowerEnemy(gameState.floor, gameState.mobDeck, gameState.bossDeck, isTreasure, difficulty);
        baseCpu = result.cpu;
        gameState.aiLevel = result.aiLevel;
        
        // ボスフラグの処理
        if (isBoss && gameState.nextBossMod) {
            if (gameState.nextBossMod === 'WEAK') {
                baseCpu.name = "Weakened " + baseCpu.name;
                baseCpu.hp = Math.max(1, Math.floor(baseCpu.hp * 0.7));
                baseCpu.atk = Math.max(1, Math.floor(baseCpu.atk * 0.8));
                if (gameState.aiLevel === 'EXPERT') gameState.aiLevel = 'HARD';
                else if (gameState.aiLevel === 'HARD') gameState.aiLevel = 'NORMAL';
            } else if (gameState.nextBossMod === 'STRONG') {
                baseCpu.name = "Awakened " + baseCpu.name;
                baseCpu.hp = Math.floor(baseCpu.hp * 1.5);
                baseCpu.atk = Math.floor(baseCpu.atk * 1.2);
                baseCpu.chgE += 1;
                if (gameState.aiLevel === 'EASY') gameState.aiLevel = 'NORMAL';
                else if (gameState.aiLevel === 'NORMAL') gameState.aiLevel = 'HARD';
                else if (gameState.aiLevel === 'HARD') gameState.aiLevel = 'EXPERT';
                gameState.currentBossIsStrong = true; // 勝利時の報酬用
            }
            gameState.nextBossMod = null; // フラグ消費
        }
        
        // エリートフラグの処理
        if (gameState.nextBattleIsElite) {
            baseCpu.name = "Elite " + baseCpu.name;
            baseCpu.hp += 3;
            baseCpu.atk += 1;
            baseCpu.chgE += 1;
            // AIを賢くする
            if (gameState.aiLevel === 'EASY') gameState.aiLevel = 'NORMAL';
            else if (gameState.aiLevel === 'NORMAL') gameState.aiLevel = 'HARD';
            else if (gameState.aiLevel === 'HARD') gameState.aiLevel = 'EXPERT';
            gameState.nextBattleIsElite = false; // フラグを消費
        }

        // 弱い敵フラグの処理
        if (gameState.nextBattleIsWeak) {
            baseCpu.name = "Weak " + baseCpu.name;
            baseCpu.hp = Math.max(1, Math.floor(baseCpu.hp * 0.6)); // HPを60%に
            baseCpu.atk = Math.max(1, Math.floor(baseCpu.atk * 0.8)); // 攻撃力も少し下げる
            // AIを優しくする
            if (gameState.aiLevel === 'EXPERT') gameState.aiLevel = 'HARD';
            else if (gameState.aiLevel === 'HARD') gameState.aiLevel = 'NORMAL';
            else if (gameState.aiLevel === 'NORMAL') gameState.aiLevel = 'EASY';
            gameState.nextBattleIsWeak = false;
        }

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
        document.getElementById('current-floor-val').innerText = String(gameState.floor);
        const bossIn = 7 - ((gameState.floor - 1) % 7);
        document.getElementById('boss-in-val').innerText = isBoss ? 'BOSS' : String(bossIn);

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

    gameState.inBattle = true;
    saveGameState();
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
            if (ex.type === 'INVINCIBLE_STORE') {
                // Apply stored damage
                const multiplier = ex.amount || 1;
                const dmg = Math.floor(ex.stored * multiplier);
                gameState.pHP = Math.max(0, gameState.pHP - dmg);
                gameState.player.hp = gameState.pHP; // Sync
                sound.playSE('clash');
                showPassiveAlert('MIRAGE EXPIRED', `Received ${dmg} damage!`);
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
            if (ex.type === 'INVINCIBLE_STORE') {
                const multiplier = ex.amount || 1;
                const dmg = Math.floor(ex.stored * multiplier);
                gameState.cHP = Math.max(0, gameState.cHP - dmg);
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

            // 1. 攻撃 vs 攻撃 -> 相殺（勝者判定ロジック）
            if (pM === 'ATTACK' && currentCM === 'ATTACK') {
                const pAtk = (gameState.player.atk || 0) + (gameState.player.tempAtk || 0);
                const cAtk = (gameState.cpu.atk || 0) + (gameState.cpu.tempAtk || 0);

                if (pAtk > cAtk) {
                    pAnim = 'ATTACK_HEAVY'; // プレイヤーが相殺に勝利
                    cAnim = null;           // 重複を避けるためCPUのアニメーションをキャンセル
                } else if (cAtk > pAtk) {
                    cAnim = 'ATTACK_HEAVY'; // CPUが相殺に勝利
                    pAnim = null;           // プレイヤーのアニメーションをキャンセル
                } else {
                    pAnim = 'CLASH'; cAnim = 'CLASH'; // 引き分け（それぞれの対象に火花を表示、重複なし）
                }
                sound.playSE('clash');
            }
            // 2. 攻撃 vs 防御 -> ブロックされた攻撃
            else if (pM === 'ATTACK' && currentCM === 'GUARD') {
                pAnim = null;             // 重複を避けるためプレイヤーの斬撃をキャンセル
                cAnim = 'BLOCK_HEAVY';    // CPUが強力に防御
                sound.playSE('guard');
            }
            else if (pM === 'GUARD' && currentCM === 'ATTACK') {
                cAnim = null;             // CPUの斬撃をキャンセル
                pAnim = 'BLOCK_HEAVY';    // プレイヤーが強力に防御
                sound.playSE('guard');
            }
            // 3. 攻撃 vs チャージ/スキル/スキップ -> 強力なヒット
            else if (pM === 'ATTACK' && isHeavyTarget(currentCM)) {
                pAnim = 'ATTACK_HEAVY'; // プレイヤーの強力な攻撃
                cAnim = null;           // CPUのチャージ/スキルをキャンセル
            }
            else if (isHeavyTarget(pM) && currentCM === 'ATTACK') {
                cAnim = 'ATTACK_HEAVY'; // CPUの強力な攻撃
                pAnim = null;           // プレイヤーのチャージ/スキルをキャンセル
            }
            // 4. 防御 vs 非攻撃 -> 弱い防御（無駄防御）
            else if (pM === 'GUARD' && currentCM !== 'ATTACK') {
                pAnim = 'GUARD_WEAK';
                // cAnimはそのまま（お互いの自己カードを対象にするため重複は発生しない）
            }
            else if (currentCM === 'GUARD' && pM !== 'ATTACK') {
                cAnim = 'GUARD_WEAK';
                // pAnimはそのまま
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
                    iconContainer.querySelector('.absolute').innerText = String(gameState.lives);
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
                saveGameState();
            }
        }, 500);
    }, 800);
}

function showFinal(cpuEWin) {
    gameState.gameOver = true;
    gameState.inBattle = false;

    // バトルダイアログを強制的に非表示
    const dialogOverlay = document.getElementById('battle-dialog-overlay');
    dialogOverlay.classList.add('opacity-0', 'hidden');

    const ov = document.getElementById('result-overlay'), tit = document.getElementById('result-title'), desc = document.getElementById('result-desc');
    const retryB = document.getElementById('btn-retry-tower');
    const streakB = document.getElementById('streak-result-box'); // Old simplistic one, keep hidden if tower mode new UI is used

    let res = "DRAW", d = "SIMULTANEOUS";
    if (gameState.pHP <= 0 && gameState.cHP <= 0) { res = "DRAW"; d = "DOUBLE K.O."; }
    else if (gameState.cHP <= 0) { res = "VICTORY"; d = "ENEMY DESTROYED"; sound.playSE('victory'); }
    else if (gameState.pHP <= 0) { res = "DEFEAT"; d = "HP EXHAUSTED"; sound.playSE('defeat'); }
    else if (gameState.pEnergy >= gameState.player.winE) { res = "VICTORY"; d = "CHARGED UP"; sound.playSE('victory'); }
    else if (cpuEWin) { res = "DEFEAT"; d = "CPU CHARGED UP"; sound.playSE('defeat'); }

    tit.innerText = res;
    desc.innerText = d;
    tit.className = `text-5xl font-black italic font-orbitron mb-2 uppercase tracking-tighter drop-shadow-lg z-10 ${res === 'VICTORY' ? 'text-emerald-400' : res === 'DEFEAT' ? 'text-rose-500' : 'text-white'}`;

    retryB?.classList.add('hidden');
    streakB?.classList.add('hidden'); // Legacy container

    // Tower Mode Result Logic
    const towerStats = document.getElementById('tower-result-stats');
    if (gameState.gameMode === 'tower') {
        if (res === 'VICTORY') {
            towerStats?.classList.add('hidden');
            
            // ゴールドの獲得
            let gainedGold = Math.floor(Math.random() * 11) + 10;
            if (gameState.currentBossIsStrong) {
                gainedGold += 100;
                gameState.currentBossIsStrong = false;
            }
            gameState.gold += gainedGold;
            updateUI();

            desc.innerText = `${d}\n\n[ LOOT ]\n+${gainedGold} GOLD`;

            retryB.innerText = 'Next / Proceed';
            retryB.onclick = () => {
                document.getElementById('result-overlay').classList.add('hidden');
                showFloorClearAnim(() => {
                    gameState.winStreak++;
                    gameState.winsSinceChest++;
                    if (gameState.currentMapNode && gameState.currentMapNode.type === 'ELITE') {
                        showTreasure(false);
                    } else if (gameState.currentMapNode && gameState.currentMapNode.type === 'BOSS') {
                        showTreasure(false);
                    } else if (gameState.cpu && gameState.cpu.id === 'TREASURE_CHEST') {
                        showTreasure(false);
                    } else {
                        showMap();
                    }
                });
            };
            retryB.classList.remove('hidden');
            retryB.classList.replace('bg-amber-600', 'bg-emerald-600');
            retryB.classList.replace('hover:bg-amber-500', 'hover:bg-emerald-500');
            retryB.classList.replace('shadow-amber-900/40', 'shadow-emerald-900/40');

            lucide.createIcons();
            ov.classList.remove('hidden');
            setTimeout(() => ov.classList.add('opacity-100'), 10);
            
            saveGameState();
            return;
        } else {
            // DEFEAT logic for Tower Mode
            towerStats?.classList.remove('hidden');
            if (towerStats) towerStats.style.display = 'flex'; // Ensure flex layout

            document.getElementById('final-floor-val').innerText = String(gameState.floor);
            document.getElementById('final-kills-val').innerText = String(gameState.enemiesDefeated || 0);

            // Boss List
            const bossList = document.getElementById('final-boss-list');
            if (bossList) {
                bossList.innerHTML = '';
                (gameState.defeatedBosses || []).forEach(bossIcon => {
                    const i = document.createElement('i');
                    i.setAttribute('data-lucide', bossIcon);
                    i.className = 'w-6 h-6 text-amber-400 drop-shadow-md';
                    bossList.appendChild(i);
                });
            }

            retryB.innerText = 'Retry Tower';
            retryB.onclick = window.retryTower;
            retryB.classList.remove('hidden');
            retryB.classList.replace('bg-emerald-600', 'bg-amber-600');
            retryB.classList.replace('hover:bg-emerald-500', 'hover:bg-amber-500');
            retryB.classList.replace('shadow-emerald-900/40', 'shadow-amber-900/40');

            // Status
            const p = gameState.pChar;
            const hpEl = document.getElementById('res-hp');
            const atkEl = document.getElementById('res-atk');
            const chgEl = document.getElementById('res-chg');
            const engEl = document.getElementById('res-eng');
            if (hpEl) hpEl.innerText = String(p.hp);
            if (atkEl) atkEl.innerText = String(p.atk);
            if (chgEl) chgEl.innerText = String(p.chgE);
            if (engEl) engEl.innerText = String(p.startE);

            // Skill
            const s = gameState.playerSkill;
            if (s) {
                const skillNameEl = document.getElementById('res-skill-name');
                const skillCostEl = document.getElementById('res-skill-cost');
                if (skillNameEl) skillNameEl.innerText = s.name;
                if (skillCostEl) skillCostEl.innerText = `COST: ${s.cost}`;
            } else {
                const skillNameEl = document.getElementById('res-skill-name');
                const skillCostEl = document.getElementById('res-skill-cost');
                if (skillNameEl) skillNameEl.innerText = "None";
                if (skillCostEl) skillCostEl.innerText = "";
            }

            if (retryB) retryB.classList.remove('hidden');

            // Update high score
            if (gameState.floor > gameState.highStreak) {
                gameState.highStreak = gameState.floor;
                saveHighStreak(gameState.highStreak);
            }
        }
    } else {
        // Normal Mode
        if (towerStats) towerStats.classList.add('hidden');
    }

    lucide.createIcons();
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('opacity-100'), 10);
    
    clearGameState();
}



function showFloorClearAnim(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[300] bg-slate-950/90 flex flex-col items-center justify-center animate-fade-in';
    const nextIsBoss = ((gameState.floor + 1) % 7 === 0);
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


const getRarityWeights = (floor, difficulty = 'NORMAL') => {
    let weights = { COMMON: 90, RARE: 10, EPIC: 0, LEGENDARY: 0 };

    if (floor <= 3) weights = { COMMON: 90, RARE: 10, EPIC: 0, LEGENDARY: 0 };
    else if (floor <= 7) weights = { COMMON: 60, RARE: 35, EPIC: 5, LEGENDARY: 0 };
    else if (floor <= 14) weights = { COMMON: 40, RARE: 45, EPIC: 14, LEGENDARY: 1 };
    else weights = { COMMON: 20, RARE: 40, EPIC: 30, LEGENDARY: 10 };

    // 難易度補正
    if (difficulty === 'HARD') {
        weights.RARE += 5;
        weights.EPIC += 5;
        weights.LEGENDARY += 2;
        weights.COMMON = Math.max(0, 100 - (weights.RARE + weights.EPIC + weights.LEGENDARY));
    } else if (difficulty === 'EASY') {
        weights.COMMON += 10;
        weights.EPIC = Math.max(0, weights.EPIC - 5);
        weights.LEGENDARY = Math.max(0, weights.LEGENDARY - 2);
        weights.RARE = Math.max(0, 100 - (weights.COMMON + weights.EPIC + weights.LEGENDARY));
    }

    return weights;
};

const pickRarity = (floor, difficulty = 'NORMAL') => {
    const weights = getRarityWeights(floor, difficulty);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.floor(Math.random() * total);
    for (const [rarity, weight] of Object.entries(weights)) {
        if (rand < weight) return rarity;
        rand -= weight;
    }
    return 'COMMON';
};

export function generateTreasureOptions(isMimic, isBoss, forceSkillPhase = false) {
    const options = [];
    const difficulty = gameState.towerDifficulty || 'NORMAL';
    const getParamFromId = (id) => id.replace(/_UP$|_DOWN$/, '');

    // ボス撃破後の確定報酬フェーズ
    if (forceSkillPhase) {
        // 1 LEGENDARY + 2 EPIC 確定
        const rarities = ['LEGENDARY', 'EPIC', 'EPIC'];
        const exclusiveIds = ['PHANTOM_STEP', 'GRAVITY_ZONE', 'GAMBLER', 'OVERCLOCK', 'ZERO_FORM', 'MIRAGE'];
        let hasExclusive = false;
        const chosenSkillIds = new Set();

        rarities.forEach((rarity, index) => {
            let pool = SKILLS.filter(s => s.rarity === rarity && !chosenSkillIds.has(s.id));
            if (pool.length === 0) {
                pool = SKILLS.filter(s => s.rarity === rarity);
            }
            let skill;
            if (index === 0) { // LEGENDARY slot
                const exclusivePool = pool.filter(s => exclusiveIds.includes(s.id));
                skill = exclusivePool.length > 0 ? exclusivePool[Math.floor(Math.random() * exclusivePool.length)] : pool[Math.floor(Math.random() * pool.length)];
                if (exclusiveIds.includes(skill.id)) hasExclusive = true;
            } else { // EPIC slots
                if (!hasExclusive && index === 2) {
                    const exclusivePool = pool.filter(s => exclusiveIds.includes(s.id));
                    skill = exclusivePool.length > 0 ? exclusivePool[Math.floor(Math.random() * exclusivePool.length)] : pool[Math.floor(Math.random() * pool.length)];
                    hasExclusive = true;
                } else {
                    skill = pool[Math.floor(Math.random() * pool.length)];
                }
                if (exclusiveIds.includes(skill.id)) hasExclusive = true;
            }
            chosenSkillIds.add(skill.id);
            let desc = skill.description;
            skill.effectValues.forEach(v => desc = desc.replace('?', v));
            options.push({ type: 'skill', skill: { ...skill, description: desc } });
        });
        return options;
    }

    if (!isMimic) {
        // Regular Treasure or Boss First Phase (Item)
        const chosenMeritIds = new Set();
        for (let i = 0; i < 3; i++) {
            // Filter: SKILL_COST_DOWN only appears if skill cost > 1
            let availableMerits = ITEM_EFFECTS.MERITS.filter(item => {
                if (chosenMeritIds.has(item.id)) return false;
                if (item.id === 'SKILL_COST_DOWN') {
                    const s = gameState.playerSkill;
                    if (!s) return false;
                    const currentCost = Math.max(0, s.cost + (gameState.pChar.skillCostBonus || 0));
                    return currentCost > 1;
                }
                return !item.condition || item.condition(gameState.pChar, gameState.playerSkill);
            });

            if (availableMerits.length === 0) {
                availableMerits = ITEM_EFFECTS.MERITS.filter(item => 
                    !item.condition || item.condition(gameState.pChar, gameState.playerSkill)
                );
            }

            const merit = availableMerits[Math.floor(Math.random() * availableMerits.length)];
            chosenMeritIds.add(merit.id);
            const meritParam = getParamFromId(merit.id);

            // Risk Mapping Logic
            let riskCandidates = [];
            if (RISK_MAPPING[merit.id]) {
                // Find demerits that match the risk mapping IDs
                riskCandidates = ITEM_EFFECTS.DEMERITS.filter(d =>
                    RISK_MAPPING[merit.id].includes(d.id) &&
                    (!d.condition || d.condition(gameState.pChar, gameState.playerSkill))
                );
            }

            let demerit = null;
            if (!isBoss) {
                // 70% chance to pick from mapped risks if available
                if (riskCandidates.length > 0 && Math.random() < 0.7) {
                    demerit = riskCandidates[Math.floor(Math.random() * riskCandidates.length)];
                } else {
                    // Fallback to pool excluding current merit param
                    const fallbackPool = ITEM_EFFECTS.DEMERITS.filter(item => {
                        if (item.condition && !item.condition(gameState.pChar, gameState.playerSkill)) return false;
                        return getParamFromId(item.id) !== meritParam;
                    });
                    if (fallbackPool.length > 0) {
                        demerit = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
                    }
                }
            }

            // Value Randomization
            const meritValue = merit.valueRange[0] + Math.floor(Math.random() * (merit.valueRange[1] - merit.valueRange[0] + 1));
            // Clone merit to attach value without modifying const
            const mObj = { ...merit, value: meritValue };

            let dObj = null;
            let displayHtml = `<span class="text-emerald-400 block">+ ${mObj.text.replace('$V', meritValue)}</span>`;

            if (demerit) {
                const demeritValue = demerit.valueRange[0] + Math.floor(Math.random() * (demerit.valueRange[1] - demerit.valueRange[0] + 1));
                dObj = { ...demerit, value: demeritValue };
                displayHtml += `<span class="text-rose-500 block mt-2">- ${dObj.text.replace('$V', demeritValue)}</span>`;
            }

            options.push({ type: 'item', merit: mObj, demerit: dObj, description: displayHtml });
        }
    } else {
        // Mimic (Skill Treasure)
        const chosenSkillIds = new Set();
        for (let i = 0; i < 3; i++) {
            const rarity = pickRarity(gameState.floor, difficulty);
            let pool = SKILLS.filter(s => s.rarity === rarity && !chosenSkillIds.has(s.id));
            if (pool.length === 0) {
                pool = SKILLS.filter(s => s.rarity === rarity);
            }
            const skill = pool[Math.floor(Math.random() * pool.length)];
            chosenSkillIds.add(skill.id);
            let desc = skill.description;
            skill.effectValues.forEach(v => desc = desc.replace('?', v));
            options.push({ type: 'skill', skill: { ...skill, description: desc } });
        }
    }
    return options;
}

export function selectTreasure(reward, fromForceSkillPhase = false) {
    sound.playSE('victory');
    const treasureOverlay = document.getElementById('treasure-overlay');
    const isBoss = (gameState.floor % 7 === 0);

    if (reward.type === 'item') {
        reward.merit.apply(gameState.pChar, reward.merit.value);
        if (reward.demerit) reward.demerit.apply(gameState.pChar, reward.demerit.value);
    } else if (reward.type === 'skill') {
        gameState.playerSkill = reward.skill;
    }

    // ボス撃破後のアイテム選択が終わった直後の場合、スキル選択 phase へ
    if (isBoss && reward.type !== 'skill' && reward.type !== 'skip' && !fromForceSkillPhase) {
        treasureOverlay.classList.remove('opacity-100');
        setTimeout(() => {
            treasureOverlay.classList.add('hidden');
            // スキルフェーズを開始
            showTreasure(true);
        }, 300);
        return;
    }

    // 通常の遷移
    gameState.winsSinceChest = 0;
    treasureOverlay.classList.remove('opacity-100');
    setTimeout(() => {
        treasureOverlay.classList.add('hidden');
        showMap();
    }, 500);
}

export function generateTowerMap(totalFloors = 7) {
    const map = [];
    let currentId = 0;

    // Helper to create a node
    const createNode = (floor, type) => {
        return {
            id: `node-${currentId++}`,
            floor,
            type,
            parents: [],
            children: []
        };
    };

    // Floor 0 (Start)
    const startNode = createNode(0, 'START');
    startNode.visited = true;
    map.push([startNode]);

    let prevLayer = [startNode];
    let prevLayerHadShop = false;
    let activeHiddenRouteNode = null;

    for (let f = 1; f < totalFloors; f++) {
        const numNodes = Math.floor(Math.random() * 2) + 3; // 3 or 4 normal nodes
        const normalNodes = [];
        let hasBattle = false;
        let currentLayerHasShop = false;

        for (let i = 0; i < numNodes; i++) {
            let type = 'BATTLE';
            const r = Math.random();
            
            if (f === 1) {
                // Floor 1: Always weak enemies
                type = 'WEAK_BATTLE';
                hasBattle = true;
            } else if (f === totalFloors - 1) {
                // Boss preceding floor: ALWAYS SHOP
                type = 'SHOP';
                currentLayerHasShop = true;
            } else {
                // Normal generation
                if (r < 0.25) type = 'BATTLE';
                else if (r < 0.35) {
                    if (f >= 3) type = 'ELITE'; // Elites from floor 3
                    else type = 'BATTLE';
                }
                else if (r < 0.55) type = 'TREASURE';
                else if (r < 0.70) {
                    if (!prevLayerHadShop) {
                        type = 'SHOP';
                        currentLayerHasShop = true;
                    } else {
                        type = 'TREASURE';
                    }
                }
                else if (r < 0.85) type = 'EVENT_SAFE';
                else type = 'EVENT_RISK';
                
                if (type === 'BATTLE' || type === 'ELITE') {
                    hasBattle = true;
                }
            }
            normalNodes.push(createNode(f, type));
        }

        // Ensure at least one battle room (if not boss-preceding floor and not floor 1 where they are already battles)
        if (f !== 1 && f !== totalFloors - 1 && !hasBattle) {
            const forceIdx = Math.floor(Math.random() * normalNodes.length);
            if (normalNodes[forceIdx].type === 'SHOP') {
                // Revert shop flag if we replaced the only shop
                currentLayerHasShop = normalNodes.some((n, idx) => idx !== forceIdx && n.type === 'SHOP');
            }
            normalNodes[forceIdx].type = 'BATTLE';
        }
        
        prevLayerHadShop = currentLayerHasShop;

        const hiddenNodes = [];
        let newActiveHiddenRouteNode = null;

        if (activeHiddenRouteNode) {
            // Continue route
            const hiddenType = Math.random() < 0.8 ? 'TREASURE' : 'SHOP';
            const hiddenNode = createNode(f, hiddenType);
            hiddenNode.hidden = true;
            hiddenNode.isRoute = true;
            hiddenNodes.push(hiddenNode);
            
            // Connect to previous route node
            activeHiddenRouteNode.children.push(hiddenNode.id);
            hiddenNode.parents.push(activeHiddenRouteNode.id);
            newActiveHiddenRouteNode = hiddenNode;
        } else if (Math.random() < 0.20) {
            // Start hidden room or route
            const isRoute = Math.random() < 0.25 && f < totalFloors - 2; // only if room to grow
            let hiddenType = 'TREASURE';
            const hr = Math.random();
            if (hr < 0.4) hiddenType = 'TREASURE';
            else if (hr < 0.6) hiddenType = 'SHOP';
            else if (hr < 0.8) hiddenType = 'ELITE';
            else hiddenType = 'EVENT_RISK';
            
            const hiddenNode = createNode(f, hiddenType);
            hiddenNode.hidden = true;
            hiddenNode.isRoute = isRoute;
            hiddenNodes.push(hiddenNode);
            
            // Connect from a random normal node from prevLayer (allows crossing as a 3rd option)
            const availableParents = prevLayer.filter(n => !n.isRoute);
            const p = availableParents[Math.floor(Math.random() * availableParents.length)] || prevLayer[0];
            p.children.push(hiddenNode.id);
            hiddenNode.parents.push(p.id);

            if (isRoute) {
                newActiveHiddenRouteNode = hiddenNode;
            }
        }

        const currentLayer = [...normalNodes, ...hiddenNodes];

        // Normal nodes from previous layer
        const prevVisibleNodes = prevLayer.filter(n => !n.hidden);
        
        // Connect visible nodes to current normal nodes avoiding crossing
        prevVisibleNodes.forEach((p, pIndex) => {
            const relPos = pIndex / Math.max(1, prevVisibleNodes.length - 1);
            
            // Sort normalNodes by how close their relative position is to relPos
            const sortedTargets = [...normalNodes].sort((a, b) => {
                const aPos = normalNodes.indexOf(a) / Math.max(1, normalNodes.length - 1);
                const bPos = normalNodes.indexOf(b) / Math.max(1, normalNodes.length - 1);
                return Math.abs(aPos - relPos) - Math.abs(bPos - relPos);
            });
            
            // Pick 1 or 2 closest. 1 forward connection happens roughly 20% of the time.
            const numChoices = Math.min(normalNodes.length, Math.random() < 0.2 ? 1 : 2);
            const targets = sortedTargets.slice(0, numChoices);
            
            targets.forEach(t => {
                if (!p.children.includes(t.id)) {
                    p.children.push(t.id);
                    t.parents.push(p.id);
                }
            });
        });

        // Ensure all normalNodes have at least one VISIBLE parent
        normalNodes.forEach(c => {
            const hasVisibleParent = c.parents.some(pId => prevVisibleNodes.find(pn => pn.id === pId));
            if (!hasVisibleParent) {
                // Find closest visible parent
                const cPos = normalNodes.indexOf(c) / Math.max(1, normalNodes.length - 1);
                const sortedParents = [...prevVisibleNodes].sort((a, b) => {
                    const aPos = prevVisibleNodes.indexOf(a) / Math.max(1, prevVisibleNodes.length - 1);
                    const bPos = prevVisibleNodes.indexOf(b) / Math.max(1, prevVisibleNodes.length - 1);
                    return Math.abs(aPos - cPos) - Math.abs(bPos - cPos);
                });
                const p = sortedParents[0] || prevVisibleNodes[0] || prevLayer[0];
                if (!p.children.includes(c.id)) p.children.push(c.id);
                if (!c.parents.includes(p.id)) c.parents.push(p.id);
            }
        });

        // Now handle hidden single nodes from prev layer
        const prevHiddenSingleNodes = prevLayer.filter(n => n.hidden && !n.isRoute);
        prevHiddenSingleNodes.forEach(p => {
            // connect to 1 or 2 random normal nodes (allows crossing back as a 3rd option)
            let targets = [...normalNodes].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1);
            targets.forEach(t => {
                if (!p.children.includes(t.id)) {
                    p.children.push(t.id);
                    t.parents.push(p.id);
                }
            });
        });

        map.push(currentLayer);
        prevLayer = currentLayer;
        activeHiddenRouteNode = newActiveHiddenRouteNode;
    }

    // Boss Floor
    const bossNode = createNode(totalFloors, 'BOSS');
    prevLayer.forEach(p => {
        p.children.push(bossNode.id);
        bossNode.parents.push(p.id);
    });
    map.push([bossNode]);

    return map;
}

export function showMap() {
    saveGameState();
    const mapOverlay = document.getElementById('map-overlay');
    const container = document.getElementById('map-container');
    const choicesContainer = document.getElementById('map-choices-container');
    
    // Hide battle elements if they are visible
    document.getElementById('game-container')?.classList.add('hidden');
    document.getElementById('treasure-overlay').classList.add('hidden');
    
    mapOverlay.classList.remove('hidden');
    
    renderMapNodes(container);
    renderMapChoices(choicesContainer);
}

function renderMapNodes(container) {
    container.innerHTML = '';
    
    // Reverse the map array to show BOSS at top and START at bottom
    const reversedMap = [...gameState.towerMap].reverse();
    const mapHeight = reversedMap.length;
    
    // Draw SVG connections
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    // Height will be updated to match scrollHeight after nodes are added
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';
    container.appendChild(svg);
    
    const nodeElements = {};
    const layers = [];
    
    // Create node elements
    reversedMap.forEach((layerNodes, revIndex) => {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'flex justify-around items-center w-full my-6 z-10 relative';
        
        layerNodes.forEach(node => {
            const nodeDiv = document.createElement('div');
            const isCurrent = gameState.currentMapNode && gameState.currentMapNode.id === node.id;
            const isPast = gameState.currentFloorIndex > node.floor;
            const isSelectable = gameState.currentMapNode && gameState.currentMapNode.children.includes(node.id);
            
            let icon = 'help-circle';
            let colorClass = 'text-slate-500';
            let bgClass = 'bg-slate-800 border-slate-700';
            
            if (node.type === 'START') { icon = 'flag'; colorClass = 'text-emerald-400'; }
            else if (node.type === 'WEAK_BATTLE') { icon = 'sword'; colorClass = 'text-lime-400'; }
            else if (node.type === 'BATTLE') { icon = 'swords'; colorClass = 'text-rose-400'; }
            else if (node.type === 'ELITE') { icon = 'skull'; colorClass = 'text-rose-600'; }
            else if (node.type === 'TREASURE') { icon = 'gem'; colorClass = 'text-amber-400'; }
            else if (node.type === 'SHOP') { icon = 'store'; colorClass = 'text-sky-400'; }
            else if (node.type === 'EVENT_SAFE') { icon = 'help-circle'; colorClass = 'text-sky-300'; }
            else if (node.type === 'EVENT_RISK') { icon = 'alert-triangle'; colorClass = 'text-rose-500'; }
            else if (node.type === 'BOSS') { icon = 'skull'; colorClass = 'text-purple-500'; bgClass = 'bg-slate-800 animate-pulse border-purple-500/50 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-125'; }
            
            // Hidden logic
            if (node.hidden) {
                const isParentCurrent = gameState.currentMapNode && node.parents.includes(gameState.currentMapNode.id);
                const isPastOrCurrent = gameState.currentFloorIndex >= node.floor;
                if (!isParentCurrent && !isPastOrCurrent) {
                    return; // skip rendering
                }
                // Special style for revealed hidden nodes
                if (!isPastOrCurrent) {
                    bgClass = 'bg-slate-800 border-amber-400 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]';
                }
            }

            if (isCurrent) {
                bgClass = 'bg-slate-700 border-emerald-400 animate-pulse';
                colorClass = 'text-emerald-400';
            } else if (isPast) {
                bgClass = 'bg-slate-900 border-slate-800';
                colorClass = 'text-slate-600';
            } else if (isSelectable) {
                if (!node.hidden) {
                    bgClass = 'bg-slate-800 border-sky-400';
                }
            }
            
            nodeDiv.className = `w-12 h-12 rounded-full border-2 ${bgClass} flex justify-center items-center relative transition-all`;
            nodeDiv.innerHTML = `<i data-lucide="${icon}" class="w-6 h-6 ${colorClass}"></i>`;
            nodeDiv.id = `ui-${node.id}`;
            
            layerDiv.appendChild(nodeDiv);
            nodeElements[node.id] = { node, element: nodeDiv, layerIndex: mapHeight - 1 - revIndex };
        });
        
        layers.push(layerDiv);
        container.appendChild(layerDiv);
    });
    
    // Draw lines after layout is settled
    setTimeout(() => {
        // Adjust SVG height to cover full scrollable area
        svg.style.height = Math.max(container.scrollHeight, container.clientHeight) + 'px';
        const containerRect = container.getBoundingClientRect();
        
        Object.values(nodeElements).forEach(({ node, element }) => {
            const rect = element.getBoundingClientRect();
            const x1 = rect.left - containerRect.left + container.scrollLeft + rect.width / 2;
            const y1 = rect.top - containerRect.top + container.scrollTop + rect.height / 2;
            
            node.children.forEach(childId => {
                if (nodeElements[childId]) {
                    const childElement = nodeElements[childId].element;
                    const childRect = childElement.getBoundingClientRect();
                    const x2 = childRect.left - containerRect.left + container.scrollLeft + childRect.width / 2;
                    const y2 = childRect.top - containerRect.top + container.scrollTop + childRect.height / 2;
                    
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', x1);
                    line.setAttribute('y1', y1);
                    line.setAttribute('x2', x2);
                    line.setAttribute('y2', y2);
                    
                    // Style line based on if it's a taken path
                    const isTakenPath = node.visited && nodeElements[childId].node.visited;
                    
                    line.setAttribute('stroke', isTakenPath ? '#34d399' : '#334155');
                    line.setAttribute('stroke-width', '3');
                    line.setAttribute('stroke-dasharray', isTakenPath ? '0' : '5,5');
                    
                    if (isTakenPath) {
                        line.style.zIndex = '1';
                        // Keep taken paths on top of un-taken ones
                        svg.appendChild(line);
                    } else {
                        svg.insertBefore(line, svg.firstChild);
                    }
                }
            });
        });
        
        // Scroll to current node
        if (gameState.currentMapNode && nodeElements[gameState.currentMapNode.id]) {
            const currentElement = nodeElements[gameState.currentMapNode.id].element;
            const containerRect = container.getBoundingClientRect();
            const elementRect = currentElement.getBoundingClientRect();
            
            // Calculate absolute top relative to the scroll container's content
            const absoluteElementTop = elementRect.top - containerRect.top + container.scrollTop;
            
            // Target scroll so the element is roughly 250px above the bottom of the visible container area (avoiding the footer)
            const targetScrollTop = absoluteElementTop - container.clientHeight + 250;
            container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
        } else {
            container.scrollTop = container.scrollHeight;
        }
        
        lucide.createIcons();
    }, 50);
}

function renderMapChoices(container) {
    container.innerHTML = '';
    if (!gameState.currentMapNode) return;
    
    const childrenIds = gameState.currentMapNode.children;
    
    if (childrenIds.length === 0) {
        // Extend the map by generating next set of floors
        const currentFloor = gameState.currentFloorIndex;
        const newMapPart = generateTowerMap(7); // generates 0 to 7. 0 is start node.
        
        // Fix up floor numbers and IDs
        for(let i = 1; i < newMapPart.length; i++) {
             const layer = newMapPart[i];
             layer.forEach(n => {
                 n.floor += currentFloor;
                 n.id = n.id + `_ext_${currentFloor}`;
                 // also update references in parents and children for intra-newMapPart connections
                 n.parents = n.parents.map(pId => pId + `_ext_${currentFloor}`);
                 n.children = n.children.map(cId => cId + `_ext_${currentFloor}`);
             });
        }
        
        // Connect boss node to new layer 1
        const newLayer1 = newMapPart[1];
        const newStartNode = newMapPart[0][0];
        
        newLayer1.forEach(n => {
            // Replace the newStartNode's ID in the parents array with the boss node's ID
            n.parents = n.parents.map(pId => pId.includes('node-0_ext') || pId === newStartNode.id ? gameState.currentMapNode.id : pId);
            gameState.currentMapNode.children.push(n.id);
        });
        
        // Append new layers to towerMap
        for(let i = 1; i < newMapPart.length; i++) {
             gameState.towerMap.push(newMapPart[i]);
        }
        
        // Re-render map after extending
        showMap();
        return;
    }
    
    const nextLayer = gameState.towerMap[gameState.currentFloorIndex + 1];
    
    childrenIds.forEach(childId => {
        const targetNode = nextLayer.find(n => n.id === childId);
        if (!targetNode) return;
        
        const btn = document.createElement('button');
        
        let icon = 'swords';
        let label = 'BATTLE';
        let bgClass = 'bg-rose-950/40 border-rose-900 text-rose-300 hover:bg-rose-900/60 hover:border-rose-700 hover:text-rose-100';
        let iconColor = 'text-rose-400 group-hover:text-rose-200';
        
        if (targetNode.type === 'TREASURE') {
            icon = 'gem';
            label = 'TREASURE';
            bgClass = 'bg-amber-950/40 border-amber-900 text-amber-300 hover:bg-amber-900/60 hover:border-amber-700 hover:text-amber-100';
            iconColor = 'text-amber-400 group-hover:text-amber-200';
        } else if (targetNode.type === 'SHOP') {
            icon = 'store';
            label = 'SHOP';
            bgClass = 'bg-sky-950/40 border-sky-900 text-sky-300 hover:bg-sky-900/60 hover:border-sky-700 hover:text-sky-100';
            iconColor = 'text-sky-400 group-hover:text-sky-200';
        } else if (targetNode.type === 'EVENT_SAFE') {
            icon = 'help-circle';
            label = 'EVENT';
            bgClass = 'bg-sky-950/40 border-sky-900 text-sky-300 hover:bg-sky-900/60 hover:border-sky-700 hover:text-sky-100';
            iconColor = 'text-sky-400 group-hover:text-sky-200';
        } else if (targetNode.type === 'EVENT_RISK') {
            icon = 'alert-triangle';
            label = 'EVENT';
            bgClass = 'bg-rose-950/40 border-rose-900 text-rose-300 hover:bg-rose-900/60 hover:border-rose-700 hover:text-rose-100';
            iconColor = 'text-rose-500 group-hover:text-rose-300';
        } else if (targetNode.type === 'WEAK_BATTLE') {
            icon = 'sword';
            label = 'WEAK';
            bgClass = 'bg-lime-950/40 border-lime-800 text-lime-200 hover:bg-lime-900/60 hover:border-lime-500 hover:text-white';
            iconColor = 'text-lime-500 group-hover:text-lime-300';
        } else if (targetNode.type === 'ELITE') {
            icon = 'skull';
            label = 'ELITE';
            bgClass = 'bg-rose-950/40 border-rose-600 text-rose-200 hover:bg-rose-900/60 hover:border-rose-400 hover:text-white hover:shadow-[0_0_10px_rgba(225,29,72,0.5)]';
            iconColor = 'text-rose-600 group-hover:text-rose-400';
        } else if (targetNode.type === 'BOSS') {
            icon = 'skull';
            label = 'BOSS';
            bgClass = 'bg-rose-950 border-rose-600 text-white hover:bg-rose-900 hover:border-rose-400 hover:shadow-[0_0_15px_rgba(225,29,72,0.5)]';
            iconColor = 'text-rose-400 group-hover:text-white';
        }
        
        if (targetNode.hidden) {
            bgClass += ' ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-900 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]';
            label = 'HIDDEN';
        }
        
        btn.className = `command-btn group w-24 h-24 flex flex-col items-center justify-center border-2 rounded-2xl transition-all shadow-lg backdrop-blur-sm relative overflow-hidden active:scale-95 ${bgClass}`;
        
        btn.innerHTML = `
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
            <i data-lucide="${icon}" class="w-8 h-8 mb-2 z-10 transition-colors drop-shadow-md ${iconColor}"></i>
            <span class="font-orbitron font-black text-[10px] tracking-widest z-10 transition-colors uppercase">${label}</span>
        `;
        
        btn.onclick = () => window.enterRoom(targetNode);
        container.appendChild(btn);
    });
    
    lucide.createIcons();
}

window.enterRoom = (node) => {
    sound.playSE('click');
    node.visited = true;
    gameState.currentMapNode = node;
    gameState.currentFloorIndex = node.floor;
    gameState.floor = node.floor; // Sync with existing floor logic
    
    document.getElementById('current-floor-val').innerText = String(gameState.floor);
    
    const mapOverlay = document.getElementById('map-overlay');
    mapOverlay.classList.add('hidden');
    
    // Route to appropriate handler
    if (node.type === 'BATTLE' || node.type === 'BOSS' || node.type === 'ELITE' || node.type === 'WEAK_BATTLE') {
        // Battle
        const deck = (node.type === 'BOSS') ? gameState.bossDeck : gameState.mobDeck;
        const charId = deck.draw();
        gameState.cChar = CHARACTERS.find(c => c.id === charId) || BOSS_CHARACTERS.find(c => c.id === charId);
        
        gameState.nextBattleIsElite = (node.type === 'ELITE');
        gameState.nextBattleIsWeak = (node.type === 'WEAK_BATTLE');
        setupBattleState();
    } else if (node.type === 'TREASURE') {
        // Treasure
        handleTreasureRoom();
    } else if (node.type === 'SHOP') {
        // Shop
        handleShopRoom();
    } else if (node.type === 'EVENT_SAFE' || node.type === 'EVENT_RISK') {
        // Event
        showEvent(node.type);
    }
};

export function setupEventScreen(title, desc, npcIcon, npcColor, options) {
    const battleArea = document.getElementById('enemy-area');
    const eventNpcArea = document.getElementById('event-npc-area');
    const commandWrapper = document.getElementById('command-wrapper');
    const eventCommandWrapper = document.getElementById('event-command-wrapper');
    const iconContainer = document.getElementById('event-npc-icon-container');
    const titleEl = document.getElementById('event-ui-title');
    const descEl = document.getElementById('event-ui-desc');
    const nameLabel = document.getElementById('event-npc-name-label');

    // Toggle views
    battleArea.classList.add('hidden');
    eventNpcArea.classList.remove('hidden');
    commandWrapper.classList.add('hidden');
    eventCommandWrapper.classList.remove('hidden');

    // Set NPC Icon
    iconContainer.innerHTML = `<i data-lucide="${npcIcon}" class="w-20 h-20 ${npcColor} drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"></i>`;
    
    // Set Texts
    titleEl.innerText = title;
    titleEl.className = `text-3xl font-black font-orbitron italic tracking-widest uppercase mb-1 drop-shadow-md ${npcColor}`;
    descEl.innerText = desc;
    nameLabel.innerText = title;

    // Set Buttons
    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`event-cmd-${i}`);
        if (options[i]) {
            const opt = options[i];
            
            let colorClass = opt.colorClass || 'bg-slate-700 hover:bg-slate-600 text-slate-200';
            btn.className = `command-btn ${colorClass} w-24 h-24 flex flex-col items-center justify-center rounded-2xl shadow-lg border-2 border-white/10 transition-all hover:scale-105 active:scale-95`;
            
            if (opt.disabled) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.classList.remove('hover:scale-105', 'active:scale-95');
                btn.onclick = null;
            } else {
                btn.onclick = () => {
                    if (window.sound) window.sound.playSE('click');
                    opt.onClick();
                };
            }
            btn.innerHTML = `<i data-lucide="${opt.icon || 'circle'}" class="w-8 h-8 mb-2"></i><span class="text-xs font-bold font-orbitron tracking-wider">${opt.text}</span>`;
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    }
    
    if (window.lucide) window.lucide.createIcons();
}

export function closeEventScreen() {
    document.getElementById('enemy-area').classList.remove('hidden');
    document.getElementById('event-npc-area').classList.add('hidden');
    document.getElementById('command-wrapper').classList.remove('hidden');
    document.getElementById('event-command-wrapper').classList.add('hidden');
}

export function showEvent(nodeType = 'EVENT_SAFE', debugForceType = null) {
    // Helper to close event and proceed to map
    const closeEvent = () => {
        closeEventScreen();
        showMap();
    };

    const safeEvents = [
        'GOLD', 'FREE_BUFF', 'EXTRA_LIFE', 'SKILL_DROP', 'SKILL_UPGRADE', 
        'HIDDEN_TREASURE', 'DISCOUNT_SHOP', 'WEAK_ENEMY', 'WEAK_BOSS', 
        'LEGEND_TREASURE', 'STATUE_BLESSING', 'MEGA_GOLD'
    ];
    
    const riskEvents = [
        'TRAP', 'TRIAL', 'MINI_BOSS', 'ELITE_WARNING', 'STRONG_BOSS', 
        'CURSED_TREASURE', 'PAY_SKILL_UPGRADE', 'SKILL_SELL', 'TIME_LEAP', 'STATUE_GREET'
    ];

    const eventTypes = nodeType === 'EVENT_RISK' ? riskEvents : safeEvents;
    let eType = debugForceType || eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    // Reroll logic
    if (['SKILL_UPGRADE', 'PAY_SKILL_UPGRADE', 'SKILL_SELL'].includes(eType) && !gameState.playerSkill) {
        eType = 'FREE_BUFF';
    }
    if (eType === 'TIME_LEAP' && gameState.floor < 3) {
        eType = 'GOLD';
    }

    let title = 'Unknown Event';
    let desc = '...';
    let npcIcon = 'help-circle';
    let npcColor = 'text-purple-400';
    let options = [];

    if (eType === 'GOLD') {
        title = 'Lucky Encounter';
        npcColor = 'text-amber-400';
        npcIcon = 'coins';
        desc = '隠された宝箱を見つけた！\nコインを獲得した。';
        options.push({ text: 'Continue', icon: 'arrow-right', onClick: () => {
            gameState.gold += Math.floor(Math.random() * 20) + 15;
            updateUI();
            closeEvent();
        }, colorClass: 'bg-amber-900 text-amber-200 border-amber-600 hover:bg-amber-800' });
    } else if (eType === 'MEGA_GOLD') {
        title = 'Treasure Hoard';
        npcColor = 'text-amber-300';
        npcIcon = 'gem';
        desc = 'まばゆく光る大量の金貨の山を発見した！';
        options.push({ text: 'Take all', icon: 'coins', onClick: () => {
            gameState.gold += Math.floor(Math.random() * 51) + 50;
            updateUI();
            closeEvent();
        }, colorClass: 'bg-amber-900 text-amber-200 border-amber-600 hover:bg-amber-800' });
    } else if (eType === 'TRAP') {
        title = 'Ambush!';
        npcColor = 'text-rose-500';
        npcIcon = 'alert-triangle';
        desc = '罠にかかってしまった！HPにダメージを受けた。';
        options.push({ text: 'Ouch...', icon: 'skull', onClick: () => {
            gameState.pHP = Math.max(1, gameState.pHP - 10);
            gameState.player.hp = gameState.pHP;
            updateUI();
            closeEvent();
        }, colorClass: 'bg-rose-900 text-rose-200 border-rose-600 hover:bg-rose-800' });
    } else if (eType === 'FREE_BUFF') {
        title = 'Blessing';
        npcColor = 'text-sky-400';
        npcIcon = 'sparkles';
        const merit = ITEM_EFFECTS.MERITS[Math.floor(Math.random() * ITEM_EFFECTS.MERITS.length)];
        const val = merit.valueRange[0] + Math.floor(Math.random() * (merit.valueRange[1] - merit.valueRange[0] + 1));
        desc = `不思議な光があなたを包み込む...\n\n${merit.text.replace('$V', val)}`;
        options.push({ text: 'Accept', icon: 'check', onClick: () => {
            merit.apply(gameState.pChar, val);
            updateUI();
            closeEvent();
        }, colorClass: 'bg-sky-900 text-sky-200 border-sky-600 hover:bg-sky-800' });
    } else if (eType === 'TRIAL') {
        title = 'Dark Trial';
        npcColor = 'text-purple-500';
        npcIcon = 'ghost';
        desc = '「試練を受けよ...」\nHPの最大値が10減るが、攻撃力が5上がる。';
        options.push({ text: 'Accept', icon: 'sword', onClick: () => {
            gameState.pChar.hp = Math.max(1, gameState.pChar.hp - 10);
            gameState.pHP = Math.min(gameState.pHP, gameState.pChar.hp);
            gameState.pChar.atk += 5;
            gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
            updateUI();
            closeEvent();
        }, colorClass: 'bg-purple-900 text-purple-200 border-purple-600 hover:bg-purple-800' });
        options.push({ text: 'Refuse', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'MINI_BOSS') {
        title = 'Fierce Monster';
        npcColor = 'text-red-500';
        npcIcon = 'flame';
        desc = '凶暴な魔物が立ち塞がっている！\n倒せば多額の報酬が得られそうだ。';
        options.push({ text: 'Fight', icon: 'swords', onClick: () => {
            closeEventScreen();
            gameState.nextBattleIsElite = true;
            setupBattleState();
        }, colorClass: 'bg-red-900 text-red-200 border-red-600 hover:bg-red-800' });
        options.push({ text: 'Flee', icon: 'footprints', onClick: () => closeEvent() });
    } else if (eType === 'EXTRA_LIFE') {
        title = 'Fountain of Life';
        npcColor = 'text-pink-400';
        npcIcon = 'heart';
        desc = '清らかな泉が湧き出ている。飲むとHPが最大まで回復し、最大HPも増えそうだ。';
        options.push({ text: 'Drink', icon: 'droplet', onClick: () => {
            gameState.pChar.hp += 10;
            gameState.pHP = gameState.pChar.hp;
            gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
            updateUI();
            closeEvent();
        }, colorClass: 'bg-pink-900 text-pink-200 border-pink-600 hover:bg-pink-800' });
        options.push({ text: 'Leave it', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'SKILL_DROP') {
        title = 'Forgotten Tome';
        npcColor = 'text-indigo-400';
        npcIcon = 'book-open';
        const skill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        let sdesc = skill.description;
        skill.effectValues.forEach(v => sdesc = sdesc.replace('?', v));
        desc = `古い魔導書を見つけた。\n現在のスキルを忘れ、「${skill.name}」を習得する。\n\n【効果】 ${sdesc} (コスト: ${skill.cost})`;
        options.push({ text: 'Learn', icon: 'book', onClick: () => {
            gameState.playerSkill = skill;
            gameState.pChar.skillCostBonus = 0;
            gameState.pChar.skillEffectBonus = 0;
            closeEvent();
        }, colorClass: 'bg-indigo-900 text-indigo-200 border-indigo-600 hover:bg-indigo-800' });
        options.push({ text: 'Leave it', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'SKILL_UPGRADE') {
        title = 'Skill Master';
        npcColor = 'text-blue-400';
        npcIcon = 'graduation-cap';
        desc = '熟練の魔導士がいる。\n「君のスキル、少しだけ改良してあげよう」';
        options.push({ text: 'Accept', icon: 'wrench', onClick: () => {
            gameState.pChar.skillCostBonus = (gameState.pChar.skillCostBonus || 0) - 1;
            closeEvent();
        }, colorClass: 'bg-blue-900 text-blue-200 border-blue-600 hover:bg-blue-800' });
        options.push({ text: 'Refuse', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'PAY_SKILL_UPGRADE') {
        title = 'Mystic Blacksmith';
        npcColor = 'text-orange-400';
        npcIcon = 'hammer';
        desc = `「コインを払えば、アンタのスキル『${gameState.playerSkill.name}』を強化してやるよ」`;
        const currentCost = Math.max(0, gameState.playerSkill.cost + (gameState.pChar.skillCostBonus || 0));
        if (currentCost > 0) {
            options.push({ text: 'Cost Down', icon: 'arrow-down', disabled: gameState.gold < 50, onClick: () => {
                gameState.gold -= 50;
                document.getElementById('player-gold-val').innerText = gameState.gold;
                gameState.pChar.skillCostBonus = (gameState.pChar.skillCostBonus || 0) - 1;
                closeEvent();
            }, colorClass: 'bg-orange-900 text-orange-200 border-orange-600 hover:bg-orange-800' });
        }
        options.push({ text: 'Effect Boost', icon: 'arrow-up', disabled: gameState.gold < 30, onClick: () => {
            gameState.gold -= 30;
            updateUI();
            gameState.pChar.skillEffectBonus = (gameState.pChar.skillEffectBonus || 0) + 1;
            closeEvent();
        }, colorClass: 'bg-red-900 text-red-200 border-red-600 hover:bg-red-800' });
        options.push({ text: 'Leave', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'SKILL_SELL') {
        title = 'Skill Merchant';
        npcColor = 'text-emerald-400';
        npcIcon = 'shopping-bag';
        desc = `「君のスキル『${gameState.playerSkill.name}』、なかなか良いものだ。60Gで買い取らせてくれないか？」\n（スキルを失います）`;
        options.push({ text: 'Sell (60G)', icon: 'coins', onClick: () => {
            gameState.gold += 60;
            updateUI();
            gameState.playerSkill = null;
            gameState.pChar.skillCostBonus = 0;
            gameState.pChar.skillEffectBonus = 0;
            closeEvent();
        }, colorClass: 'bg-emerald-900 text-emerald-200 border-emerald-600 hover:bg-emerald-800' });
        options.push({ text: 'Refuse', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'HIDDEN_TREASURE') {
        title = 'Hidden Room';
        npcColor = 'text-yellow-400';
        npcIcon = 'key';
        desc = '隠し部屋を見つけた！どうやら宝箱があるようだ。';
        options.push({ text: 'Open Chest', icon: 'package', onClick: () => {
            closeEventScreen();
            showTreasure();
        }, colorClass: 'bg-yellow-900 text-yellow-200 border-yellow-600 hover:bg-yellow-800' });
        options.push({ text: 'Leave', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'DISCOUNT_SHOP') {
        title = 'Black Market';
        npcColor = 'text-purple-400';
        npcIcon = 'store';
        desc = '怪しげな商人を見つけた。「良い品を安く売るぜ...」';
        options.push({ text: 'Trade', icon: 'shopping-cart', onClick: () => {
            closeEventScreen();
            showShop(true);
        }, colorClass: 'bg-purple-900 text-purple-200 border-purple-600 hover:bg-purple-800' });
        options.push({ text: 'Leave', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'WEAK_ENEMY') {
        title = 'Sleeping Goblin';
        npcColor = 'text-lime-500';
        npcIcon = 'moon';
        desc = 'ゴブリンが居眠りをしている。';
        options.push({ text: 'Sneak Attack', icon: 'sword', onClick: () => {
            closeEventScreen();
            gameState.nextBattleEffects = [{ type: 'DMG_REDUCE', amount: 999, turns: 1 }];
            setupBattleState();
        }, colorClass: 'bg-lime-900 text-lime-200 border-lime-600 hover:bg-lime-800' });
        options.push({ text: 'Ignore', icon: 'footprints', onClick: () => closeEvent() });
    } else if (eType === 'INVINCIBLE_BUFF') {
        title = 'Aegis Blessing';
        npcColor = 'text-sky-300';
        npcIcon = 'shield';
        desc = '女神の加護を得た！\n次の戦闘で開始から3ターンの間、受けるダメージを軽減する。';
        options.push({ text: 'Accept', icon: 'check', onClick: () => {
            if (!gameState.nextBattleEffects) gameState.nextBattleEffects = [];
            gameState.nextBattleEffects.push({ type: 'DMG_REDUCE', amount: 999, turns: 3 });
            closeEvent();
        }, colorClass: 'bg-sky-900 text-sky-200 border-sky-600 hover:bg-sky-800' });
    } else if (eType === 'ATK_BOOST_BUFF') {
        title = 'Warrior\'s Blood';
        npcColor = 'text-rose-400';
        npcIcon = 'swords';
        desc = '戦士の血が滾る！\n次の戦闘で開始から3ターンの間、攻撃力(ATK)が現在の2倍になる。';
        options.push({ text: 'Accept', icon: 'check', onClick: () => {
            if (!gameState.nextBattleEffects) gameState.nextBattleEffects = [];
            gameState.nextBattleEffects.push({ type: 'ATK_UP', amount: gameState.pChar.atk, turns: 3 });
            closeEvent();
        }, colorClass: 'bg-rose-900 text-rose-200 border-rose-600 hover:bg-rose-800' });
    } else if (eType === 'CHG_BOOST_BUFF') {
        title = 'Mage\'s Insight';
        npcColor = 'text-purple-400';
        npcIcon = 'zap';
        desc = '魔導の真理を垣間見た！\n次の戦闘で開始から3ターンの間、チャージ効率が2倍になる。';
        options.push({ text: 'Accept', icon: 'check', onClick: () => {
            if (!gameState.nextBattleEffects) gameState.nextBattleEffects = [];
            gameState.nextBattleEffects.push({ type: 'CHGE_UP', amount: gameState.pChar.chgE, turns: 3 });
            closeEvent();
        }, colorClass: 'bg-purple-900 text-purple-200 border-purple-600 hover:bg-purple-800' });
    } else if (eType === 'ELITE_WARNING') {
        title = 'Ominous Presence';
        npcColor = 'text-red-600';
        npcIcon = 'skull';
        desc = '恐ろしい気配を感じる... この先には強敵が待ち構えているだろう。';
        options.push({ text: 'Prepare', icon: 'shield', onClick: () => {
            if (!gameState.nextBattleEffects) gameState.nextBattleEffects = [];
            gameState.nextBattleEffects.push({ type: 'DMG_REDUCE', amount: 20, turns: 2 });
            closeEvent();
        }, colorClass: 'bg-red-900 text-red-200 border-red-600 hover:bg-red-800' });
    } else if (eType === 'TIME_LEAP') {
        title = 'Time Distortion';
        npcColor = 'text-cyan-400';
        npcIcon = 'clock';
        desc = '時空の歪みを発見した。これを使えば少し前に戻れるかもしれない。';
        options.push({ text: 'Leap (-2 Floors)', icon: 'rewind', onClick: () => {
            gameState.floor = Math.max(1, gameState.floor - 2);
            closeEvent();
        }, colorClass: 'bg-cyan-900 text-cyan-200 border-cyan-600 hover:bg-cyan-800' });
        options.push({ text: 'Ignore', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'WEAK_BOSS') {
        title = 'Injured Beast';
        npcColor = 'text-rose-300';
        npcIcon = 'bug';
        desc = '手負いの魔物がいる。弱っているようだが...';
        options.push({ text: 'Attack', icon: 'sword', onClick: () => {
            closeEventScreen();
            gameState.nextBattleIsElite = true;
            setupBattleState();
            const baseChar = CHARACTERS.find(c => c.id === gameState.cpu.id) || BOSS_CHARACTERS.find(c => c.id === gameState.cpu.id);
            if (baseChar) {
                gameState.cChar.hp = Math.max(1, Math.floor(baseChar.hp / 2));
                gameState.cChar.atk = Math.max(1, Math.floor(baseChar.atk / 2));
                gameState.cpu = JSON.parse(JSON.stringify(gameState.cChar));
                gameState.cHP = gameState.cpu.hp;
                updateUI();
            }
        }, colorClass: 'bg-rose-900 text-rose-200 border-rose-600 hover:bg-rose-800' });
        options.push({ text: 'Leave', icon: 'footprints', onClick: () => closeEvent() });
    } else if (eType === 'STRONG_BOSS') {
        title = 'Enraged Beast';
        npcColor = 'text-red-700';
        npcIcon = 'flame';
        desc = '怒り狂う強大な魔物がいる！倒せば莫大な報酬が手に入るだろう。';
        options.push({ text: 'Challenge', icon: 'swords', onClick: () => {
            closeEventScreen();
            gameState.nextBattleIsElite = true;
            setupBattleState();
            const baseChar = CHARACTERS.find(c => c.id === gameState.cpu.id) || BOSS_CHARACTERS.find(c => c.id === gameState.cpu.id);
            if (baseChar) {
                gameState.cChar.hp = Math.floor(baseChar.hp * 1.5);
                gameState.cChar.atk = Math.floor(baseChar.atk * 1.5);
                gameState.cpu = JSON.parse(JSON.stringify(gameState.cChar));
                gameState.cHP = gameState.cpu.hp;
                gameState.nextBattleEffects = [{ type: 'REWARD_UP', amount: 3, turns: 99 }];
                updateUI();
            }
        }, colorClass: 'bg-red-900 text-red-200 border-red-600 hover:bg-red-800' });
        options.push({ text: 'Flee', icon: 'footprints', onClick: () => closeEvent() });
    } else if (eType === 'CURSED_TREASURE') {
        title = 'Cursed Chest';
        npcColor = 'text-purple-600';
        npcIcon = 'package-x';
        desc = '禍々しいオーラを放つ宝箱がある。\n開けると強力な呪いを受けるが、中身は期待できそうだ。';
        options.push({ text: 'Open (-15 HP)', icon: 'key', onClick: () => {
            gameState.pHP = Math.max(1, gameState.pHP - 15);
            gameState.player.hp = gameState.pHP;
            updateUI();
            closeEventScreen();
            showTreasure(true);
        }, colorClass: 'bg-purple-900 text-purple-200 border-purple-600 hover:bg-purple-800' });
        options.push({ text: 'Leave it', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'LEGEND_TREASURE') {
        title = 'Legendary Shrine';
        npcColor = 'text-amber-500';
        npcIcon = 'crown';
        const legends = SKILLS.filter(s => s.rarity === 'LEGENDARY');
        const skill = legends[Math.floor(Math.random() * legends.length)];
        let sdesc = skill.description;
        skill.effectValues.forEach(v => sdesc = sdesc.replace('?', v));
        desc = `黄金に輝く祠がある。\n伝説のスキル「${skill.name}」を習得できる。\n（現在のスキルは上書きされます）\n\n【効果】 ${sdesc} (コスト: ${skill.cost})`;
        options.push({ text: 'Learn', icon: 'star', onClick: () => {
            gameState.playerSkill = skill;
            closeEvent();
        }, colorClass: 'bg-amber-900 text-amber-200 border-amber-600 hover:bg-amber-800' });
        options.push({ text: 'Leave', icon: 'x', onClick: () => closeEvent() });
    } else if (eType === 'STATUE_GREET') {
        title = 'Mysterious Statue';
        npcColor = 'text-slate-400';
        npcIcon = 'castle';
        desc = '古びた石像がぽつんと置かれている。';
        options.push({ text: 'Touch', icon: 'hand', onClick: () => {
            setupEventScreen('Mysterious Statue', '「こんにちは」\n\n石像が喋った！…が、それ以外は何も起こらなかった。', 'castle', 'text-slate-400', [
                { text: '...', icon: 'more-horizontal', onClick: () => closeEvent() }
            ]);
        } });
    } else if (eType === 'STATUE_BLESSING') {
        title = 'Miracle Statue';
        npcColor = 'text-yellow-300';
        npcIcon = 'sun';
        desc = '神々しいオーラを放つ石像が置かれている。';
        options.push({ text: 'Touch', icon: 'hand', onClick: () => {
            setupEventScreen('Miracle Statue', '「こんにちは、今日はいい日だね」\n\n石像が喋ると同時に、身体に強大な力がみなぎってきた！\n（次の戦闘で最初の3ターン：ダメージ無効化＆ATK2倍＆ChgE2倍）', 'sun', 'text-yellow-300', [
                { text: 'Receive', icon: 'check', onClick: () => {
                    if (!gameState.nextBattleEffects) gameState.nextBattleEffects = [];
                    gameState.nextBattleEffects.push({ type: 'DMG_REDUCE', amount: 999, turns: 3 });
                    gameState.nextBattleEffects.push({ type: 'ATK_UP', amount: gameState.pChar.atk, turns: 3 });
                    gameState.nextBattleEffects.push({ type: 'CHGE_UP', amount: gameState.pChar.chgE, turns: 3 });
                    closeEvent();
                }, colorClass: 'bg-yellow-900 text-yellow-200 border-yellow-600 hover:bg-yellow-800' }
            ]);
        } });
    } else {
        // Fallback for unhandled event
        options.push({ text: 'Close', onClick: () => closeEvent() });
    }

    setupEventScreen(title, desc, npcIcon, npcColor, options);
}

export function handleTreasureRoom() {
    setupEventScreen('Treasure Room', '豪華な宝箱が置かれている。\n開けてみるか？', 'package', 'text-yellow-400', [
        { text: 'Open', icon: 'key', onClick: () => {
            closeEventScreen();
            showTreasure();
        }, colorClass: 'bg-yellow-900 text-yellow-200 border-yellow-600 hover:bg-yellow-800' },
        { text: 'Leave', icon: 'footprints', onClick: () => {
            closeEventScreen();
            showMap();
        } }
    ]);
}

export function handleShopRoom(isDiscount = false) {
    if (isDiscount) {
        setupEventScreen('Black Market', '怪しい商人がこちらを見ている。\n「良い品を安く売るぜ...」', 'store', 'text-purple-400', [
            { text: 'Trade', icon: 'shopping-cart', onClick: () => {
                closeEventScreen();
                showShop(true);
            }, colorClass: 'bg-purple-900 text-purple-200 border-purple-600 hover:bg-purple-800' },
            { text: 'Leave', icon: 'footprints', onClick: () => {
                closeEventScreen();
                showMap();
            } }
        ]);
    } else {
        setupEventScreen('Merchant', '商人がこちらを見ている。\n「なにか買っていくかい？」', 'store', 'text-blue-400', [
            { text: 'Look', icon: 'shopping-cart', onClick: () => {
                closeEventScreen();
                showShop(false);
            }, colorClass: 'bg-blue-900 text-blue-200 border-blue-600 hover:bg-blue-800' },
            { text: 'Leave', icon: 'footprints', onClick: () => {
                closeEventScreen();
                showMap();
            } }
        ]);
    }
}
export function showTreasure(forceSkillPhase = false) {
    const cardsContainer = document.getElementById('event-items-container');
    const isMimic = (gameState.cpu && gameState.cpu.id === 'TREASURE_CHEST');
    const isBoss = (gameState.floor % 7 === 0);
    const options = generateTreasureOptions(isMimic, isBoss, forceSkillPhase);
    
    // Clear and Show
    cardsContainer.innerHTML = '';
    cardsContainer.classList.remove('hidden');

    // Title / Desc if needed, but since it's in main view, we can add a header inside container
    const header = document.createElement('div');
    header.className = 'w-full text-center mb-6 mt-4';
    if (forceSkillPhase) {
        header.innerHTML = '<h2 class="text-3xl font-black font-orbitron italic tracking-widest uppercase mb-1 drop-shadow-md text-amber-400">Ultimate Skill Unlocked</h2><p class="text-white font-bold text-sm leading-tight drop-shadow-md">BOSS REWARD: CHOOSE A HIGH-RANK SKILL</p>';
    } else {
        header.innerHTML = '<h2 class="text-3xl font-black font-orbitron italic tracking-widest uppercase mb-1 drop-shadow-md text-amber-400">Choose Your Reward</h2><p class="text-white font-bold text-sm leading-tight drop-shadow-md">Select one of three options</p>';
    }
    cardsContainer.appendChild(header);

    // Cards wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full flex flex-wrap items-center justify-center gap-4 px-4 pb-8';
    cardsContainer.appendChild(wrapper);

    options.forEach(option => {
        const card = document.createElement('div');
        let title, description, icon, borderColor = 'border-slate-600', textColor = 'text-white', iconColor = 'text-amber-400';
        if (option.type === 'skill') {
            const skill = option.skill;
            title = `新スキル: ${skill.name}`;
            description = `${skill.description} (コスト: ${skill.cost})`;
            icon = 'star';

            switch (skill.rarity) {
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
            }

        } else {
            title = '強化アイテム';
            if (option.demerit) {
                description = `<span class="text-emerald-400 block">+ ${option.merit.text.replace('$V', option.merit.value)}</span><span class="text-rose-500 block mt-2">- ${option.demerit.text.replace('$V', option.demerit.value)}</span>`;
            } else {
                description = `<span class="text-emerald-400 block">+ ${option.merit.text.replace('$V', option.merit.value)}</span>`;
            }
            icon = 'gem';
        }

        card.className = `w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-900 border-2 ${borderColor} p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-800 transition-all flex flex-col items-center text-center gap-4 group hover:scale-[1.05] active:scale-95`;
        card.innerHTML = `
            <div class="flex-shrink-0 mt-2">
                <i data-lucide="${icon}" class="w-12 h-12 ${iconColor}"></i>
            </div>
            <div class="flex-1 w-full flex flex-col justify-between">
                <h3 class="font-orbitron font-bold text-sm mb-2 ${textColor} leading-tight">${title}</h3>
                <div class="text-xs text-slate-400 font-bold leading-relaxed">${option.description || description}</div>
            </div>
        `;
        card.onclick = () => {
            if (window.sound) window.sound.playSE('click');
            cardsContainer.classList.add('hidden');
            selectTreasure(option, forceSkillPhase);
        };
        wrapper.appendChild(card);
    });

    // Add Skip Button unconditionally
    const skipCard = document.createElement('div');
    skipCard.className = 'w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-800 border-2 border-slate-600 p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-700 transition-all flex flex-col items-center text-center gap-4 group hover:scale-[1.05] active:scale-95 opacity-80 hover:opacity-100';
    skipCard.innerHTML = `
        <div class="flex-shrink-0 mt-2">
            <i data-lucide="skip-forward" class="w-12 h-12 text-slate-400"></i>
        </div>
        <div class="flex-1 w-full flex flex-col justify-center">
            <h3 class="font-orbitron font-bold text-sm mb-2 text-white">SKIP</h3>
            <div class="text-xs text-slate-500 font-bold uppercase">報酬を取得せずに進む</div>
        </div>
    `;
    skipCard.onclick = () => {
        if (window.sound) window.sound.playSE('click');
        cardsContainer.classList.add('hidden');
        selectTreasure({ type: 'skip' }, forceSkillPhase);
    };
    wrapper.appendChild(skipCard);

    if (window.lucide) window.lucide.createIcons();
}
export function showShop(isDiscount = false) {
    const cardsContainer = document.getElementById('event-items-container');
    
    // Clear and Show
    cardsContainer.innerHTML = '';
    cardsContainer.classList.remove('hidden');
    
    // Title
    const header = document.createElement('div');
    header.className = 'w-full text-center mb-6 mt-4';
    if (isDiscount) {
        header.innerHTML = '<h2 class="text-3xl font-black font-orbitron italic tracking-widest uppercase mb-1 drop-shadow-md text-purple-400">Black Market</h2><p class="text-white font-bold text-sm leading-tight drop-shadow-md">所持金: <span id="event-shop-gold" class="text-yellow-400">' + gameState.gold + '</span> G</p>';
    } else {
        header.innerHTML = '<h2 class="text-3xl font-black font-orbitron italic tracking-widest uppercase mb-1 drop-shadow-md text-sky-400">Merchant</h2><p class="text-white font-bold text-sm leading-tight drop-shadow-md">所持金: <span id="event-shop-gold" class="text-yellow-400">' + gameState.gold + '</span> G</p>';
    }
    cardsContainer.appendChild(header);

    // Cards wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'w-full flex flex-wrap items-center justify-center gap-4 px-4 pb-8';
    cardsContainer.appendChild(wrapper);

    // Generate 3 random items
    const shopItems = [];
    shopItems.push({
        id: 'heal',
        name: 'HP Potion',
        desc: 'Restores 30 HP',
        cost: isDiscount ? 10 : 20,
        icon: 'heart',
        action: () => {
            gameState.pHP = Math.min(gameState.pChar.hp, gameState.pHP + 30);
            gameState.player.hp = gameState.pHP;
        }
    });
    
    for(let i=0; i<2; i++) {
        const merit = ITEM_EFFECTS.MERITS[Math.floor(Math.random() * ITEM_EFFECTS.MERITS.length)];
        const val = merit.valueRange[0] + Math.floor(Math.random() * (merit.valueRange[1] - merit.valueRange[0] + 1));
        let baseCost = val * 5 + 10;
        if (isDiscount) baseCost = Math.floor(baseCost / 2);
        
        shopItems.push({
            id: merit.id,
            name: 'Enhancement',
            desc: `+ ${merit.text.replace('$V', val)}`,
            cost: baseCost,
            icon: 'gem',
            action: () => {
                merit.apply(gameState.pChar, val);
            }
        });
    }

    shopItems.forEach(item => {
        const card = document.createElement('div');
        const canAfford = gameState.gold >= item.cost;
        
        let borderColor = canAfford ? (isDiscount ? 'border-purple-500' : 'border-sky-500') : 'border-slate-700';
        let iconColor = canAfford ? (isDiscount ? 'text-purple-400' : 'text-sky-400') : 'text-slate-500';
        let cursorClass = canAfford ? 'cursor-pointer hover:bg-slate-800 hover:scale-[1.05] active:scale-95 group' : 'opacity-50 cursor-not-allowed';
        
        card.className = `w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-900 border-2 ${borderColor} p-4 rounded-xl shadow-lg transition-all flex flex-col items-center text-center gap-4 ${cursorClass}`;
        
        card.innerHTML = `
            <div class="flex-shrink-0 mt-2">
                <i data-lucide="${item.icon}" class="w-12 h-12 ${iconColor}"></i>
            </div>
            <div class="flex-1 w-full flex flex-col justify-between">
                <h3 class="font-orbitron font-bold text-sm mb-2 text-white leading-tight">${item.name}</h3>
                <div class="text-xs text-slate-400 font-bold leading-relaxed mb-2">${item.desc}</div>
                <div class="font-orbitron font-black text-amber-400 text-lg">${item.cost} G</div>
            </div>
        `;
        
        if (canAfford) {
            card.onclick = () => {
                if (window.sound) window.sound.playSE('click');
                gameState.gold -= item.cost;
                updateUI();
                document.getElementById('event-shop-gold').innerText = String(gameState.gold);
                item.action();
                gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
                updateUI();
                // 一度買ったら売り切れ（またはボタン無効化）
                card.onclick = null;
                card.className = `w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-900 border-2 border-slate-700 p-4 rounded-xl shadow-lg transition-all flex flex-col items-center text-center gap-4 opacity-50 cursor-not-allowed`;
                card.querySelector('i').className = `w-12 h-12 text-slate-500`;
                
                // 他のボタンも所持金不足になってないかチェックして更新する処理が必要だが、
                // 簡単のため、購入後はそのままショップを続けるか、または立ち去るボタンだけを残す
            };
        }
        wrapper.appendChild(card);
    });

    // Add Leave Button
    const skipCard = document.createElement('div');
    skipCard.className = 'w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-800 border-2 border-slate-600 p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-700 transition-all flex flex-col items-center text-center gap-4 group hover:scale-[1.05] active:scale-95 opacity-80 hover:opacity-100';
    skipCard.innerHTML = `
        <div class="flex-shrink-0 mt-2">
            <i data-lucide="footprints" class="w-12 h-12 text-slate-400"></i>
        </div>
        <div class="flex-1 w-full flex flex-col justify-center">
            <h3 class="font-orbitron font-bold text-sm mb-2 text-white">LEAVE</h3>
            <div class="text-xs text-slate-500 font-bold uppercase">店を出る</div>
        </div>
    `;
    skipCard.onclick = () => {
        if (window.sound) window.sound.playSE('click');
        cardsContainer.classList.add('hidden');
        showMap();
    };
    wrapper.appendChild(skipCard);

    if (window.lucide) window.lucide.createIcons();
}

export function resumeGame() {
    // UIを初期化
    if (gameState.inBattle) {
        document.getElementById('select-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('online-screen').classList.add('hidden');
        
        document.getElementById('cmd-SKILL').classList.toggle('hidden', gameState.gameMode !== 'tower');
        document.getElementById('tower-indicator').classList.toggle('hidden', gameState.gameMode !== 'tower');

        const badge = document.getElementById('cpu-level-badge');
        badge.classList.remove('bg-purple-600', 'animate-pulse', 'bg-slate-700', 'bg-rose-600', 'bg-amber-600', 'bg-blue-600');

        if (gameState.gameMode === 'tower') {
            document.getElementById('current-floor-val').innerText = String(gameState.floor);
            const isBoss = (gameState.floor > 0 && gameState.floor % 7 === 0);
            const bossIn = 7 - ((gameState.floor - 1) % 7);
            document.getElementById('boss-in-val').innerText = isBoss ? 'BOSS' : String(bossIn);

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
            badge.innerText = "PLAYER 2";
            badge.classList.add('bg-blue-600');
            badge.classList.remove('hidden');
        } else {
            badge.innerText = gameState.aiLevel;
            badge.classList.add('bg-rose-600');
            badge.classList.remove('hidden');
        }

        document.getElementById('player-name-label').innerText = gameState.player.name;
        document.getElementById('cpu-name-label').innerText = gameState.cpu.name;
        
        let playerIconHtml = `<i data-lucide="${gameState.player.icon}" class="w-16 h-16 md:w-20 md:h-20 text-blue-400"></i>`;
        if (gameState.gameMode === 'tower') {
            playerIconHtml += `<div class="absolute -top-2 -left-2 bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-sm border-4 border-slate-900 z-10 shadow-lg">${gameState.lives}</div>`;
        }
        document.getElementById('player-icon-container').innerHTML = playerIconHtml;
        
        const isBoss = (gameState.gameMode === 'tower' && gameState.floor > 0 && gameState.floor % 7 === 0);
        document.getElementById('cpu-icon-container').innerHTML = `<i data-lucide="${gameState.cpu.icon}" class="w-16 h-16 md:w-20 md:h-20 ${isBoss ? 'text-purple-500' : 'text-rose-500/50'}"></i>`;

        initEnergy();
        updateUI();
        document.getElementById('command-wrapper').classList.remove('ui-hidden');
        document.getElementById('btn-ready').classList.remove('hidden');
        
        if (gameState.turn > 1) {
            setMessage("Command Select");
        } else {
            setMessage(isBoss ? "WARNING: BOSS ENCOUNTER" : "Command Select");
        }
        lucide.createIcons();
    } else {
        if (gameState.gameMode === 'tower') {
            document.getElementById('select-screen').classList.add('hidden');
            document.getElementById('title-screen').classList.add('hidden');
            document.getElementById('tower-indicator').classList.remove('hidden');
            showMap();
        }
    }
}
