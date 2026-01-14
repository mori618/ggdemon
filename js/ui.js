import { EFFECT_ICONS, CHARACTERS } from './constants.js';
import { sound } from './sounds.js';
import { gameState } from './utils.js';

export function renderChars(handleCharSelect) {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';

    // コンテナのクラスを横長・多カラム向けに設定（スクロール維持）
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 overflow-y-auto pb-10 flex-1";

    // --- RANDOM CARD ---
    const rndDiv = document.createElement('div');
    // 横長にするため flex-row を採用
    rndDiv.className = "bg-slate-900 border-2 border-slate-700 p-4 rounded-2xl cursor-pointer hover:border-sky-500 hover:bg-slate-800/50 active:scale-[0.98] transition-all flex items-center gap-4 group";
    rndDiv.onclick = () => handleCharSelect('RANDOM');
    rndDiv.innerHTML = `
        <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-sky-400 group-hover:rotate-12 transition-transform">
            <i data-lucide="shuffle" class="w-6 h-6"></i>
        </div>
        <div class="text-left">
            <div class="font-black text-sm uppercase font-orbitron text-white">Random Select</div>
            <div class="text-[10px] text-slate-500 font-bold italic uppercase">Surprise Me</div>
        </div>
    `;
    grid.appendChild(rndDiv);

    // --- CHARACTER CARDS ---
    CHARACTERS.forEach(c => {
        const stats = [
            { icon: 'heart', val: c.hp, style: c.hp >= 5 ? 'text-rose-500 fill-rose-500/20' : 'text-rose-400', label: 'HP' },
            { icon: 'sword', val: c.atk, style: c.atk >= 3 ? 'text-red-500 fill-red-500/20' : 'text-red-400', label: 'ATK' },
            { icon: 'zap', val: `+${c.chgE}`, style: c.chgE >= 2 ? 'text-yellow-400 fill-yellow-400/20' : 'text-yellow-400', label: 'CHG' },
            { icon: 'battery', val: c.startE, style: c.startE >= 3 ? 'text-emerald-400 fill-emerald-400/20' : 'text-emerald-400', label: 'ENG' }
        ];

        const div = document.createElement('div');
        // w-fullで横幅いっぱいに使いつつ、内部をFlexで左右に分ける
        div.className = "bg-slate-900 border-2 border-slate-800 p-4 rounded-2xl cursor-pointer hover:border-emerald-500 hover:bg-slate-800/40 active:scale-[0.98] transition-all flex flex-col sm:flex-row items-center sm:items-start gap-4 text-white";
        div.onclick = () => handleCharSelect(c.id);

        div.innerHTML = `
            <div class="flex flex-row sm:flex-col items-center gap-3 sm:w-1/3 border-b sm:border-b-0 sm:border-r border-slate-800/50 pb-3 sm:pb-0 sm:pr-4">
                <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 shadow-inner">
                    <i data-lucide="${c.icon}" class="w-6 h-6"></i>
                </div>
                <div class="text-left sm:text-center">
                    <div class="font-black text-[10px] uppercase font-orbitron tracking-wider">${c.name}</div>
                    <!-- <div class="text-[9px] text-slate-500 font-bold italic line-clamp-1 uppercase mt-0.5">"${c.tagline}"</div> -->
                </div>
            </div>
            
            <div class="grid grid-cols-4 sm:grid-cols-2 gap-2 w-full sm:w-2/3 pt-1">
                ${stats.map(s => `
                    <div class="flex flex-col items-center justify-center bg-slate-950/50 rounded-lg py-1.5 border border-slate-800/30">
                        <div class="flex items-center gap-1 mb-0.5">
                            <i data-lucide="${s.icon}" class="w-3 h-3 ${s.style}"></i>
                            <span class="text-[8px] text-slate-500 font-bold uppercase">${s.label}</span>
                        </div>
                        <span class="text-[11px] font-black font-orbitron">${s.val}</span>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(div);
    });

    lucide.createIcons();
}

export function syncAudioUI() {
    const volPct = Math.round(sound.volume * 100);
    document.querySelectorAll('.sync-vol-slider').forEach(s => s.value = volPct);
    document.querySelectorAll('.sync-vol-text').forEach(t => t.innerText = `${volPct}%`);
    ['mute-icon', 'title-mute-icon'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('data-lucide', sound.isMuted ? 'volume-x' : 'volume-2');
    });
    ['sound-btn', 'title-sound-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (!sound.isMuted) el.classList.add('border-sky-500', 'bg-sky-950/30');
            else el.classList.remove('border-sky-500', 'bg-sky-950/30');
        }
    });
    lucide.createIcons();
}

export function renderEffects(character, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    if (!character || !character.effects) return;

    character.effects.forEach(effect => {
        const effectInfo = EFFECT_ICONS[effect.type];
        if (effectInfo) {
            const effectEl = document.createElement('div');
            effectEl.className = 'relative flex items-center justify-center w-6 h-6 bg-slate-900 rounded-full border-2 border-slate-700';
            effectEl.innerHTML = `
                <i data-lucide="${effectInfo.icon}" class="w-3 h-3 ${effectInfo.color}"></i>
                <span class="absolute -bottom-1 -right-1 text-[8px] font-bold bg-slate-700 text-white rounded-full w-3 h-3 flex items-center justify-center font-orbitron">${effect.turns}</span>
            `;
            container.appendChild(effectEl);
        }
    });
    lucide.createIcons();
}

export function setMessage(m) {
    document.getElementById('game-message').innerText = m;
}

export function addLog(msg) {
    const logEl = document.getElementById('online-log');
    if (!logEl) return;
    const div = document.createElement('div');
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    // Auto-scroll if at bottom
    const isAtBottom = logEl.scrollHeight - logEl.clientHeight <= logEl.scrollTop + 1;

    div.innerHTML = `<span class="text-slate-600 font-bold">[${time}]</span> ${msg}`;
    logEl.appendChild(div);

    if (isAtBottom) {
        logEl.scrollTop = logEl.scrollHeight;
    }
}

export function updateUI() {
    const { player, cpu, pHP, cHP, pEnergy, cEnergy, turn, isProc, selectedCmd, playerSkill } = gameState;
    if (!player) return;

    const pAtk = player.atk + (player.tempAtk || 0);
    const cAtk = cpu.atk + (cpu.tempAtk || 0);
    const pGrdC = Math.max(0, player.grdC + (player.tempGrdC || 0));
    const pChgC = Math.max(0, (player.chgC || 0) + (player.tempChgC || 0));
    const pChgE = player.chgE + (player.tempChgE || 0);
    const cChgE = cpu.chgE + (cpu.tempChgE || 0);

    document.getElementById('player-hp-bar').style.width = `${(pHP / player.hp) * 100}%`;
    document.getElementById('cpu-hp-bar').style.width = `${(cHP / cpu.hp) * 100}%`;
    document.getElementById('player-hp-text').innerText = `HP ${pHP} / ${player.hp}`;
    document.getElementById('cpu-hp-text').innerText = `HP ${cHP} / ${cpu.hp}`;

    document.getElementById('player-chge-val').innerText = `+${pChgE}`;
    document.getElementById('player-atk-val').innerText = String(pAtk);
    document.getElementById('player-cost-val').innerText = String(player.atkC);

    document.getElementById('cpu-chge-val').innerText = `+${cChgE}`;
    document.getElementById('cpu-atk-val').innerText = String(cAtk);
    document.getElementById('cpu-cost-val').innerText = String(cpu.atkC);

    const pD = document.getElementById('player-energy-bar').children;
    for (let i = 0; i < pD.length; i++) pD[i].className = `energy-dot ${i < pEnergy ? 'energy-active' : ''}`;
    const cD = document.getElementById('cpu-energy-bar').children;
    for (let i = 0; i < cD.length; i++) cD[i].className = `energy-dot ${i < cEnergy ? 'energy-active' : ''}`;
    document.getElementById('turn-display').innerText = String(turn);

    const checkC = (id, cost) => {
        const el = document.getElementById(id);
        if (pEnergy < cost) el.classList.add('cost-insufficient');
        else el.classList.remove('cost-insufficient');
    };

    document.getElementById('badge-charge-val').innerText = String(pChgC);
    document.getElementById('badge-attack-val').innerText = String(player.atkC);
    document.getElementById('badge-guard-val').innerText = String(pGrdC);

    checkC('badge-charge-val', pChgC);
    checkC('badge-attack-val', player.atkC);
    checkC('badge-guard-val', pGrdC);

    const isChargeDisabled = pEnergy < pChgC || isProc;
    const isAttackDisabled = pEnergy < player.atkC || isProc;
    const isGuardDisabled = pEnergy < pGrdC || isProc;
    let isSkillDisabled = true;

    document.getElementById('cmd-CHARGE').classList.toggle('is-disabled', isChargeDisabled);
    document.getElementById('cmd-ATTACK').classList.toggle('is-disabled', isAttackDisabled);
    document.getElementById('cmd-GUARD').classList.toggle('is-disabled', isGuardDisabled);

    document.getElementById('eff-charge').innerText = `+${pChgE}`;
    document.getElementById('eff-attack').innerText = `${pAtk} DMG`;

    const skillBtn = document.getElementById('cmd-SKILL');
    if (playerSkill) {
        const pSkillCost = Math.max(0, playerSkill.cost + (gameState.pChar.skillCostBonus || 0));
        isSkillDisabled = pEnergy < pSkillCost || isProc;
        document.getElementById('badge-skill-val').innerText = String(pSkillCost);
        document.getElementById('eff-skill').innerText = playerSkill.name;
        checkC('badge-skill-val', pSkillCost);
    } else {
        isSkillDisabled = true;
        document.getElementById('badge-skill-val').innerText = '-';
        document.getElementById('eff-skill').innerText = 'NO SKILL';
    }
    skillBtn.classList.toggle('is-disabled', isSkillDisabled);

    let canConfirm = false;
    if (selectedCmd && !isProc) {
        switch (selectedCmd) {
            case 'CHARGE': canConfirm = !isChargeDisabled; break;
            case 'ATTACK': canConfirm = !isAttackDisabled; break;
            case 'GUARD': canConfirm = !isGuardDisabled; break;
            case 'SKILL': canConfirm = !isSkillDisabled; break;
        }
    }
    document.getElementById('btn-ready').disabled = !canConfirm;
    ['CHARGE', 'ATTACK', 'GUARD', 'SKILL'].forEach(c => {
        const b = document.getElementById(`cmd-${c}`);
        if (selectedCmd === c) b.classList.add('selected');
        else b.classList.remove('selected');
    });

    renderEffects(player, 'player-effects-display');
    renderEffects(cpu, 'cpu-effects-display');
    lucide.createIcons();
}

export function showCommandDetail(command) {
    const detailView = document.getElementById('command-detail-view');
    const currentContent = detailView.firstElementChild;

    if (currentContent && currentContent.dataset.command !== command) {
        currentContent.style.animation = 'detailPopIn 0.2s reverse forwards';
        setTimeout(() => {
            detailView.innerHTML = '';
            if (command) showCommandDetail(command);
        }, 200);
        return;
    }

    if (!currentContent && !command) return;
    if (currentContent && currentContent.dataset.command === command) return;

    if (!command) {
        if (currentContent) {
            currentContent.style.animation = 'detailPopIn 0.2s reverse forwards';
            setTimeout(() => { detailView.innerHTML = ''; }, 200);
        }
        return;
    }

    const { player, playerSkill } = gameState;
    const pAtk = player.atk + (player.tempAtk || 0);
    const pChgE = player.chgE + (player.tempChgE || 0);
    let title = '', description = '', icon = '', color = 'text-white';

    switch (command) {
        case 'CHARGE':
            title = 'CHARGE';
            description = `エネルギーを <span class="text-yellow-400 font-bold">${pChgE}</span> 獲得する`;
            icon = 'zap';
            color = 'text-yellow-400';
            break;
        case 'ATTACK':
            title = 'ATTACK';
            description = `敵に <span class="text-rose-400 font-bold">${pAtk}</span> ダメージを与える`;
            icon = 'sword';
            color = 'text-rose-400';
            break;
        case 'GUARD':
            title = 'GUARD';
            description = '敵の攻撃をブロックする';
            icon = 'shield';
            color = 'text-sky-400';
            break;
        case 'SKILL':
            if (playerSkill) {
                title = playerSkill.name;
                description = playerSkill.description;
                icon = 'star';
                color = 'text-purple-400';
            }
            break;
    }

    if (title) {
        detailView.innerHTML = `
            <div data-command="${command}" class="text-center bg-slate-900/80 p-4 rounded-2xl border-2 border-slate-700 backdrop-blur-sm animate-detailPopIn shadow-2xl">
                <div class="flex items-center justify-center gap-2 mb-2">
                    <i data-lucide="${icon}" class="w-5 h-5 ${color}"></i>
                    <h3 class="font-orbitron text-lg font-bold ${color} uppercase">${title}</h3>
                </div>
                <p class="text-xs text-slate-300 font-bold max-w-[220px] leading-relaxed">${description}</p>
            </div>
        `;
        lucide.createIcons();
    }
}

export function initEnergy() {
    const { player, cpu, pEnergy, cEnergy } = gameState;
    const pb = document.getElementById('player-energy-bar'); pb.innerHTML = '';
    for (let i = 0; i < player.winE; i++) pb.innerHTML += '<div class="energy-dot"></div>';
    const cb = document.getElementById('cpu-energy-bar'); cb.innerHTML = '';
    const cLimit = cpu.winE;
    for (let i = 0; i < cLimit; i++) cb.innerHTML += '<div class="energy-dot"></div>';
}
