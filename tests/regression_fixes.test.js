import { describe, it, expect, vi } from 'vitest';
import { calculateTurnResult, updateEffects, calcEffectTotals, generateTowerEnemy, getSkillValues, isBossFloor } from '../js/logic.js';
import { CHARACTERS, BOSS_CHARACTERS, PASSIVE_SKILLS, SKILLS } from '../js/constants.js';

const deck = (ids) => ({ draw: () => ids[0] });
const mob = deck(['NORMAL']);
const boss = deck(['VOID_EATER']);
const base = { atk: 1, grdC: 0, atkC: 1, chgE: 1, winE: 10, effects: [] };
const skill = (id, rarity) => SKILLS.find(s => s.id === id && s.rarity === rarity);
const p = (o = {}) => ({ ...base, energy: 5, hp: 3, maxHp: 3, ...o });
const c = (o = {}) => ({ ...base, energy: 0, hp: 5, ...o });

describe('ボス周期', () => {
    it('7階ごとにボスになり、5階は通常敵', () => {
        expect(isBossFloor(7)).toBe(true);
        expect(isBossFloor(14)).toBe(true);
        expect(isBossFloor(5)).toBe(false);
        expect(generateTowerEnemy(7, mob, boss, false).isBoss).toBe(true);
        expect(generateTowerEnemy(7, mob, boss, false).cpu.id).toBe('VOID_EATER');
        expect(generateTowerEnemy(5, mob, boss, false).isBoss).toBe(false);
    });
    it('options.isBoss で強制的にボスを生成できる', () => {
        expect(generateTowerEnemy(3, mob, boss, false, 'NORMAL', { isBoss: true }).cpu.id).toBe('VOID_EATER');
    });
});

describe('敵パッシブ', () => {
    it('通常敵に自滅パッシブが付かない', () => {
        for (let i = 0; i < 500; i++) {
            const r = generateTowerEnemy(20, mob, boss, false, 'HARD');
            expect(r.cpu.passive?.id).not.toBe('SELF_DESTRUCT');
        }
    });
    it('停滞・命削りで ChgE/HP が0にならない', () => {
        const pl = { chgE: 1, hp: 1 };
        PASSIVE_SKILLS.find(x => x.id === 'SLUGGISH').apply({}, pl);
        PASSIVE_SKILLS.find(x => x.id === 'LIFE_CUT').apply({}, pl);
        expect(pl.chgE).toBe(1);
        expect(pl.hp).toBe(1);
    });
});

describe('スキル挙動', () => {
    it('強襲: ガードされたら自傷1（LEGENDARYは自傷なし）', () => {
        expect(calculateTurnResult(p(), c(), 'SKILL', 'GUARD', skill('ASSAULT', 'EPIC')).pDmgTaken).toBe(1);
        expect(calculateTurnResult(p(), c(), 'SKILL', 'GUARD', skill('ASSAULT', 'LEGENDARY')).pDmgTaken).toBe(0);
        expect(calculateTurnResult(p(), c(), 'SKILL', 'CHARGE', skill('ASSAULT', 'EPIC')).cDmgTaken).toBe(4);
    });
    it('ガード貫通: ガード時以外はダメージなし', () => {
        expect(calculateTurnResult(p(), c(), 'SKILL', 'CHARGE', skill('PIERCE', 'EPIC')).cDmgTaken).toBe(0);
        expect(calculateTurnResult(p(), c(), 'SKILL', 'GUARD', skill('PIERCE', 'EPIC')).cDmgTaken).toBe(4);
    });
    it('CHARGE系スキルで通常チャージが発生しない', () => {
        const r = calculateTurnResult(p({ hp: 1 }), c(), 'SKILL', 'GUARD', skill('HEAL', 'EPIC'));
        expect(r.pEnergy).toBe(2);
        expect(r.pHP).toBe(3);
    });
    it('麻痺: 効果量とターン数が説明どおり', () => {
        const r = calculateTurnResult(p(), c(), 'SKILL', 'GUARD', skill('PARALYZE', 'EPIC'));
        expect(r.cEffects).toContainEqual({ type: 'GRDC_UP', amount: 2, turns: 6 });
    });
    it('カウンター: レアリティごとの反射量', () => {
        const pl = p({ atk: 3 }), cp = c({ atk: 2, energy: 5 });
        expect(calculateTurnResult(pl, cp, 'SKILL', 'ATTACK', skill('COUNTER', 'COMMON')).cDmgTaken).toBe(1);
        expect(calculateTurnResult(pl, cp, 'SKILL', 'ATTACK', skill('COUNTER', 'RARE')).cDmgTaken).toBe(3);
        expect(calculateTurnResult(pl, cp, 'SKILL', 'ATTACK', skill('COUNTER', 'EPIC')).cDmgTaken).toBe(2);
        expect(calculateTurnResult(pl, cp, 'SKILL', 'ATTACK', skill('COUNTER', 'LEGENDARY')).cDmgTaken).toBe(3);
        expect(calculateTurnResult(pl, cp, 'SKILL', 'ATTACK', skill('COUNTER', 'EPIC')).pDmgTaken).toBe(0);
    });
    it('強奪: 説明どおりのダメージ', () => {
        expect(calculateTurnResult(p(), c({ energy: 3 }), 'SKILL', 'CHARGE', skill('SNATCH', 'LEGENDARY')).cDmgTaken).toBe(2);
    });
    it('猛毒(LEGENDARY): チャージしなくても毎ターンダメージ', () => {
        const poisoned = c({ effects: [{ type: 'POISON', trigger: 0, damage: 2, turns: 99 }] });
        expect(calculateTurnResult(p(), poisoned, 'GUARD', 'GUARD').cHP).toBe(3);
    });
    it('スキル効果アップで不利な値（死の宣告の発動ターン・HP消費）が増えない', () => {
        expect(getSkillValues(skill('DOOM', 'RARE'), 1)).toEqual([4, 7]);
        expect(getSkillValues(skill('CONVERT', 'RARE'), 1)).toEqual([2, 3]);
        expect(getSkillValues(skill('ZERO_FORM', 'EPIC'), 1)).toEqual([5, 4]);
        expect(getSkillValues(skill('POISON', 'LEGENDARY'), 1)).toEqual([0, 3]);
    });
    it('重力圏: 敵のATK/ChgEを下げる', () => {
        const r = calculateTurnResult(p({ energy: 5 }), c(), 'SKILL', 'CHARGE', skill('GRAVITY_ZONE', 'EPIC'));
        expect(r.cEffects.some(e => e.type === 'ATK_DOWN' && e.amount === 1)).toBe(true);
        expect(r.cEffects.some(e => e.type === 'CHGE_DOWN' && e.amount === 1)).toBe(true);
    });
    it('攻撃同士で同ATKは相殺（仕様）', () => {
        const r = calculateTurnResult(p(), c({ energy: 1 }), 'ATTACK', 'ATTACK');
        expect(r.pDmgTaken).toBe(0);
        expect(r.cDmgTaken).toBe(0);
    });
});

describe('効果のターン数', () => {
    it('開始時に付与された3ターン効果は3ターン有効', () => {
        let effects = [{ type: 'ATK_UP', amount: 1, turns: 3 }];
        let active = 0;
        for (let t = 0; t < 5; t++) {
            if (calcEffectTotals(effects).tempAtk > 0) active++;
            effects = updateEffects(effects).effects; // ターン終了時
        }
        expect(active).toBe(3);
    });
});
