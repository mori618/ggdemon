/**
 * Battle Charge core game logic.
 * Decoupled from DOM and UI for testability.
 */

export function calculateTurnResult(player, cpu, playerMove, cpuMove, playerSkill) {
    const pAtk = player.atk + (player.tempAtk || 0);
    const cAtk = cpu.atk + (cpu.tempAtk || 0);
    const pGrdC = Math.max(0, player.grdC + (player.tempGrdC || 0));
    const cGrdC = Math.max(0, cpu.grdC + (cpu.tempGrdC || 0));
    const pChgC = Math.max(0, (player.chgC || 0) + (player.tempChgC || 0));
    const cChgC = Math.max(0, (cpu.chgC || 0) + (cpu.tempChgC || 0));
    const pChgE = Math.max(0, (player.chgE || 0) + (player.tempChgE || 0));
    const cChgE = Math.max(0, (cpu.chgE || 0) + (cpu.tempChgE || 0));
    const pSkillCost = playerSkill ? Math.max(0, (playerSkill.cost || 0) + (player.skillCostBonus || 0)) : 0;

    let pEnergy = player.energy || 0;
    let cEnergy = cpu.energy || 0;
    let pHP = player.hp || 0;
    let cHP = cpu.hp || 0;
    const pWinE = player.winE || 10;
    const cWinE = cpu.winE || 10;
    const pEffects = [...player.effects];
    const cEffects = [...cpu.effects];

    // 1. Cost consumption
    if (playerMove === 'CHARGE') pEnergy -= pChgC;
    if (playerMove === 'ATTACK') pEnergy -= player.atkC;
    if (playerMove === 'GUARD') pEnergy -= pGrdC;
    if (playerMove === 'SKILL') pEnergy -= pSkillCost;

    if (cpuMove === 'ATTACK') cEnergy -= cpu.atkC;
    if (cpuMove === 'CHARGE') cEnergy -= cChgC;
    if (cpuMove === 'GUARD') cEnergy -= cGrdC;

    let playerBehavior = playerMove;
    if (playerMove === 'SKILL' && playerSkill) playerBehavior = playerSkill.category;

    // 2. Skill Effects (Execution Phase)
    if (playerMove === 'SKILL' && playerSkill) {
        const skillEffectBonus = player.skillEffectBonus || 0;
        const effectValues = playerSkill.effectValues.map(v => Math.max(1, v + skillEffectBonus));
        const [val1, val2] = effectValues;

        switch (playerSkill.id) {
            case 'CONVERT': pHP = Math.max(0, pHP - val1); pEnergy += val2; break;
            case 'DRAIN': cEnergy = Math.max(0, cEnergy - val1); break;
            case 'SNATCH': {
                const stolen = Math.min(cEnergy, val1);
                cEnergy -= stolen;
                pEnergy += stolen;
                break;
            } // New (True Steal)
            case 'HEAL': pHP = Math.min(player.maxHp || 999, pHP + val1); break; // New (Capped at MaxHP)
            case 'INSPIRE': pEffects.push({ type: 'ATK_UP', amount: val2, turns: val1 + 1 }); break;
            case 'FOCUS': pEffects.push({ type: 'CHGE_UP', amount: val2, turns: val1 + 1 }); break;
            case 'WEAKEN': if (cpuMove === 'ATTACK') { cEffects.push({ type: 'ATK_DOWN', amount: val2, turns: val1 + 1 }); } break;
            case 'JAMMING': cEffects.push({ type: 'CHGE_DOWN', amount: val2, turns: val1 + 1 }); break;
            case 'BARRIER': pEffects.push({ type: 'DMG_REDUCE', amount: val2, turns: val1 + 1 }); break;
            case 'PARALYZE': if (cpuMove === 'GUARD') { cEffects.push({ type: 'GRDC_UP', amount: val1, turns: 3 }); } break;
            case 'POISON': if (cpuMove !== 'GUARD') { cEffects.push({ type: 'POISON', trigger: val1, damage: val2, turns: 99 }); } break;
            case 'DOOM': cEffects.push({ type: 'DOOM', damage: val2, turns: val1 }); break; // New (Correct timing)
        }
    }

    // 3. Charging
    if (playerBehavior === 'CHARGE') {
        const chargeAmount = pChgE;
        pEnergy += chargeAmount;
        const poisonEffect = player.effects.find(e => e.type === 'POISON');
        if (poisonEffect && chargeAmount >= poisonEffect.trigger) {
            pHP -= poisonEffect.damage;
        }
    }
    if (cpuMove === 'CHARGE') {
        const chargeAmount = cChgE;
        cEnergy += chargeAmount;
        const poisonEffect = cpu.effects.find(e => e.type === 'POISON');
        if (poisonEffect && chargeAmount >= poisonEffect.trigger) {
            cHP -= poisonEffect.damage;
        }
    }

    pEnergy = Math.max(0, Math.min(pEnergy, pWinE));
    cEnergy = Math.max(0, Math.min(cEnergy, cWinE));

    // 4. Damage Calculation
    let pDmgTaken = 0, cDmgTaken = 0;
    if (playerBehavior === 'ATTACK') {
        if (cpuMove === 'CHARGE') cDmgTaken += pAtk;
        else if (cpuMove === 'ATTACK') {
            if (pAtk > cAtk) cDmgTaken += pAtk;
            else if (cAtk > pAtk) pDmgTaken += cAtk;
        }
    }
    // CHARGE系とSPECIAL系スキルは相手の攻撃を受ける
    else if (playerBehavior === 'CHARGE' || playerBehavior === 'SPECIAL') {
        if (cpuMove === 'ATTACK') pDmgTaken += cAtk;
    }
    // GUARD系スキルは相手の攻撃を防ぐ（ダメージを受けない）

    if (playerMove === 'SKILL' && playerSkill) {
        const skillEffectBonus = player.skillEffectBonus || 0;
        const effectValues = playerSkill.effectValues.map(v => Math.max(1, v + skillEffectBonus));
        const [val1] = effectValues;
        switch (playerSkill.id) {
            case 'SHOCK': cDmgTaken += val1; break;
            case 'ASSAULT': if (cpuMove === 'GUARD') pDmgTaken += val1; else cDmgTaken += val1; break;
            case 'PIERCE': if (cpuMove === 'GUARD') cDmgTaken += val1; break;
            case 'COUNTER': if (cpuMove === 'ATTACK') cDmgTaken += cAtk; break;
        }
    }

    // 5. Apply Damage Reduction
    pDmgTaken = Math.max(0, pDmgTaken - (player.tempDmgReduce || 0));
    cDmgTaken = Math.max(0, cDmgTaken - (cpu.tempDmgReduce || 0));

    // Post-Damage Calculation (VAMPIRE)
    if (playerMove === 'SKILL' && playerSkill && playerSkill.id === 'VAMPIRE') {
        const skillEffectBonus = player.skillEffectBonus || 0;
        const effectValues = playerSkill.effectValues.map(v => Math.max(1, v + skillEffectBonus));
        const [rate] = effectValues; // rate is percentage (e.g. 50)
        const healAmount = Math.floor(cDmgTaken * (rate / 100));
        pHP = Math.min(player.maxHp || 999, pHP + healAmount);
    }

    pHP = Math.max(0, pHP - pDmgTaken);
    cHP = Math.max(0, cHP - cDmgTaken);

    return {
        pHP, cHP, pEnergy, cEnergy, pEffects, cEffects, pDmgTaken, cDmgTaken
    };
}

export function updateEffects(effects) {
    const nextEffects = effects.map(e => ({ ...e, turns: e.turns - 1 }));
    const active = nextEffects.filter(e => e.turns > 0);
    const expired = nextEffects.filter(e => e.turns <= 0);

    const totals = {
        tempAtk: 0, tempGrdC: 0, tempChgE: 0, tempChgC: 0, tempDmgReduce: 0
    };
    active.forEach(effect => {
        if (effect.type === 'ATK_UP') totals.tempAtk += effect.amount;
        if (effect.type === 'ATK_DOWN') totals.tempAtk -= effect.amount;
        if (effect.type === 'GRDC_UP') totals.tempGrdC += effect.amount;
        if (effect.type === 'CHGE_UP') totals.tempChgE += effect.amount;
        if (effect.type === 'CHGE_DOWN') totals.tempChgE -= effect.amount;
        if (effect.type === 'CHARGE_COST_UP') totals.tempChgC += effect.amount;
        if (effect.type === 'DMG_REDUCE') totals.tempDmgReduce += effect.amount;
    });
    return { effects: active, expired, totals };
}

export function getCpuMoveLogic({ player, cpu, pEnergy, cEnergy, aiLevel, gameMode, floor, cHP, pHP, playerHistory }) {
    const pAtk = player.atk + (player.tempAtk || 0);
    const cAtk = cpu.atk + (cpu.tempAtk || 0);
    const cGrdC = Math.max(0, cpu.grdC + (cpu.tempGrdC || 0));
    const cChgC = Math.max(0, (cpu.chgC || 0) + (cpu.tempChgC || 0));
    const cChgE = cpu.chgE + (cpu.tempChgE || 0);

    const cWinLimit = Math.max(3, cpu.winE);
    const canPAttack = (pEnergy >= player.atkC);
    const canCAttack = (cEnergy >= cpu.atkC);
    const canCGuard = (cEnergy >= cGrdC);
    const canCCharge = (cEnergy >= cChgC);

    const pCanKillC = (canPAttack && cHP <= pAtk);
    const cCanKillP = (canCAttack && pHP <= cAtk);

    let weights = { CHARGE: 30, ATTACK: 30, GUARD: 30 };

    if (!canCAttack) weights.ATTACK = 0;
    if (!canCGuard) weights.GUARD = 0;
    if (!canCCharge || cEnergy >= cWinLimit) weights.CHARGE = 0;

    if (!canPAttack) {
        weights.GUARD = 0;
        if (canCCharge) weights.CHARGE += 40;
        if (canCAttack) weights.ATTACK += 20;
    }

    if (cCanKillP) weights.ATTACK += 200;

    if (pCanKillC) {
        if (canCGuard) weights.GUARD += 150;
        else if (canCAttack && cAtk >= pAtk) weights.ATTACK += 100;
    }

    if (cEnergy + cChgE >= cWinLimit && !pCanKillC) {
        if (canCCharge) weights.CHARGE += 150;
    }

    // History Analysis
    if (playerHistory && playerHistory.length >= 3) {
        const lastMove = playerHistory[playerHistory.length - 1];
        const last3 = playerHistory.slice(-3);
        const isSpamming = last3.every(m => m === lastMove);

        // Pattern: Detect Spamming
        if (isSpamming) {
            if (lastMove === 'CHARGE') weights.ATTACK += 50;
            if (lastMove === 'ATTACK') weights.GUARD += 50;
            if (lastMove === 'GUARD') weights.CHARGE += 50;
        }

        // Pattern: Frequency Analysis
        const total = playerHistory.length;
        const counts = playerHistory.reduce((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});

        if ((counts['ATTACK'] || 0) / total > 0.6) {
            weights.GUARD += 30;
            weights.ATTACK += 20;
        }
        if ((counts['GUARD'] || 0) / total > 0.6) {
            weights.CHARGE += 40;
        }
        if ((counts['CHARGE'] || 0) / total > 0.6) {
            weights.ATTACK += 40;
        }
    }

    if (aiLevel === 'HARD' || gameMode === 'tower') {
        const boost = (aiLevel === 'HARD') ? 20 : Math.min(40, floor * 2);
        if (cpu.chgE >= 3) weights.CHARGE += (30 + boost);
        if (cpu.atk >= 4) weights.ATTACK += (20 + boost);
        if (cpu.grdC === 0) weights.GUARD += (20 + boost);
    }

    let pool = [];
    Object.keys(weights).forEach(move => {
        for (let i = 0; i < weights[move]; i++) pool.push(move);
    });

    if (pool.length === 0) return 'CHARGE';

    // 選択された行動のエネルギーチェック
    let selectedMove = pool[Math.floor(Math.random() * pool.length)];

    // エネルギー不足の場合はCHARGEにフォールバック
    if (selectedMove === 'ATTACK' && !canCAttack) selectedMove = 'CHARGE';
    if (selectedMove === 'GUARD' && !canCGuard) selectedMove = 'CHARGE';

    return selectedMove;
}
