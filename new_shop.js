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
    wrapper.className = 'w-full flex flex-col md:flex-row items-center justify-center gap-4 px-4';
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
                document.getElementById('player-gold-val').innerText = gameState.gold;
                document.getElementById('event-shop-gold').innerText = gameState.gold;
                item.action();
                updateHP();
                updateStatusDisplay();
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
