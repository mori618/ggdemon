export function showTreasure(forceSkillPhase = false) {
    const cardsContainer = document.getElementById('event-items-container');
    const isMimic = (gameState.cpu && gameState.cpu.id === 'TREASURE_CHEST');
    const isBoss = (gameState.floor % 5 === 0);
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
    wrapper.className = 'w-full flex flex-col md:flex-row items-center justify-center gap-4 px-4';
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

    if (!forceSkillPhase) {
        // Add Skip Button
        const skipCard = document.createElement('div');
        skipCard.className = 'w-full max-w-xs md:max-w-[240px] h-full min-h-[160px] bg-slate-800 border-2 border-slate-600 p-4 rounded-xl shadow-lg cursor-pointer hover:bg-slate-700 transition-all flex flex-col items-center text-center gap-4 group hover:scale-[1.05] active:scale-95 opacity-80 hover:opacity-100';
        skipCard.innerHTML = `
            <div class="flex-shrink-0 mt-2">
                <i data-lucide="skip-forward" class="w-12 h-12 text-slate-400"></i>
            </div>
            <div class="flex-1 w-full flex flex-col justify-center">
                <h3 class="font-orbitron font-bold text-sm mb-2 text-white">SKIP</h3>
                <div class="text-xs text-slate-500 font-bold uppercase">能力を変更せずに進む</div>
            </div>
        `;
        skipCard.onclick = () => {
            if (window.sound) window.sound.playSE('click');
            cardsContainer.classList.add('hidden');
            selectTreasure({ type: 'skip' }, false);
        };
        wrapper.appendChild(skipCard);
    }

    if (window.lucide) window.lucide.createIcons();
}
