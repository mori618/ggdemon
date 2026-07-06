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

export function showEvent() {
    // Helper to close event and proceed to map
    const closeEvent = () => {
        closeEventScreen();
        showMap();
    };

    const eventTypes = [
        'GOLD', 'TRAP', 'FREE_BUFF', 'TRIAL', 'MINI_BOSS', 'EXTRA_LIFE', 'SKILL_DROP',
        'SKILL_UPGRADE', 'HIDDEN_TREASURE', 'DISCOUNT_SHOP', 'WEAK_ENEMY',
        'INVINCIBLE_BUFF', 'ATK_BOOST_BUFF', 'CHG_BOOST_BUFF', 'ELITE_WARNING', 'TIME_LEAP',
        'WEAK_BOSS', 'STRONG_BOSS', 'CURSED_TREASURE', 'LEGEND_TREASURE', 'STATUE_GREET', 'STATUE_BLESSING',
        'MEGA_GOLD', 'PAY_SKILL_UPGRADE', 'SKILL_SELL'
    ];
    let eType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
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
            document.getElementById('player-gold-val').innerText = gameState.gold;
            closeEvent();
        }, colorClass: 'bg-amber-900 text-amber-200 border-amber-600 hover:bg-amber-800' });
    } else if (eType === 'MEGA_GOLD') {
        title = 'Treasure Hoard';
        npcColor = 'text-amber-300';
        npcIcon = 'gem';
        desc = 'まばゆく光る大量の金貨の山を発見した！';
        options.push({ text: 'Take all', icon: 'coins', onClick: () => {
            gameState.gold += Math.floor(Math.random() * 51) + 50;
            document.getElementById('player-gold-val').innerText = gameState.gold;
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
            updateHP();
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
            updateStatusDisplay();
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
            updateHP();
            updateStatusDisplay();
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
            startBattle(true); // force elite
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
            updateHP();
            updateStatusDisplay();
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
            document.getElementById('player-gold-val').innerText = gameState.gold;
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
            document.getElementById('player-gold-val').innerText = gameState.gold;
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
            startBattle();
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
            startBattle(true);
            const baseChar = CHARACTERS.find(c => c.id === gameState.cpu.id);
            gameState.cChar.hp = Math.max(1, Math.floor(baseChar.hp / 2));
            gameState.cChar.atk = Math.max(1, Math.floor(baseChar.atk / 2));
            updateHP(true);
            updateStatusDisplay();
        }, colorClass: 'bg-rose-900 text-rose-200 border-rose-600 hover:bg-rose-800' });
        options.push({ text: 'Leave', icon: 'footprints', onClick: () => closeEvent() });
    } else if (eType === 'STRONG_BOSS') {
        title = 'Enraged Beast';
        npcColor = 'text-red-700';
        npcIcon = 'flame';
        desc = '怒り狂う強大な魔物がいる！倒せば莫大な報酬が手に入るだろう。';
        options.push({ text: 'Challenge', icon: 'swords', onClick: () => {
            closeEventScreen();
            startBattle(true);
            const baseChar = CHARACTERS.find(c => c.id === gameState.cpu.id);
            gameState.cChar.hp = Math.floor(baseChar.hp * 1.5);
            gameState.cChar.atk = Math.floor(baseChar.atk * 1.5);
            gameState.cHP = gameState.cChar.hp;
            gameState.nextBattleEffects = [{ type: 'REWARD_UP', amount: 3, turns: 99 }];
            updateHP(true);
            updateStatusDisplay();
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
            updateHP();
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
