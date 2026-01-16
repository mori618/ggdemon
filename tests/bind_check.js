import { calculateTurnResult, getCpuMoveLogic } from '../js/logic.js';

console.log("Starting BIND Status Logic Check...");

const baseChar = {
    hp: 10, atk: 2, atkC: 2, chgE: 2, grdC: 1, winE: 10,
    energy: 5, effects: [], tempAtk: 0, tempGrdC: 0, tempChgE: 0, tempChgC: 0, tempDmgReduce: 0,
    skillEffectBonus: 0
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passed++;
    } else {
        console.error(`[FAIL] ${message}`);
        failed++;
    }
}

// Test 1: CURSE Skill Application
try {
    const p = { ...baseChar, energy: 5 };
    const c = { ...baseChar, energy: 5 };
    const skill = { id: 'CURSE', category: 'SPECIAL', cost: 3, effectValues: [3] };

    const res = calculateTurnResult(p, c, 'SKILL', 'CHARGE', skill);
    const bindEffect = res.cEffects.find(e => e.type === 'BIND');

    assert(bindEffect && bindEffect.turns === 3, "CURSE skill applies BIND for 3 turns");
} catch (e) {
    console.error("Test 1 Error:", e);
    failed++;
}

// Test 2: BIND Move Restriction
try {
    const cpu = { ...baseChar, effects: [{ type: 'BIND', turns: 2 }] };
    const player = { ...baseChar };
    const cpuHistory = ['ATTACK'];

    // Force logic to largely prefer ATTACK (can kill player)
    // AI Logic Params: pHP=1 (die to attack), cHP=10, cAtk=10
    const pLow = { ...player, hp: 1 };
    const cHigh = { ...cpu, atk: 10, energy: 10 };

    // Normally returns ATTACK. With BIND + History=['ATTACK'], should NOT be ATTACK.
    const move = getCpuMoveLogic({
        player: pLow, cpu: cHigh,
        pEnergy: 5, cEnergy: 10,
        aiLevel: 'HARD', gameMode: 'normal', floor: 1,
        cHP: 10, pHP: 1,
        playerHistory: [],
        cpuHistory: cpuHistory
    });

    assert(move !== 'ATTACK', `Bound CPU avoided ATTACK (Last move was ATTACK). Selected: ${move}`);
} catch (e) {
    console.error("Test 2 Error:", e);
    failed++;
}

// Test 3: Soft-lock Prevention
try {
    const cpu = { ...baseChar, effects: [{ type: 'BIND', turns: 2 }] };
    const player = { ...baseChar };

    // Set up scenario where weights for CHARGE and GUARD would be 0
    // Energy full (10) -> CHARGE weight = 0
    // Guard Cost 11 (energy 10) -> GUARD weight = 0 (cannot guard)
    // Only ATTACK is valid.
    // But ATTACK is bound.

    const cFull = { ...cpu, energy: 10, winE: 10, grdC: 11, atk: 2 };
    const pNormal = { ...player, hp: 10 };
    const cpuHistory = ['ATTACK']; // Bind ATTACK

    // Logic should see pool=['ATTACK'], filter it to [], 
    // then hit fallback.
    // Fallback logic: check CHARGE (possible? yes, energy >= chgC=0 usually).
    // Note: getCpuMoveLogic logic: if (pool.length === 0) return 'CHARGE'; is the final fallback
    // But we added smarter fallback.
    // "if (pool.length === 0)" -> checks
    // "if (lastMove !== 'CHARGE' && (canCCharge || cEnergy >= cChgC)) return 'CHARGE';"

    const move = getCpuMoveLogic({
        player: pNormal, cpu: cFull,
        pEnergy: 10, cEnergy: 10,
        aiLevel: 'HARD', gameMode: 'normal', floor: 1,
        cHP: 10, pHP: 10,
        playerHistory: [],
        cpuHistory: cpuHistory
    });

    assert(move === 'CHARGE' || move === 'GUARD', `Approached Soft-lock. CPU selected fallback: ${move}`);
} catch (e) {
    console.error("Test 3 Error:", e);
    failed++;
}

console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
