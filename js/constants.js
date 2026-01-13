export const CHARACTERS = [
    { id: 'NORMAL', name: 'Normal', hp: 3, atk: 1, winE: 5, chgE: 1, grdC: 0, atkC: 1, chgC: 0, startE: 0, icon: 'user', tagline: 'ノーマルタイプ' },
    { id: 'STRIKER', name: 'Striker', hp: 2, atk: 3, winE: 6, chgE: 1, grdC: 0, atkC: 2, chgC: 0, startE: 1, icon: 'zap', tagline: '猛撃の処刑人' },
    { id: 'TACTICIAN', name: 'Tactician', hp: 3, atk: 1, winE: 12, chgE: 2, grdC: 1, atkC: 1, chgC: 0, startE: 3, icon: 'brain', tagline: '技巧派軍師' },
    { id: 'TANK', name: 'Tank', hp: 5, atk: 1, winE: 8, chgE: 1, grdC: 0, atkC: 1, chgC: 0, startE: 0, icon: 'shield', tagline: '鉄壁の守護者' },
    { id: 'ASSASSIN', name: 'Assassin', hp: 2, atk: 1, winE: 4, chgE: 1, grdC: 0, atkC: 1, chgC: 0, startE: 0, icon: 'target', tagline: '電光石火の暗殺者' },
    { id: 'BERSERKER', name: 'Berserker', hp: 1, atk: 6, winE: 10, chgE: 1, grdC: 0, atkC: 4, chgC: 0, startE: 2, icon: 'flame', tagline: '全てを破壊する矛' },
    { id: 'SAGE', name: 'Sage', hp: 2, atk: 1, winE: 15, chgE: 3, grdC: 1, atkC: 2, chgC: 0, startE: 3, icon: 'wand-2', tagline: '身軽な魔導師' },
    { id: 'REVENGER', name: 'Revenger', hp: 3, atk: 2, winE: 7, chgE: 1, grdC: 0, atkC: 1, chgC: 0, startE: 0, icon: 'swords', tagline: '相殺を制するカウンター' },
    { id: 'OVERDRIVE', name: 'Overdrive', hp: 2, atk: 2, winE: 10, chgE: 1, grdC: 1, atkC: 3, chgC: 0, startE: 6, icon: 'battery-charging', tagline: 'オーバークロック' }
];

export const ENEMY_TRAITS = [
    { name: "迅雷の", chgE: 1, hp: -1, tagline: "チャージ速度に特化した軽量型" },
    { name: "鋼鉄の", hp: 3, atkC: 1, tagline: "圧倒的な耐久力を持つ重量型" },
    { name: "狂乱の", atk: 2, winE: 2, tagline: "攻撃力は高いが勝利が遠のいた暴走型" },
    { name: "狡猾な", grdC: -1, winE: -1, tagline: "守りが固く、勝利条件も緩い厄介な型" },
    { name: "神速の", startE: 2, hp: -2, tagline: "開幕からフルスロットルの短期決戦型" }
];

export const BOSS_CHARACTERS = [
    { id: 'VOID_EATER', name: 'Void Eater', hp: 15, atk: 2, winE: 20, chgE: 4, grdC: 0, atkC: 2, chgC: 1, startE: 5, icon: 'ghost', tagline: '全てを無に帰すタワーの支配者' },
    { id: 'CORE_TITAN', name: 'Core Titan', hp: 25, atk: 4, winE: 15, chgE: 1, grdC: 1, atkC: 3, chgC: 0, startE: 0, icon: 'database', tagline: '一撃必殺のチャージを蓄える巨像' },
    { id: 'FALLEN_KING', name: 'Fallen King', hp: 20, atk: 3, winE: 18, chgE: 2, grdC: 1, atkC: 2, chgC: 0, startE: 2, icon: 'crown', tagline: 'かつて栄華を極めた堕落の王' },
    { id: 'STORM_BRINGER', name: 'Storm Bringer', hp: 12, atk: 2, winE: 10, chgE: 5, grdC: 0, atkC: 1, chgC: 0, startE: 4, icon: 'cloud-lightning', tagline: '嵐を呼ぶ天空の覇者' },
    { id: 'ABYSS_WATCHER', name: 'Abyss Watcher', hp: 30, atk: 2, winE: 12, chgE: 1, grdC: 0, atkC: 2, chgC: 0, startE: 0, icon: 'eye', tagline: '深淵を覗き込む異形の存在' }
];

export const TREASURE_MONSTER = { id: 'TREASURE_CHEST', name: 'Treasure', hp: 1, atk: 7, winE: 10, chgE: 1, grdC: 10, atkC: 7, chgC: 0, startE: 0, icon: 'gift', tagline: '中にはお宝が詰まっているようだ' };

export const SKILLS = [
    { id: 'ASSAULT', name: '強襲', category: 'ATTACK', description: '敵に ? ダメージを与える（ガードされた場合、自身に反動ダメージ）。', costRange: [2, 4], effectRanges: [[2, 3]] },
    { id: 'DRAIN', name: 'ドレイン', category: 'SPECIAL', description: '相手のエネルギーを ? 減少させる。', costRange: [1, 3], effectRanges: [[2, 3]] },
    { id: 'JAMMING', name: '妨害', category: 'SPECIAL', description: '? ターンの間、敵のチャージ増加量を ? 減少させる。', costRange: [2, 4], effectRanges: [[2, 3], [1, 1]] },
    { id: 'COUNTER', name: 'カウンター', category: 'GUARD', description: 'ガードを行う。敵が攻撃していた場合、相手のATK分のダメージを反射。', costRange: [1, 3], effectRanges: [] },
    { id: 'CONVERT', name: '変換', category: 'CHARGE', description: '自分のHPを ? 消費し、エネルギーを ? チャージする。', costRange: [0, 2], effectRanges: [[1, 1], [3, 4]] },
    { id: 'BARRIER', name: 'バリア', category: 'GUARD', description: '? ターンの間、受けるダメージを ? 軽減する。', costRange: [2, 3], effectRanges: [[2, 3], [1, 1]] },
    { id: 'POISON', name: '毒', category: 'SPECIAL', description: '非ガード時に付与。自分が ? エネルギー貯めるたび相手に ? ダメージ。', costRange: [3, 5], effectRanges: [[3, 3], [1, 1]] },
    { id: 'WEAKEN', name: '衰弱', category: 'SPECIAL', description: '敵が攻撃していた場合に付与。相手のATKを ? ターンの間 ? 下げる。', costRange: [2, 4], effectRanges: [[2, 3], [1, 1]] },
    { id: 'PARALYZE', name: '麻痺', category: 'SPECIAL', description: '敵がガードしていた場合に付与。相手のガードコストを ? アップ。', costRange: [2, 4], effectRanges: [[1, 2]] },
    { id: 'PIERCE', name: 'ガード貫通', category: 'ATTACK', description: '敵がガードしていた場合のみ ? ダメージを与える。', costRange: [1, 3], effectRanges: [[2, 3]] },
    { id: 'INSPIRE', name: '鼓舞', category: 'CHARGE', description: '? ターンの間、自分のATKを ? アップ。', costRange: [2, 4], effectRanges: [[2, 3], [1, 1]] },
    { id: 'FOCUS', name: '集中', category: 'CHARGE', description: '? ターンの間、自分のチャージ増加量を ? アップ。', costRange: [2, 4], effectRanges: [[2, 3], [1, 1]] },
    { id: 'SHOCK', name: '衝撃', category: 'ATTACK', description: '敵の行動に関わらず、固定で 1 ダメージ与える。', costRange: [3, 5], effectRanges: [[1, 1]] },
    { id: 'HEAL', name: 'ヒール', category: 'CHARGE', description: 'HPを ? 回復する。', costRange: [3, 5], effectRanges: [[2, 4]] },
    { id: 'SNATCH', name: '強奪', category: 'ATTACK', description: '敵のエナジーを ? 奪う。', costRange: [2, 4], effectRanges: [[1, 2]] },
    { id: 'VAMPIRE', name: '吸血', category: 'ATTACK', description: '与えたダメージの ?% を回復する。', costRange: [3, 5], effectRanges: [[50, 100]] },
    { id: 'DOOM', name: '死の宣告', category: 'SPECIAL', description: '? ターン後に ? ダメージを与える時限爆弾を付与。', costRange: [3, 5], effectRanges: [[2, 3], [5, 8]] }
];

export const ITEM_EFFECTS = {
    MERITS: [
        { id: 'ATK_UP', text: 'ATKが $V アップ', apply: (p, v) => p.atk += v, valueRange: [1, 2] },
        { id: 'HP_UP', text: '最大HPが $V アップ', apply: (p, v) => p.hp += v, valueRange: [1, 3] },
        { id: 'CHGE_UP', text: 'チャージ効率(ChgE)が $V アップ', apply: (p, v) => p.chgE += v, valueRange: [1, 1] },
        { id: 'WINE_DOWN', text: '勝利必要E(WinE)が $V ダウン', apply: (p, v) => p.winE = Math.max(3, p.winE - v), valueRange: [1, 2], condition: p => p.winE > 3 },
        { id: 'GRDC_DOWN', text: 'ガードコストが $V ダウン', apply: (p, v) => p.grdC = Math.max(0, p.grdC - v), valueRange: [1, 1], condition: p => p.grdC > 0 },
        { id: 'ATKC_DOWN', text: '攻撃コストが $V ダウン', apply: (p, v) => p.atkC = Math.max(0, p.atkC - v), valueRange: [1, 1], condition: p => p.atkC > 0 },
        { id: 'START_E_UP', text: '初期エネルギーが $V アップ', apply: (p, v) => p.startE = Math.max(0, p.startE + v), valueRange: [1, 2] },
        { id: 'SKILL_EFFECT_UP', text: 'スキル効果量が $V アップ', apply: (p, v) => p.skillEffectBonus = (p.skillEffectBonus || 0) + v, valueRange: [1, 1], condition: (p, ps) => ps !== null },
        { id: 'SKILL_COST_DOWN', text: 'スキルコストが $V ダウン', apply: (p, v) => p.skillCostBonus = (p.skillCostBonus || 0) - v, valueRange: [1, 1], condition: (p, ps) => ps !== null && (ps.cost + (p.skillCostBonus || 0)) > 0 },
        { id: 'CHARGE_COST_DOWN', text: 'チャージコストが $V ダウン', apply: (p, v) => p.chgC = Math.max(0, (p.chgC || 0) - v), valueRange: [1, 1], condition: p => (p.chgC || 0) > 0 },
    ],
    DEMERITS: [
        { id: 'ATK_DOWN', text: 'ATKが $V ダウン', apply: (p, v) => p.atk = Math.max(1, p.atk - v), valueRange: [1, 1] },
        { id: 'HP_DOWN', text: '最大HPが $V ダウン', apply: (p, v) => p.hp = Math.max(1, p.hp - v), valueRange: [1, 2] },
        { id: 'CHGE_DOWN', text: 'チャージ効率(ChgE)が $V ダウン', apply: (p, v) => p.chgE = Math.max(1, p.chgE - v), valueRange: [1, 1], condition: p => p.chgE > 1 },
        { id: 'WINE_UP', text: '勝利必要E(WinE)が $V アップ', apply: (p, v) => p.winE += v, valueRange: [1, 3] },
        { id: 'GRDC_UP', text: 'ガードコストが $V アップ', apply: (p, v) => p.grdC += v, valueRange: [1, 1] },
        { id: 'ATKC_UP', text: '攻撃コストが $V アップ', apply: (p, v) => p.atkC += v, valueRange: [1, 2] },
        { id: 'START_E_DOWN', text: '初期エネルギーが $V ダウン', apply: (p, v) => p.startE = Math.max(0, p.startE - v), valueRange: [1, 2] },
        { id: 'SKILL_EFFECT_DOWN', text: 'スキル効果量が $V ダウン', apply: (p, v) => p.skillEffectBonus = (p.skillEffectBonus || 0) - v, valueRange: [1, 1] },
        { id: 'SKILL_COST_UP', text: 'スキルコストが $V アップ', apply: (p, v) => p.skillCostBonus = (p.skillCostBonus || 0) + v, valueRange: [1, 1] },
        { id: 'CHARGE_COST_UP', text: 'チャージコストが $V アップ', apply: (p, v) => p.chgC = (p.chgC || 0) + v, valueRange: [1, 1], condition: () => false },
    ]
};

export const EFFECT_ICONS = {
    'ATK_UP': { icon: 'sword', color: 'text-rose-400' },
    'GRDC_UP': { icon: 'shield', color: 'text-sky-400' },
    'CHGE_UP': { icon: 'zap', color: 'text-yellow-400' },
    'CHGE_DOWN': { icon: 'zap', color: 'text-slate-500' },
    'ATK_DOWN': { icon: 'sword', color: 'text-slate-500' },
    'DMG_REDUCE': { icon: 'shield-check', color: 'text-emerald-400' },
    'POISON': { icon: 'biohazard', color: 'text-lime-400' },
    'DOOM': { icon: 'skull', color: 'text-purple-600' }
};
