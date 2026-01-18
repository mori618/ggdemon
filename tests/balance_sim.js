
import { Deck } from '../js/utils.js';
import { generateTowerEnemy, calculateTurnResult, getCpuMoveLogic } from '../js/logic.js';
import { CHARACTERS } from '../js/constants.js';

// --- Mocks ---
const gameState = {
    floor: 0,
    gameMode: 'tower',
    player: null,
    cpu: null,
    pHP: 0, cHP: 0, pEnergy: 0, cEnergy: 0,
    pChar: CHARACTERS[0], // Use Normal as base
    playerSkill: null,
    playerHistory: []
};

// Simple Smart Player AI for Simulation
function getPlayerMove(p, c, pE, cE) {
    // 1. If can kill, ATTACK
    if (pE >= p.atkC && c.hp <= p.atk) return 'ATTACK';
    // 2. If low HP and can guard, GUARD
    if (p.hp <= 2 && pE >= p.grdC) return 'GUARD';
    // 3. If enough energy to win, CHARGE (unless danger)
    if (pE + p.chgE >= p.winE) return 'CHARGE';
    // 4. Default: Charge or Attack
    if (pE >= p.atkC) return 'ATTACK';
    return 'CHARGE';
}

console.log("=== BATTLE CHARGE BALANCE SIMULATION ===");
console.log("Simulating 100 Runs...");

const RUNS = 100;
const results = [];
const floorStats = {}; // floor -> { win: 0, loss: 0, enemyHP: [], enemyATK: [] }

for (let r = 0; r < RUNS; r++) {
    // Reset Run
    gameState.floor = 0;
    const mobDeck = new Deck(CHARACTERS.map(c => c.id));
    const bossDeck = new Deck(['VOID_EATER', 'CORE_TITAN', 'FALLEN_KING', 'STORM_BRINGER', 'ABYSS_WATCHER']);
    // gameState.pChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]; // Random Hero each run
    gameState.pChar = CHARACTERS.find(c => c.id === 'NORMAL'); // Fixed hero for consistent baseline
    gameState.player = JSON.parse(JSON.stringify(gameState.pChar));
    gameState.player.effects = []; // Initialize effects
    gameState.treasureFloorOffset = Math.floor(Math.random() * 4);

    let isDead = false;

    // Run floors
    while (!isDead && gameState.floor < 50) { // Cap at 50F
        // Win/Advance Floor logic (simulating end of previous battle)
        gameState.floor++;

        // Cycle Logic for Treasure
        const cyclePos = (gameState.floor - 1) % 5;
        if (cyclePos === 0 && gameState.floor > 1 && (gameState.floor % 5 !== 0)) {
            // Technically cycle start logic happens at 1, 6, 11...
            // Floor 1 is start. Floor 6 is start of next.
            gameState.treasureFloorOffset = Math.floor(Math.random() * 4);
        }

        const isBoss = (gameState.floor % 5 === 0);
        const isTreasure = (!isBoss && cyclePos === gameState.treasureFloorOffset);

        // Generate Enemy
        const enemyData = generateTowerEnemy(gameState.floor, mobDeck, bossDeck, isTreasure);
        gameState.cpu = enemyData.cpu;
        gameState.cpu.effects = [];
        const aiLevel = enemyData.aiLevel;

        // Apply Passive if any (Manual apply for sim)
        if (gameState.cpu.passive) {
            gameState.cpu.passive.apply(gameState.cpu, gameState.player);
        }

        // Record Enemy Stats
        if (!floorStats[gameState.floor]) floorStats[gameState.floor] = { win: 0, loss: 0, enemyHP: [], names: {} };
        floorStats[gameState.floor].enemyHP.push(gameState.cpu.hp);
        const nameKey = gameState.cpu.name.split(' ')[0] + (isBoss ? ' (BOSS)' : '') + (isTreasure ? ' (MIMIC)' : '');
        floorStats[gameState.floor].names[gameState.cpu.name] = (floorStats[gameState.floor].names[gameState.cpu.name] || 0) + 1;

        // Battle Loop
        gameState.pHP = gameState.player.hp;
        gameState.cHP = gameState.cpu.hp;
        gameState.pEnergy = gameState.player.startE;
        gameState.cEnergy = gameState.cpu.startE;
        gameState.cpu.effects = gameState.cpu.effects || [];
        // Apply Turn 1 Passive Effects if they pushed to effects array? No, apply() modifies cpu directly or pushes to effects.

        let turn = 0;
        let battleOver = false;

        while (!battleOver && turn < 50) { // Cap turns
            turn++;
            const pMove = getPlayerMove(gameState.player, gameState.cpu, gameState.pEnergy, gameState.cEnergy);
            const cMove = getCpuMoveLogic({
                player: gameState.player,
                cpu: gameState.cpu,
                pEnergy: gameState.pEnergy,
                cEnergy: gameState.cEnergy,
                aiLevel: aiLevel,
                gameMode: 'tower',
                floor: gameState.floor,
                cHP: gameState.cHP,
                pHP: gameState.pHP
            });

            const res = calculateTurnResult(
                { ...gameState.player, energy: gameState.pEnergy, hp: gameState.pHP },
                { ...gameState.cpu, energy: gameState.cEnergy, hp: gameState.cHP },
                pMove, cMove, null
            );

            gameState.pHP = res.pHP;
            gameState.cHP = res.cHP;
            gameState.pEnergy = res.pEnergy;
            gameState.cEnergy = res.cEnergy;

            // Win/Loss Check
            const cWinF = (gameState.cEnergy >= gameState.cpu.winE);
            if (gameState.pHP <= 0 && gameState.cHP <= 0) { battleOver = true; isDead = true; } // Draw = Loss in tower? Usually retry or loss. Assuming Loss.
            else if (gameState.cHP <= 0) { battleOver = true; } // Win
            else if (gameState.pHP <= 0) { battleOver = true; isDead = true; } // Loss
            else if (gameState.pEnergy >= gameState.player.winE) { battleOver = true; } // Win
            else if (cWinF) { battleOver = true; isDead = true; } // Loss
        }

        if (isDead) {
            floorStats[gameState.floor].loss++;
        } else {
            floorStats[gameState.floor].win++;
            // Heal valid for next floor (In real game, HP is persistent. Here we are persistent.)
            gameState.player.hp = gameState.pHP;
            // Should clamp to MaxHP? Currently MaxHP is not strictly tracked separate from current in logic except for Item/Skill logic. assuming pChar.hp is Max.
            // Actually in game.js logic, pHP is what matters. gameState.player.hp is updated at end of battle.
            // But look at `setupBattleState`: gameState.pHP = gameState.player.hp;
            // AND `executeTurn` -> `gameState.player.hp = gameState.pHP`.
            // So yes, HP is persistent.

            // TREASURE GRANTING (Simple Sim)
            // If won treasure or boss, maybe get item? 
            // In tower, you get treasure every floor? No, only specific floors? 
            // Wait, logic says Treasure Floor *replaces* enemy with Mimic? 
            // SPEC says: "宝箱階層: ...ランダムな1階層が「宝箱モンスター」になります。"
            // "倒すと必ず「新スキル」をドロップします。"
            // Also "通常宝箱" exists? 
            // game.js `showTreasure` is called after VICTORY in `handleTowerVictory`.
            // So EVERY victory gives treasure.
            // Simulating ITEM get:
            gameState.player.hp += 1; // Heal 1 for free? Or item effect. 
            // Let's assume average item: +1 MaxHP or +1 ATK.
            // To prevent instant death, let's heal player by 2 after every battle as a "base heal" or "item luck".
            gameState.player.hp = Math.min(gameState.pChar.hp + 5, gameState.player.hp + 2);
            // Also scale player slightly to keep up?
            if (gameState.floor % 3 === 0) gameState.player.atk += 1;
        }
    }
    results.push(gameState.floor);
}

// Result Analysis
console.log("\n=== RESULTS ===");
const avgFloor = results.reduce((a, b) => a + b, 0) / RUNS;
console.log(`Average Floor Reached: ${avgFloor.toFixed(1)}`);
const maxFloor = Math.max(...results);
console.log(`Max Floor Reached: ${maxFloor}`);

// Detailed Floor Stats
console.log("\n[Floor Stats (HP Avg | Win Rate)]");
[1, 5, 10, 15, 20, 25, 30].forEach(f => {
    if (floorStats[f]) {
        const d = floorStats[f];
        const avgHP = d.enemyHP.reduce((a, b) => a + b, 0) / d.enemyHP.length;
        const runs = d.win + d.loss;
        const wr = ((d.win / runs) * 100).toFixed(1);
        console.log(`F${f}: EnemyHP ${avgHP.toFixed(1)} | WR ${wr}% (${runs} samples)`);
        // console.log(`    Enemies: ${JSON.stringify(d.names)}`);
    }
});
