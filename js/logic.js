import { CHARACTERS, BOSS_CHARACTERS, TREASURE_MONSTER, ENEMY_TRAITS, PASSIVE_SKILLS, BOSS_INTERVAL } from './constants.js';

/**
 * Battle Charge core game logic.
 * Decoupled from DOM and UI for testability.
 */

// スキル効果量ボーナス(skillEffectBonus)を加算する effectValues のインデックス。
// ターン数やHP消費など「増えると不利になる値」には加算しない。
const SKILL_BONUS_INDEX = {
    CONVERT: [1],      // [HP消費, チャージ量] → チャージ量のみ
    POISON: [1],       // [トリガー, ダメージ] → ダメージのみ
    DOOM: [1],         // [発動までのターン, ダメージ] → ダメージのみ
    GRAVITY_ZONE: [1], // [ターン, 弱体量] → 弱体量のみ
    ZERO_FORM: [0],    // [チャージ量, ガード不可ターン] → チャージ量のみ
    OVERCLOCK: [],
    GAMBLER: [],
    PHANTOM_STEP: []
};

export function getSkillValues(skill, bonus = 0) {
    if (!skill || !skill.effectValues) return [];
    const idx = SKILL_BONUS_INDEX[skill.id] || [0];
    // 吸血は%値のため、ボーナス1あたり+50%
    const scale = skill.id === 'VAMPIRE' ? 50 : 1;
    return skill.effectValues.map((v, i) => idx.includes(i) ? Math.max(1, v + bonus * scale) : v);
}

function applyPoison(effects, charged, chargeAmount) {
    const poison = effects.find(e => e.type === 'POISON');
    if (!poison) return 0;
    if (poison.trigger === 0) return poison.damage; // 毎ターン発動(猛毒)
    if (charged && chargeAmount >= poison.trigger) return poison.damage;
    return 0;
}

export function calculateTurnResult(player, cpu, playerMove, cpuMove, playerSkill) {
    const pAtk = Math.max(0, player.atk + (player.tempAtk || 0));
    const cAtk = Math.max(0, cpu.atk + (cpu.tempAtk || 0));
    const pGrdC = Math.max(0, player.grdC + (player.tempGrdC || 0));
    const cGrdC = Math.max(0, cpu.grdC + (cpu.tempGrdC || 0));
    const pChgC = Math.max(0, (player.chgC || 0) + (player.tempChgC || 0));
    const cChgC = Math.max(0, (cpu.chgC || 0) + (cpu.tempChgC || 0));
    const pChgE = Math.max(0, (player.chgE || 0) + (player.tempChgE || 0));
    const cChgE = Math.max(0, (cpu.chgE || 0) + (cpu.tempChgE || 0));
    const pSkillCost = playerSkill ? Math.max(0, (playerSkill.cost || 0) + (player.skillCostBonus || 0)) : 0;
    const isSkill = playerMove === 'SKILL' && !!playerSkill;

    let pEnergy = player.energy || 0;
    let cEnergy = cpu.energy || 0;
    let pHP = player.hp || 0;
    let cHP = cpu.hp || 0;
    const pWinE = player.winE || 10;
    const cWinE = cpu.winE || 10;
    const pEffects = [...(player.effects || [])];
    const cEffects = [...(cpu.effects || [])];

    // 1. Cost consumption
    if (playerMove === 'CHARGE') pEnergy -= pChgC;
    if (playerMove === 'ATTACK') pEnergy -= player.atkC;
    if (playerMove === 'GUARD') pEnergy -= pGrdC;
    if (playerMove === 'SKILL') pEnergy -= pSkillCost;

    if (cpuMove === 'ATTACK') cEnergy -= cpu.atkC;
    if (cpuMove === 'CHARGE') cEnergy -= cChgC;
    if (cpuMove === 'GUARD') cEnergy -= cGrdC;

    const vals = isSkill ? getSkillValues(playerSkill, player.skillEffectBonus || 0) : [];
    const [val1, val2] = vals;
    let pDmgTaken = 0, cDmgTaken = 0;

    // 2. Skill Effects (Execution Phase)
    if (isSkill) {
        switch (playerSkill.id) {
            case 'CONVERT': pHP = Math.max(0, pHP - val1); pEnergy += val2; break;
            case 'DRAIN': cEnergy = Math.max(0, cEnergy - val1); break;
            case 'SNATCH': {
                const stolen = Math.min(Math.max(0, cEnergy), val1);
                cEnergy -= stolen;
                pEnergy += stolen;
                cDmgTaken += (val2 || 0);
                break;
            }
            case 'HEAL': pHP = Math.min(player.maxHp || 999, pHP + val1); break;
            case 'INSPIRE': pEffects.push({ type: 'ATK_UP', amount: val2, turns: val1 + 1 }); break;
            case 'FOCUS': pEffects.push({ type: 'CHGE_UP', amount: val2, turns: val1 + 1 }); break;
            case 'WEAKEN': if (cpuMove === 'ATTACK') { cEffects.push({ type: 'ATK_DOWN', amount: val2, turns: val1 + 1 }); } break;
            case 'JAMMING': cEffects.push({ type: 'CHGE_DOWN', amount: val2, turns: val1 + 1 }); break;
            case 'BARRIER': pEffects.push({ type: 'DMG_REDUCE', amount: val2, turns: val1 + 1 }); break;
            case 'PARALYZE': if (cpuMove === 'GUARD') { cEffects.push({ type: 'GRDC_UP', amount: val2, turns: val1 + 1 }); } break;
            case 'POISON': if (cpuMove !== 'GUARD') { cEffects.push({ type: 'POISON', trigger: val1, damage: val2, turns: 99 }); } break;
            case 'DOOM': cEffects.push({ type: 'DOOM', damage: val2, turns: val1 }); break;
            case 'CURSE': cEffects.push({ type: 'BIND', amount: 0, turns: val1 }); break;
            case 'ZERO_FORM': pEnergy += val1; pEffects.push({ type: 'GUARD_SEAL', amount: 0, turns: val2 + 1 }); break;
            case 'GRAVITY_ZONE':
                pEffects.push({ type: 'SKILL_SEAL', amount: 0, turns: val1 + 1 });
                cEffects.push({ type: 'SKILL_SEAL', amount: 0, turns: val1 + 1 });
                cEffects.push({ type: 'ATK_DOWN', amount: val2, turns: val1 + 1 });
                cEffects.push({ type: 'CHGE_DOWN', amount: val2, turns: val1 + 1 });
                break;
            case 'MIRAGE': {
                const mirageMult = playerSkill.rarity === 'LEGENDARY' ? 0.5 : 1.0;
                pEffects.push({ type: 'INVINCIBLE_STORE', stored: 0, amount: mirageMult, turns: val1 });
                break;
            }
            case 'PHANTOM_STEP': pEffects.push({ type: 'DOUBLE_ACTION', amount: 0, turns: val1 + 1 }); break;
            case 'GAMBLER': {
                const minFn = playerSkill.rarity === 'LEGENDARY' ? 5 : 1;
                const roll = Math.floor(Math.random() * (10 - minFn + 1)) + minFn;
                pEnergy += roll;
                if (roll % 2 !== 0) pHP = Math.max(0, pHP - 2);
                break;
            }
        }
    }

    // 3. Charging（通常のチャージコマンドのみ。CHARGE系スキルは通常チャージを伴わない）
    const pCharged = playerMove === 'CHARGE';
    const cCharged = cpuMove === 'CHARGE';
    if (pCharged) pEnergy += pChgE;
    if (cCharged) cEnergy += cChgE;
    pHP -= applyPoison(player.effects || [], pCharged, pChgE);
    cHP -= applyPoison(cpu.effects || [], cCharged, cChgE);

    pEnergy = Math.max(0, Math.min(pEnergy, pWinE));
    cEnergy = Math.max(0, Math.min(cEnergy, cWinE));

    // 4. Damage Calculation
    if (playerMove === 'ATTACK') {
        if (cpuMove === 'CHARGE' || cpuMove === 'SKIP') cDmgTaken += pAtk;
        else if (cpuMove === 'ATTACK') {
            // 同じATKなら相殺（仕様）
            if (pAtk > cAtk) cDmgTaken += pAtk;
            else if (cAtk > pAtk) pDmgTaken += cAtk;
        }
    } else if (playerMove === 'CHARGE') {
        if (cpuMove === 'ATTACK') pDmgTaken += cAtk;
    } else if (isSkill) {
        // GUARD系スキルのみ相手の攻撃を防ぐ。それ以外のスキルは無防備
        if (playerSkill.category !== 'GUARD' && cpuMove === 'ATTACK') pDmgTaken += cAtk;

        switch (playerSkill.id) {
            case 'SHOCK': cDmgTaken += val1; break;
            case 'ASSAULT':
                if (cpuMove === 'GUARD') { if (playerSkill.rarity !== 'LEGENDARY') pDmgTaken += 1; }
                else cDmgTaken += val1;
                break;
            case 'PIERCE': if (cpuMove === 'GUARD') cDmgTaken += val1; break;
            case 'VAMPIRE': if (cpuMove !== 'GUARD') cDmgTaken += pAtk; break;
            case 'COUNTER':
                if (cpuMove === 'ATTACK') {
                    if (playerSkill.rarity === 'COMMON') cDmgTaken += val1;
                    else if (playerSkill.rarity === 'RARE') cDmgTaken += pAtk;
                    else if (playerSkill.rarity === 'EPIC') cDmgTaken += cAtk;
                    else cDmgTaken += cAtk + 1;
                }
                break;
            case 'OVERCLOCK': {
                const multiplier = playerSkill.rarity === 'LEGENDARY' ? 1.5 : 1.0;
                cDmgTaken += Math.floor(pEnergy * multiplier);
                break;
            }
        }
    }

    // 5. Apply Damage Reduction
    pDmgTaken = Math.max(0, pDmgTaken - (player.tempDmgReduce || 0));
    cDmgTaken = Math.max(0, cDmgTaken - (cpu.tempDmgReduce || 0));

    // MIRAGE (Invincible Store)
    const invincibleEffect = pEffects.find(e => e.type === 'INVINCIBLE_STORE');
    if (invincibleEffect && pDmgTaken > 0) {
        invincibleEffect.stored = (invincibleEffect.stored || 0) + pDmgTaken;
        pDmgTaken = 0;
    }

    // VAMPIRE: 実際に与えたダメージから回復
    if (isSkill && playerSkill.id === 'VAMPIRE') {
        const healAmount = Math.floor(cDmgTaken * (val1 / 100));
        pHP = Math.min(player.maxHp || 999, pHP + healAmount);
    }

    pHP = Math.max(0, pHP - pDmgTaken);
    cHP = Math.max(0, cHP - cDmgTaken);

    return {
        pHP, cHP, pEnergy, cEnergy, pEffects, cEffects, pDmgTaken, cDmgTaken
    };
}

export function calcEffectTotals(effects) {
    const totals = {
        tempAtk: 0, tempGrdC: 0, tempChgE: 0, tempChgC: 0, tempDmgReduce: 0
    };
    (effects || []).forEach(effect => {
        if (effect.type === 'ATK_UP') totals.tempAtk += effect.amount;
        if (effect.type === 'ATK_DOWN') totals.tempAtk -= effect.amount;
        if (effect.type === 'GRDC_UP') totals.tempGrdC += effect.amount;
        if (effect.type === 'CHGE_UP') totals.tempChgE += effect.amount;
        if (effect.type === 'CHGE_DOWN') totals.tempChgE -= effect.amount;
        if (effect.type === 'CHARGE_COST_UP') totals.tempChgC += effect.amount;
        if (effect.type === 'DMG_REDUCE') totals.tempDmgReduce += effect.amount;
    });
    return totals;
}

/**
 * ターン終了時に呼ぶ。残りターンを1減らし、切れた効果を expired で返す。
 * totals は「次のターン」に有効な補正値。
 */
export function updateEffects(effects) {
    const nextEffects = (effects || []).map(e => ({ ...e, turns: e.turns - 1 }));
    const active = nextEffects.filter(e => e.turns > 0);
    const expired = nextEffects.filter(e => e.turns <= 0);
    return { effects: active, expired, totals: calcEffectTotals(active) };
}

export function getCpuMoveLogic({ player, cpu, pEnergy, cEnergy, aiLevel, gameMode, floor, cHP, pHP, playerHistory, cpuHistory }) {
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

    // AIレベルごとの賢さ
    const level = ['EASY', 'NORMAL', 'HARD', 'EXPERT'].includes(aiLevel) ? aiLevel : 'NORMAL';
    const smart = { EASY: 0.4, NORMAL: 1, HARD: 1.3, EXPERT: 1.6 }[level];

    if (cCanKillP) weights.ATTACK += Math.round(200 * smart);

    if (pCanKillC && level !== 'EASY') {
        if (canCGuard) weights.GUARD += Math.round(150 * smart);
        else if (canCAttack && cAtk >= pAtk) weights.ATTACK += Math.round(100 * smart);
    }

    if (cEnergy + cChgE >= cWinLimit && !pCanKillC) {
        if (canCCharge) weights.CHARGE += Math.round(150 * smart);
    }

    // History Analysis（NORMAL以上）
    if (level !== 'EASY' && playerHistory && playerHistory.length >= 3) {
        const histMult = (level === 'NORMAL') ? 0.5 : smart;
        const lastMove = playerHistory[playerHistory.length - 1];
        const last3 = playerHistory.slice(-3);
        const isSpamming = last3.every(m => m === lastMove);

        if (isSpamming) {
            if (lastMove === 'CHARGE' && canCAttack) weights.ATTACK += Math.round(50 * histMult);
            if (lastMove === 'ATTACK' && canCGuard) weights.GUARD += Math.round(50 * histMult);
            if (lastMove === 'GUARD' && canCCharge) weights.CHARGE += Math.round(50 * histMult);
        }

        const total = playerHistory.length;
        const counts = playerHistory.reduce((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});

        if ((counts['ATTACK'] || 0) / total > 0.6) {
            if (canCGuard) weights.GUARD += Math.round(30 * histMult);
            if (canCAttack) weights.ATTACK += Math.round(20 * histMult);
        }
        if ((counts['GUARD'] || 0) / total > 0.6 && canCCharge) {
            weights.CHARGE += Math.round(40 * histMult);
        }
        if ((counts['CHARGE'] || 0) / total > 0.6 && canCAttack) {
            weights.ATTACK += Math.round(40 * histMult);
        }
    }

    // キャラ特性を活かす（HARD以上、またはタワーの深層）
    if (level === 'HARD' || level === 'EXPERT' || gameMode === 'tower') {
        let boost = { EASY: 0, NORMAL: 0, HARD: 20, EXPERT: 40 }[level];
        if (gameMode === 'tower') boost += Math.min(20, (floor || 0));
        if (level === 'EASY') boost = Math.floor(boost / 2);
        if (cpu.chgE >= 3 && weights.CHARGE > 0) weights.CHARGE += (30 + boost);
        if (cpu.atk >= 4 && weights.ATTACK > 0) weights.ATTACK += (20 + boost);
        if (cpu.grdC === 0 && weights.GUARD > 0) weights.GUARD += (20 + boost);
    }

    let pool = [];
    Object.keys(weights).forEach(move => {
        for (let i = 0; i < weights[move]; i++) pool.push(move);
    });

    if (pool.length === 0) return 'CHARGE';

    // 呪縛(BIND)チェック: 直前の行動を禁止
    const isBound = (cpu.effects || []).some(e => e.type === 'BIND');
    if (isBound && cpuHistory && cpuHistory.length > 0) {
        const lastMove = cpuHistory[cpuHistory.length - 1];
        // poolからlastMoveを除外
        pool = pool.filter(m => m !== lastMove);

        if (pool.length === 0) {
            // 選択肢がなくなった場合（ソフトロック回避）
            // 直前の行動以外で実行可能なものを探す
            // 優先順: CHARGE > GUARD > ATTACK
            if (lastMove !== 'CHARGE' && (canCCharge || cEnergy >= cChgC)) return 'CHARGE';
            if (lastMove !== 'GUARD' && canCGuard) return 'GUARD';
            if (lastMove !== 'ATTACK' && canCAttack) return 'ATTACK';

            // それでも候補がない場合（全行動コスト不足かつCHARGEが禁止など）
            // エネルギー不足を無視してCHARGE（またはGUARD）を強制する
            if (lastMove !== 'CHARGE') return 'CHARGE';
            return 'GUARD';
        }
    }

    // 選択された行動のエネルギーチェック
    let selectedMove = pool[Math.floor(Math.random() * pool.length)];

    // エネルギー不足の場合はCHARGEにフォールバック
    if (selectedMove === 'ATTACK' && !canCAttack) selectedMove = 'CHARGE';
    if (selectedMove === 'GUARD' && !canCGuard) selectedMove = 'CHARGE';

    return selectedMove;

}

export function isBossFloor(floor) {
    return floor > 0 && floor % BOSS_INTERVAL === 0;
}

export function generateTowerEnemy(floor, mobDeck, bossDeck, isTreasureFloor, difficulty = 'NORMAL', options = {}) {
    let baseCpu;
    let aiLevel = 'EASY';
    const isBoss = (options.isBoss !== undefined) ? options.isBoss : isBossFloor(floor);

    if (floor === 0) {
        baseCpu = JSON.parse(JSON.stringify(TREASURE_MONSTER));
        aiLevel = 'EASY';
        // Floor 0 Treasure also has Self-Destruct
        const selfDestruct = PASSIVE_SKILLS.find(p => p.id === 'SELF_DESTRUCT');
        if (selfDestruct) {
            baseCpu.passive = selfDestruct;
            baseCpu.tagline += ` [${selfDestruct.name}]`;
        }
        return { cpu: baseCpu, aiLevel, isBoss: false, isTreasure: false };
    }

    if (isBoss) {
        // Draw from Boss Deck
        const bossId = bossDeck.draw();
        baseCpu = BOSS_CHARACTERS.find(c => c.id === bossId) || BOSS_CHARACTERS[0];
        baseCpu = JSON.parse(JSON.stringify(baseCpu));

        aiLevel = (difficulty === 'HARD') ? 'HARD' : (difficulty === 'EASY' ? 'EASY' : 'NORMAL');

        let hpBoost = Math.floor(floor / 4);
        let atkBoost = Math.floor(floor / 10);

        if (difficulty === 'HARD') { hpBoost += 2; atkBoost += 1; }
        if (difficulty === 'EASY') { hpBoost = Math.max(1, hpBoost - 2); }

        baseCpu.hp += hpBoost;
        baseCpu.atk += atkBoost;

        return { cpu: baseCpu, aiLevel, isBoss: true, isTreasure: false };
    }

    if (isTreasureFloor) {
        baseCpu = JSON.parse(JSON.stringify(TREASURE_MONSTER));
        aiLevel = 'EASY';
        // Treasure Chests ALWAYS have Self-Destruct
        const selfDestruct = PASSIVE_SKILLS.find(p => p.id === 'SELF_DESTRUCT');
        if (selfDestruct) {
            baseCpu.passive = selfDestruct;
            baseCpu.tagline += ` [${selfDestruct.name}]`;
        }
        return { cpu: baseCpu, aiLevel, isBoss: false, isTreasure: true };
    }

    // Normal Enemy
    const mobId = mobDeck.draw();
    baseCpu = CHARACTERS.find(c => c.id === mobId) || CHARACTERS[0];
    baseCpu = JSON.parse(JSON.stringify(baseCpu));

    // Scaling
    let traitCount = 0;

    if (floor <= 4) { traitCount = 0; aiLevel = 'EASY'; }
    else if (floor <= 9) { traitCount = 1; aiLevel = 'NORMAL'; }
    else if (floor <= 14) { traitCount = 1; aiLevel = 'NORMAL'; }
    else if (floor <= 19) { traitCount = Math.floor(Math.random() * 2) + 1; aiLevel = 'HARD'; }
    else if (floor <= 24) { traitCount = 2; aiLevel = 'HARD'; }
    else { traitCount = Math.floor(Math.random() * 2) + 2; aiLevel = 'EXPERT'; }

    // Difficulty adjustments to traits and AI
    if (difficulty === 'HARD') {
        traitCount += 1;
        if (aiLevel === 'EASY') aiLevel = 'NORMAL';
        else if (aiLevel === 'NORMAL') aiLevel = 'HARD';
        else if (aiLevel === 'HARD') aiLevel = 'EXPERT';
    } else if (difficulty === 'EASY') {
        traitCount = Math.max(0, traitCount - 1);
        if (aiLevel === 'EXPERT') aiLevel = 'HARD';
        else if (aiLevel === 'HARD') aiLevel = 'NORMAL';
        else if (aiLevel === 'NORMAL') aiLevel = 'EASY';
    }

    // Apply Traits
    for (let i = 0; i < traitCount; i++) {
        const trait = ENEMY_TRAITS[Math.floor(Math.random() * ENEMY_TRAITS.length)];
        baseCpu.name = trait.name + baseCpu.name;
        baseCpu.hp = Math.max(1, baseCpu.hp + (trait.hp || 0));
        baseCpu.atk = Math.max(1, baseCpu.atk + (trait.atk || 0));
        baseCpu.chgE = Math.max(1, baseCpu.chgE + (trait.chgE || 0));
        baseCpu.winE = Math.max(3, baseCpu.winE + (trait.winE || 0));
        baseCpu.grdC = Math.max(0, baseCpu.grdC + (trait.grdC || 0));
        baseCpu.atkC = Math.max(0, baseCpu.atkC + (trait.atkC || 0));
        baseCpu.startE = Math.max(0, baseCpu.startE + (trait.startE || 0));
        if (i === 0) baseCpu.tagline = trait.tagline;
    }

    // Floor HP Scaling
    let floorBoost = Math.floor(floor / 5);
    if (difficulty === 'HARD') floorBoost += 2;
    if (difficulty === 'EASY') floorBoost = Math.max(0, floorBoost - 1);

    baseCpu.hp += floorBoost;
    if (floor <= 2 && difficulty === 'EASY') baseCpu.hp = 1;

    // Passives
    let passiveType = 'NONE';
    if (floor >= 6 && floor <= 9) passiveType = 'SELF';
    else if (floor >= 11 && floor <= 14) passiveType = 'DEBUFF';
    else if (floor >= 16) passiveType = 'ANY';

    if (difficulty === 'HARD' && floor >= 4) passiveType = 'ANY';

    if (passiveType !== 'NONE') {
        const selfBuffIds = ['FIRST_STRIKE', 'IRON_CLAD', 'WAR_CRY', 'FOCUS', 'VITALITY'];
        const debuffIds = ['LIFE_CUT', 'SLUGGISH', 'LONG_ROAD', 'SILENCE', 'HEAVY_WEIGHT', 'LEAK'];
        const anyIds = [...selfBuffIds, ...debuffIds, 'CURSED_BODY']; // SELF_DESTRUCT は宝箱専用

        let pool = [];
        if (passiveType === 'SELF') pool = PASSIVE_SKILLS.filter(p => selfBuffIds.includes(p.id));
        else if (passiveType === 'DEBUFF') pool = PASSIVE_SKILLS.filter(p => debuffIds.includes(p.id));
        else pool = PASSIVE_SKILLS.filter(p => anyIds.includes(p.id));

        if (pool.length > 0) {
            const passive = pool[Math.floor(Math.random() * pool.length)];
            baseCpu.passive = passive;
            baseCpu.tagline += ` [${passive.name}]`;
        }
    }

    return { cpu: baseCpu, aiLevel, isBoss: false, isTreasure: false };
}

