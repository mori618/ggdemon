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
    { id: 'VOID_EATER', name: 'Void Eater', hp: 6, atk: 2, winE: 20, chgE: 4, grdC: 0, atkC: 2, chgC: 1, startE: 5, icon: 'ghost', tagline: '全てを無に帰すタワーの支配者' },
    { id: 'CORE_TITAN', name: 'Core Titan', hp: 10, atk: 4, winE: 15, chgE: 1, grdC: 1, atkC: 3, chgC: 0, startE: 0, icon: 'database', tagline: '一撃必殺のチャージを蓄える巨像' },
    { id: 'FALLEN_KING', name: 'Fallen King', hp: 8, atk: 3, winE: 18, chgE: 2, grdC: 1, atkC: 2, chgC: 0, startE: 2, icon: 'crown', tagline: 'かつて栄華を極めた堕落の王' },
    { id: 'STORM_BRINGER', name: 'Storm Bringer', hp: 5, atk: 2, winE: 10, chgE: 5, grdC: 0, atkC: 1, chgC: 0, startE: 4, icon: 'cloud-lightning', tagline: '嵐を呼ぶ天空の覇者' },
    { id: 'ABYSS_WATCHER', name: 'Abyss Watcher', hp: 12, atk: 2, winE: 12, chgE: 1, grdC: 0, atkC: 2, chgC: 0, startE: 0, icon: 'eye', tagline: '深淵を覗き込む異形の存在' }
];

export const TREASURE_MONSTER = { id: 'TREASURE_CHEST', name: 'Treasure', hp: 1, atk: 7, winE: 10, chgE: 1, grdC: 10, atkC: 7, chgC: 0, startE: 0, icon: 'gift', tagline: '中にはお宝が詰まっているようだ' };

export const SKILLS = [
    // 1. 全域スキル (COMMON ~ LEGENDARY)
    // ASSAULT (強襲)
    { id: 'ASSAULT', rarity: 'COMMON', name: '強襲', category: 'ATTACK', description: '敵に ? ダメージ。ガード時自分に 1 ダメージ。', cost: 4, effectValues: [2] },
    { id: 'ASSAULT', rarity: 'RARE', name: '強襲', category: 'ATTACK', description: '敵に ? ダメージ。ガード時自分に 1 ダメージ。', cost: 3, effectValues: [3] },
    { id: 'ASSAULT', rarity: 'EPIC', name: '強襲', category: 'ATTACK', description: '敵に ? ダメージ。ガード時自分に 1 ダメージ。', cost: 2, effectValues: [4] },
    { id: 'ASSAULT', rarity: 'LEGENDARY', name: '強襲', category: 'ATTACK', description: '敵に ? ダメージ。', cost: 1, effectValues: [6] },

    // SNATCH (強奪)
    { id: 'SNATCH', rarity: 'COMMON', name: '強奪', category: 'ATTACK', description: '敵のエナジーを ? 奪う。', cost: 4, effectValues: [1] },
    { id: 'SNATCH', rarity: 'RARE', name: '強奪', category: 'ATTACK', description: '敵のエナジーを ? 奪い、敵に 1 ダメージ。', cost: 3, effectValues: [1] },
    { id: 'SNATCH', rarity: 'EPIC', name: '強奪', category: 'ATTACK', description: '敵のエナジーを ? 奪い、敵に 1 ダメージ。', cost: 2, effectValues: [2] },
    { id: 'SNATCH', rarity: 'LEGENDARY', name: '強奪', category: 'ATTACK', description: '敵のエナジーを ? 奪い、敵に 2 ダメージ。', cost: 1, effectValues: [3] },

    // COUNTER (カウンター)
    { id: 'COUNTER', rarity: 'COMMON', name: 'カウンター', category: 'GUARD', description: 'ガードを行う。敵攻撃時、敵に ? ダメージ。', cost: 3, effectValues: [1] },
    { id: 'COUNTER', rarity: 'RARE', name: 'カウンター', category: 'GUARD', description: 'ガードを行う。敵攻撃時、自分のATK分を反射。', cost: 2, effectValues: [] },
    { id: 'COUNTER', rarity: 'EPIC', name: 'カウンター', category: 'GUARD', description: 'ガードを行う。敵攻撃時、相手のATK分を反射。', cost: 1, effectValues: [] },
    { id: 'COUNTER', rarity: 'LEGENDARY', name: 'カウンター', category: 'GUARD', description: 'ガードを行う。敵攻撃時、相手のATK+1分を反射。', cost: 0, effectValues: [] },

    // BARRIER (バリア)
    { id: 'BARRIER', rarity: 'COMMON', name: 'バリア', category: 'GUARD', description: '? ターンの間、被ダメージを 1 軽減。', cost: 3, effectValues: [2, 1] },
    { id: 'BARRIER', rarity: 'RARE', name: 'バリア', category: 'GUARD', description: '? ターンの間、被ダメージを 1 軽減。', cost: 2, effectValues: [3, 1] },
    { id: 'BARRIER', rarity: 'EPIC', name: 'バリア', category: 'GUARD', description: '? ターンの間、被ダメージを 2 軽減。', cost: 2, effectValues: [5, 2] },
    { id: 'BARRIER', rarity: 'LEGENDARY', name: 'バリア', category: 'GUARD', description: '永続効果。被ダメージを 2 軽減。', cost: 1, effectValues: [99, 2] },

    // INSPIRE (鼓舞)
    { id: 'INSPIRE', rarity: 'COMMON', name: '鼓舞', category: 'CHARGE', description: '? ターンの間、自分のATKを +1。', cost: 4, effectValues: [3, 1] },
    { id: 'INSPIRE', rarity: 'RARE', name: '鼓舞', category: 'CHARGE', description: '? ターンの間、自分のATKを +2。', cost: 3, effectValues: [3, 2] },
    { id: 'INSPIRE', rarity: 'EPIC', name: '鼓舞', category: 'CHARGE', description: '? ターンの間、自分のATKを +2。', cost: 2, effectValues: [5, 2] },
    { id: 'INSPIRE', rarity: 'LEGENDARY', name: '鼓舞', category: 'CHARGE', description: '永続効果。自分のATKを +3。', cost: 1, effectValues: [99, 3] },

    // HEAL (ヒール)
    { id: 'HEAL', rarity: 'COMMON', name: 'ヒール', category: 'CHARGE', description: 'HPを ? 回復する。', cost: 5, effectValues: [1] },
    { id: 'HEAL', rarity: 'RARE', name: 'ヒール', category: 'CHARGE', description: 'HPを ? 回復する。', cost: 4, effectValues: [2] },
    { id: 'HEAL', rarity: 'EPIC', name: 'ヒール', category: 'CHARGE', description: 'HPを ? 回復する。', cost: 3, effectValues: [4] },
    { id: 'HEAL', rarity: 'LEGENDARY', name: 'ヒール', category: 'CHARGE', description: 'HPを ? 回復する。', cost: 2, effectValues: [8] },

    // DRAIN (ドレイン)
    { id: 'DRAIN', rarity: 'COMMON', name: 'ドレイン', category: 'SPECIAL', description: '相手のエネルギーを ? 減少させる。', cost: 3, effectValues: [1] },
    { id: 'DRAIN', rarity: 'RARE', name: 'ドレイン', category: 'SPECIAL', description: '相手のエネルギーを ? 減少させる。', cost: 2, effectValues: [2] },
    { id: 'DRAIN', rarity: 'EPIC', name: 'ドレイン', category: 'SPECIAL', description: '相手のエネルギーを ? 減少させる。', cost: 1, effectValues: [3] },
    { id: 'DRAIN', rarity: 'LEGENDARY', name: 'ドレイン', category: 'SPECIAL', description: '相手のエネルギーを全損させる。', cost: 1, effectValues: [99] },

    // JAMMING (妨害)
    { id: 'JAMMING', rarity: 'COMMON', name: '妨害', category: 'SPECIAL', description: '? ターンの間、敵のChgEを -1。', cost: 4, effectValues: [3, 1] },
    { id: 'JAMMING', rarity: 'RARE', name: '妨害', category: 'SPECIAL', description: '? ターンの間、敵のChgEを -1。', cost: 3, effectValues: [5, 1] },
    { id: 'JAMMING', rarity: 'EPIC', name: '妨害', category: 'SPECIAL', description: '? ターンの間、敵のChgEを -2。', cost: 2, effectValues: [5, 2] },
    { id: 'JAMMING', rarity: 'LEGENDARY', name: '妨害', category: 'SPECIAL', description: '永続効果。敵のChgEを -2。', cost: 2, effectValues: [99, 2] },

    // WEAKEN (衰弱)
    { id: 'WEAKEN', rarity: 'COMMON', name: '衰弱', category: 'SPECIAL', description: '敵が攻撃していた場合に付与。相手のATKを ? ターンの間 -1。', cost: 4, effectValues: [3, 1] },
    { id: 'WEAKEN', rarity: 'RARE', name: '衰弱', category: 'SPECIAL', description: '敵が攻撃していた場合に付与。相手のATKを ? ターンの間 -1。', cost: 3, effectValues: [5, 1] },
    { id: 'WEAKEN', rarity: 'EPIC', name: '衰弱', category: 'SPECIAL', description: '敵が攻撃していた場合に付与。相手のATKを ? ターンの間 -2。', cost: 2, effectValues: [5, 2] },
    { id: 'WEAKEN', rarity: 'LEGENDARY', name: '衰弱', category: 'SPECIAL', description: '敵が攻撃していた場合に付与。相手のATKを永続的に -3。', cost: 2, effectValues: [99, 3] },

    // PARALYZE (麻痺)
    { id: 'PARALYZE', rarity: 'COMMON', name: '麻痺', category: 'SPECIAL', description: '敵がガードしていた場合に付与。相手のガードコストを ? ターンの間 +1。', cost: 4, effectValues: [3, 1] },
    { id: 'PARALYZE', rarity: 'RARE', name: '麻痺', category: 'SPECIAL', description: '敵がガードしていた場合に付与。相手のガードコストを ? ターンの間 +1。', cost: 3, effectValues: [5, 1] },
    { id: 'PARALYZE', rarity: 'EPIC', name: '麻痺', category: 'SPECIAL', description: '敵がガードしていた場合に付与。相手のガードコストを ? ターンの間 +2。', cost: 2, effectValues: [5, 2] },
    { id: 'PARALYZE', rarity: 'LEGENDARY', name: '麻痺', category: 'SPECIAL', description: '敵がガードしていた場合に付与。相手のガードコストを永続的に +3。', cost: 2, effectValues: [99, 3] },

    // 2. 上位スキル (RARE 以上限定)
    // CONVERT (変換)
    { id: 'CONVERT', rarity: 'RARE', name: '変換', category: 'CHARGE', description: '自分のHPを 2 消費し、エネルギーを ? チャージする。', cost: 0, effectValues: [2, 2] },
    { id: 'CONVERT', rarity: 'EPIC', name: '変換', category: 'CHARGE', description: '自分のHPを 1 消費し、エネルギーを ? チャージする。', cost: 0, effectValues: [1, 3] },
    { id: 'CONVERT', rarity: 'LEGENDARY', name: '変換', category: 'CHARGE', description: '自分のHPを 1 消費し、エネルギーを ? チャージする。', cost: 0, effectValues: [1, 5] },

    // PIERCE (ガード貫通)
    { id: 'PIERCE', rarity: 'RARE', name: 'ガード貫通', category: 'ATTACK', description: '敵がガードしていた場合のみ ? ダメージを与える。', cost: 3, effectValues: [2] },
    { id: 'PIERCE', rarity: 'EPIC', name: 'ガード貫通', category: 'ATTACK', description: '敵がガードしていた場合のみ ? ダメージを与える。', cost: 2, effectValues: [4] },
    { id: 'PIERCE', rarity: 'LEGENDARY', name: 'ガード貫通', category: 'ATTACK', description: '敵がガードしていた場合のみ ? ダメージを与える。', cost: 1, effectValues: [8] },

    // SHOCK (衝撃)
    { id: 'SHOCK', rarity: 'RARE', name: '衝撃', category: 'ATTACK', description: '敵の行動に関わらず、固定で ? ダメージ与える。', cost: 4, effectValues: [2] },
    { id: 'SHOCK', rarity: 'EPIC', name: '衝撃', category: 'ATTACK', description: '敵の行動に関わらず、固定で ? ダメージ与える。', cost: 3, effectValues: [3] },
    { id: 'SHOCK', rarity: 'LEGENDARY', name: '衝撃', category: 'ATTACK', description: '敵の行動に関わらず、固定で ? ダメージ与える。', cost: 2, effectValues: [5] },

    // VAMPIRE (吸血)
    { id: 'VAMPIRE', rarity: 'RARE', name: '吸血', category: 'ATTACK', description: '与えたダメージの ?% を回復する。', cost: 4, effectValues: [100] },
    { id: 'VAMPIRE', rarity: 'EPIC', name: '吸血', category: 'ATTACK', description: '与えたダメージの ?% を回復する。', cost: 3, effectValues: [150] },
    { id: 'VAMPIRE', rarity: 'LEGENDARY', name: '吸血', category: 'ATTACK', description: '与えたダメージの ?% を回復する。', cost: 2, effectValues: [300] },

    // FOCUS (集中)
    { id: 'FOCUS', rarity: 'RARE', name: '集中', category: 'CHARGE', description: '? ターンの間、自分のチャージ増加量を +2。', cost: 3, effectValues: [3, 2] },
    { id: 'FOCUS', rarity: 'EPIC', name: '集中', category: 'CHARGE', description: '? ターンの間、自分のチャージ増加量を +2。', cost: 2, effectValues: [5, 2] },
    { id: 'FOCUS', rarity: 'LEGENDARY', name: '集中', category: 'CHARGE', description: '永続効果。自分のチャージ増加量を +3。', cost: 1, effectValues: [99, 3] },

    // POISON (毒)
    { id: 'POISON', rarity: 'RARE', name: '毒', category: 'SPECIAL', description: '非ガード時に付与。自分が ? エネルギー貯めるたび相手に 1 ダメージ。', cost: 4, effectValues: [2, 1] },
    { id: 'POISON', rarity: 'EPIC', name: '毒', category: 'SPECIAL', description: '非ガード時に付与。自分が ? エネルギー貯めるたび相手に 1 ダメージ。', cost: 3, effectValues: [1, 1] },
    { id: 'POISON', rarity: 'LEGENDARY', name: '毒', category: 'SPECIAL', description: '非ガード時に付与。行動を選択するたびに 2 ダメージを与える猛毒。', cost: 2, effectValues: [0, 2] }, // 0 trigger means "Every Action"

    // DOOM (死の宣告)
    { id: 'DOOM', rarity: 'RARE', name: '死の宣告', category: 'SPECIAL', description: '? ターン後に 6 ダメージを与える時限爆弾を付与。', cost: 4, effectValues: [4, 6] },
    { id: 'DOOM', rarity: 'EPIC', name: '死の宣告', category: 'SPECIAL', description: '? ターン後に 8 ダメージを与える時限爆弾を付与。', cost: 3, effectValues: [3, 8] },
    { id: 'DOOM', rarity: 'LEGENDARY', name: '死の宣告', category: 'SPECIAL', description: '? ターン後に 15 ダメージを与える時限爆弾を付与。', cost: 3, effectValues: [2, 15] },

    // ZERO FORM (零式) - EPIC/LEGENDARY
    { id: 'ZERO_FORM', rarity: 'EPIC', name: '零式', category: 'CHARGE', description: 'エネルギーを +4 チャージ。4ターンGUARD不可。', cost: 0, effectValues: [4, 4] },
    { id: 'ZERO_FORM', rarity: 'LEGENDARY', name: '零式', category: 'CHARGE', description: 'エネルギーを +5 チャージ。2ターンGUARD不可。', cost: 0, effectValues: [5, 2] },

    // OVERCLOCK (過負荷) - EPIC/LEGENDARY
    { id: 'OVERCLOCK', rarity: 'EPIC', name: '過負荷', category: 'ATTACK', description: '敵に「現在エネルギー」と同値のダメージ。', cost: 2, effectValues: [1] },
    { id: 'OVERCLOCK', rarity: 'LEGENDARY', name: '過負荷', category: 'ATTACK', description: '敵に「現在エネルギー」×? 倍のダメージ。', cost: 1, effectValues: [1.5] },

    // MIRAGE (砂上の楼閣) - LEGENDARY only? (User listed as EPIC/LEGENDARY group)
    { id: 'MIRAGE', rarity: 'EPIC', name: '砂上の楼閣', category: 'GUARD', description: '3ターン無敵。終了時、受けたダメージをまとめて受ける。', cost: 3, effectValues: [3] },
    { id: 'MIRAGE', rarity: 'LEGENDARY', name: '砂上の楼閣', category: 'GUARD', description: '3ターン無敵。終了時、受けたダメージの半量を受ける。', cost: 3, effectValues: [3] },

    // GRAVITY ZONE (重力圏) - EPIC/LEGENDARY
    { id: 'GRAVITY_ZONE', rarity: 'EPIC', name: '重力圏', category: 'SPECIAL', description: '5ターンの間、お互いに「スキル」使用不可。', cost: 5, effectValues: [5] },
    { id: 'GRAVITY_ZONE', rarity: 'LEGENDARY', name: '重力圏', category: 'SPECIAL', description: '3ターンの間、お互いに「スキル」使用不可。', cost: 4, effectValues: [3] },

    // GAMBLER'S DICE (博打打ちの賽) - EPIC/LEGENDARY
    { id: 'GAMBLER', rarity: 'EPIC', name: '博打打ちの賽', category: 'CHARGE', description: '1~10のランダムチャージ。奇数ならHP-2。', cost: 0, effectValues: [] },
    { id: 'GAMBLER', rarity: 'LEGENDARY', name: '博打打ちの賽', category: 'CHARGE', description: '5~10のランダムチャージ。奇数ならHP-2。', cost: 0, effectValues: [] },

    // PHANTOM STEP (亡霊の足跡) - LEGENDARY
    { id: 'PHANTOM_STEP', rarity: 'LEGENDARY', name: '亡霊の足跡', category: 'SPECIAL', description: '次のターン、行動を2回連続で行う。', cost: 2, effectValues: [1] }

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
    'DOOM': { icon: 'skull', color: 'text-purple-600' },
    'SKILL_SEAL': { icon: 'lock', color: 'text-slate-400' },
    'BIND': { icon: 'link', color: 'text-indigo-400' }

};

export const GAME_MODES = {
    NORMAL: 'normal',
    TOWER: 'tower',
    ONLINE_HOST: 'online_host',
    ONLINE_CLIENT: 'online_client'
};

export const NETWORK_EVENTS = {
    CONNECTED: 'CONNECTED',
    READY: 'READY',
    CHAR_SELECT: 'CHAR_SELECT',
    MOVE_COMMIT: 'MOVE_COMMIT',
    MOVE_REVEAL: 'MOVE_REVEAL',
    SYNC_STATE: 'SYNC_STATE',
    CHAT: 'CHAT'
};

export const PASSIVE_SKILLS = [
    { id: 'FIRST_STRIKE', name: '機先', apply: (cpu, player) => { cpu.startE += 2; }, description: '開幕エネルギー+2' },
    { id: 'IRON_CLAD', name: '堅牢', apply: (cpu, player) => { cpu.effects.push({ type: 'DMG_REDUCE', amount: 1, turns: 3 }); }, description: '開幕3ターン軽減(1)' },
    { id: 'WAR_CRY', name: '雄叫び', apply: (cpu, player) => { cpu.effects.push({ type: 'ATK_UP', amount: 1, turns: 3 }); }, description: '開幕3ターンATK+1' },
    { id: 'FOCUS', name: '集中', apply: (cpu, player) => { cpu.effects.push({ type: 'CHGE_UP', amount: 1, turns: 3 }); }, description: '開幕3ターンChgE+1' },
    { id: 'VITALITY', name: '活力', apply: (cpu, player) => { cpu.hp += 5; }, description: '最大HP+5' },
    // Debuff Skills
    { id: 'LIFE_CUT', name: '命削り', apply: (cpu, player) => { player.hp = Math.floor(player.hp * 0.7); }, description: 'プレイヤーHP3割減' },
    { id: 'SLUGGISH', name: '停滞', apply: (cpu, player) => { player.chgE = Math.floor(player.chgE * 0.7); }, description: 'プレイヤーChgE3割減' },
    { id: 'LONG_ROAD', name: '長き道', apply: (cpu, player) => { player.winE = Math.floor(player.winE * 1.5); }, description: 'プレイヤーWinE1.5倍' },
    { id: 'SILENCE', name: '沈黙', apply: (cpu, player) => { player.effects.push({ type: 'SKILL_SEAL', amount: 0, turns: 3 }); }, description: '3ターンスキル不可' },
    { id: 'HEAVY_WEIGHT', name: '重枷', apply: (cpu, player) => { player.atkC += 1; }, description: 'プレイヤー攻撃コスト+1' },
    { id: 'LEAK', name: '漏出', apply: (cpu, player) => { player.startE = Math.floor(player.startE * 0.5); }, description: 'プレイヤー初期エナジー半減' },
    { id: 'CURSED_BODY', name: '呪いの体', apply: (cpu, player) => { player.effects.push({ type: 'BIND', amount: 0, turns: 99 }); }, description: 'プレイヤー行動制限(呪縛)' },
    { id: 'SELF_DESTRUCT', name: '自壊', apply: (cpu, player) => { cpu.effects.push({ type: 'DOOM', damage: 9999, turns: 1 }); }, description: '即座に自滅' }
];
