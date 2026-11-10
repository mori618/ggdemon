/**
 * オンライン対戦の画面制御。
 * ロビー → キャラクター選択 → マッチング / 部屋 → 対戦 → 結果、の流れを管理し、
 * 通信（ServerSession / P2PSession）とゲーム画面（game.js）をつなぐ。
 *
 * 通信方式が違っても、ここから見たイベントは同じ形（onStart / onTurn / onEnd ...）で届く。
 */
import { GAME_MODES } from '../constants.js';
import { gameState } from '../utils.js';
import { sound } from '../sounds.js';
import { setMessage, updateUI, showCommandDetail } from '../ui.js';
import { setupBattleState, executeTurn, onlineHooks, endOnlineBattle } from '../game.js';
import { MATCH_MODES, RESULTS, END_REASONS, NAME_MAX_LENGTH } from './protocol.js';
import { getPvpChar } from './pvp.js';
import { hasServer } from './config.js';
import { getStoredAccount, getLocalName, fetchProfile, changeName, fetchLeaderboard } from './account.js';
import { ServerSession } from './serverSession.js';
import { P2PSession, normalizeRoomCode } from './p2pSession.js';

const NATURAL_ENDS = [END_REASONS.KO, END_REASONS.DOUBLE_KO, END_REASONS.CHARGE, END_REASONS.DOUBLE_CHARGE, END_REASONS.TURN_LIMIT];
const END_WAIT_MS = 6000; // 手元で決着がついてから、サーバーの確定結果を待つ時間

const st = {
    deps: null,        // main.js から渡される画面操作
    session: null,
    kind: null,        // 'server' | 'p2p'
    mode: null,        // MATCH_MODES
    charId: null,
    profile: null,     // サーバー上のプロフィール
    serverOk: false,
    inMatch: false,
    info: null,
    turnQueue: [],
    animating: false,
    committed: false,
    oppReady: false,
    serverEnd: null,
    localEnd: null,
    endTimer: null,
    turnTimer: null,
    searchTimer: null,
    peerLeft: false
};

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => $(id)?.classList.toggle('hidden', !on);

// ---------------------------------------------------------------------------
// 表示の部品
// ---------------------------------------------------------------------------

const STEPS = ['lobby', 'friend', 'host', 'join', 'connecting', 'searching', 'ranking'];

function showStep(step) {
    STEPS.forEach(s => show(`online-step-${s}`, s === step));
    show('online-profile', step === 'lobby' || step === 'friend');
}

function setNotice(text) {
    const el = $('online-notice');
    el.innerText = text || '';
    el.classList.toggle('hidden', !text);
}

function setBanner(text) {
    const el = $('online-banner');
    el.innerText = text || '';
    el.classList.toggle('hidden', !text);
}

function showOnlineScreen(step) {
    show('title-screen', false);
    show('select-screen', false);
    show('online-screen', true);
    showStep(step);
}

const MESSAGES = {
    no_server: 'ランダムマッチ・レート戦のサーバーが設定されていません。フレンド戦のみ遊べます。',
    server_down: 'サーバーに接続できません。フレンド戦のみ遊べます。',
    unauthorized: 'アカウントを確認できませんでした。もう一度お試しください。',
    version_mismatch: 'ゲームが更新されています。ページを再読み込みしてください。',
    replaced: '別の画面で待機を始めたため、こちらの待機を終了しました。',
    connection_lost: 'サーバーとの接続が切れました。',
    match_not_found: '対戦が見つかりませんでした。',
    room_not_found: '部屋が見つかりませんでした。コードを確認してください。',
    connect_failed: '接続できませんでした。ネットワーク環境によっては直接つながらないことがあります。',
    peerjs_unavailable: '通信ライブラリを読み込めませんでした。ページを再読み込みしてください。',
    desync: '通信内容の食い違いを検出したため、対戦を中止しました。',
    peer_left: '相手が退出しました。'
};
const messageFor = (code) => MESSAGES[code] || `エラーが発生しました（${code}）`;

function renderProfile() {
    $('online-name').innerText = st.profile ? st.profile.name : getLocalName();
    const p = st.profile;
    $('online-rating').innerText = p ? String(p.rating) : '----';
    $('online-record').innerText = p ? `${p.wins}勝 ${p.losses}敗 ${p.draws}分` : '';
    $('online-rank').innerText = p && p.rank ? `${p.rank}位` : '';
    ['btn-online-ranked', 'btn-online-casual', 'btn-online-ranking'].forEach(id => {
        const b = $(id);
        b.disabled = !st.serverOk;
        b.classList.toggle('opacity-40', !st.serverOk);
        b.classList.toggle('pointer-events-none', !st.serverOk);
    });
}

async function refreshProfile() {
    renderProfile();
    if (!hasServer()) {
        st.serverOk = false;
        setNotice(messageFor('no_server'));
        return renderProfile();
    }
    try {
        st.profile = await fetchProfile();
        st.serverOk = true;
        setNotice('');
    } catch {
        st.serverOk = false;
        setNotice(messageFor('server_down'));
    }
    renderProfile();
}

// --- ターンの持ち時間表示 ---

function stopTurnTimer() {
    clearInterval(st.turnTimer);
    st.turnTimer = null;
    show('online-timer', false);
}

function startTurnTimer(ms) {
    stopTurnTimer();
    if (!ms || ms <= 0) return; // 時間制限なし（フレンド戦）
    const deadline = Date.now() + ms;
    const el = $('online-timer');
    const tick = () => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        el.innerText = String(left);
        el.classList.toggle('text-rose-400', left <= 10);
        el.classList.toggle('border-rose-500', left <= 10);
        if (left <= 0) clearInterval(st.turnTimer);
    };
    tick();
    show('online-timer', true);
    st.turnTimer = setInterval(tick, 250);
}

function stopSearchTimer() {
    clearInterval(st.searchTimer);
    st.searchTimer = null;
}

// ---------------------------------------------------------------------------
// ロビー
// ---------------------------------------------------------------------------

function openLobby(notice = '') {
    showOnlineScreen('lobby');
    refreshProfile().then(() => { if (notice) setNotice(notice); });
    if (notice) setNotice(notice);
}

// セッションを終わらせ、オンライン関連の表示を片付ける
function shutdown() {
    const session = st.session;
    st.session = null;
    if (session) session.leave();
    if (st.inMatch) endOnlineBattle('ABORTED', 'left');
    st.inMatch = false;
    st.kind = null;
    st.turnQueue = [];
    st.animating = false;
    st.serverEnd = st.localEnd = null;
    st.peerLeft = false;
    clearTimeout(st.endTimer);
    stopTurnTimer();
    stopSearchTimer();
    setBanner('');
    show('online-result-box', false);
    show('btn-online-again', false);
}

function startServerFlow(mode) {
    if (!st.serverOk) return;
    shutdown();
    st.kind = 'server';
    st.mode = mode;
    gameState.gameMode = GAME_MODES.ONLINE;
    st.deps.showCharSelect();
}

function beginQueue() {
    const account = getStoredAccount();
    if (!account) return openLobby(messageFor('unauthorized'));

    showOnlineScreen('searching');
    setNotice('');
    $('online-search-mode').innerText = st.mode === MATCH_MODES.RANKED ? 'RANKED MATCH' : 'RANDOM MATCH';
    $('online-search-status').innerText = '対戦相手を探しています…';
    const started = Date.now();
    const tick = () => { $('online-search-time').innerText = `${Math.floor((Date.now() - started) / 1000)}s`; };
    tick();
    stopSearchTimer();
    st.searchTimer = setInterval(tick, 1000);

    st.session = new ServerSession(account.token, handlers);
    st.session.queue(st.mode, st.charId);
}

function startP2P(role, code) {
    shutdown();
    st.kind = 'p2p';
    st.mode = MATCH_MODES.FRIEND;
    gameState.gameMode = GAME_MODES.ONLINE;
    setNotice('');
    try {
        st.session = new P2PSession(getLocalName(), handlers);
        if (role === 'host') {
            $('online-room-code').innerText = '······';
            showStep('host');
            st.session.host();
        } else {
            $('online-connecting-code').innerText = code;
            showStep('connecting');
            st.session.join(code);
        }
    } catch (err) {
        st.session = null;
        openLobby(messageFor(err.message));
    }
}

// ---------------------------------------------------------------------------
// 対戦
// ---------------------------------------------------------------------------

function lockCommands(message) {
    gameState.isProc = true;
    $('command-wrapper').classList.add('ui-hidden');
    showCommandDetail(null);
    setMessage(message);
}

function startBattle(info) {
    st.inMatch = true;
    st.info = info;
    st.turnQueue = [];
    st.animating = false;
    st.committed = false;
    st.oppReady = false;
    st.serverEnd = st.localEnd = null;
    st.peerLeft = false;
    clearTimeout(st.endTimer);
    stopSearchTimer();
    setBanner('');

    show('online-screen', false);
    show('select-screen', false);
    show('title-screen', false);
    const ov = $('result-overlay');
    ov.classList.add('hidden');
    ov.classList.remove('opacity-100');

    const clone = (c) => JSON.parse(JSON.stringify(c));
    gameState.gameMode = GAME_MODES.ONLINE;
    gameState.pChar = clone(getPvpChar(info.you.charId));
    gameState.cChar = clone(getPvpChar(info.opp.charId));
    gameState.nextBattleEffects = [];
    gameState.nextBattleMod = null;
    gameState.isPaused = false;
    setupBattleState();

    // 再接続時は途中の局面から始める
    if (info.state) {
        gameState.pHP = info.state[0].hp;
        gameState.pEnergy = info.state[0].energy;
        gameState.cHP = info.state[1].hp;
        gameState.cEnergy = info.state[1].energy;
        gameState.turn = info.turn;
        updateUI();
    }

    $('player-name-label').innerText = info.you.name;
    $('cpu-name-label').innerText = info.opp.name;
    const badge = $('cpu-level-badge');
    badge.innerText = info.mode === MATCH_MODES.RANKED ? `RATE ${info.opp.rating}`
        : info.mode === MATCH_MODES.CASUAL ? 'RANDOM' : 'FRIEND';

    sound.playSE('ready');

    if (info.committed) {
        st.committed = true;
        lockCommands('Waiting for opponent...');
    } else {
        if (info.oppCommitted) { st.oppReady = true; setMessage('Opponent Ready!'); }
        startTurnTimer(info.remainingMs ?? info.turnMs);
    }
}

// 届いたターン結果を順番に再生する（演出中に次が届いても重ならないように）
function pump() {
    if (st.animating || !st.inMatch || st.turnQueue.length === 0) return;
    const t = st.turnQueue.shift();
    st.animating = true;
    st.committed = false;
    st.oppReady = false;
    stopTurnTimer();
    gameState.selectedCmd = t.you;
    lockCommands(t.auto ? 'TIME UP!' : 'BATTLE!!');
    executeTurn(t.you, t.opp);
}

onlineHooks.onTurnReady = () => {
    st.animating = false;
    if (!st.inMatch) return;
    if (st.turnQueue.length > 0) pump();
    else startTurnTimer(st.info.turnMs);
};

onlineHooks.onLocalEnd = (outcome) => {
    st.animating = false;
    st.localEnd = outcome;
    if (st.kind === 'p2p' || st.serverEnd) finalize();
    else st.endTimer = setTimeout(finalize, END_WAIT_MS); // サーバーの確定結果（レート）を待つ
};

function submitMove(move) {
    if (!st.inMatch || st.committed || !st.session) return;
    st.committed = true;
    sound.playSE('ready');
    lockCommands(st.oppReady ? 'BATTLE!!' : 'Waiting for opponent...');
    stopTurnTimer();
    st.session.submitMove(move);
}

// --- 結果表示 ---

function describe(result, reason) {
    const win = result === RESULTS.WIN;
    switch (reason) {
        case END_REASONS.KO: return win ? 'ENEMY DESTROYED' : 'HP EXHAUSTED';
        case END_REASONS.CHARGE: return win ? 'CHARGED UP' : 'OPPONENT CHARGED UP';
        case END_REASONS.DOUBLE_KO: return 'DOUBLE K.O.';
        case END_REASONS.DOUBLE_CHARGE: return 'SIMULTANEOUS CHARGE';
        case END_REASONS.TURN_LIMIT: return 'TURN LIMIT';
        case END_REASONS.FORFEIT: return win ? '相手が降参しました' : '降参しました';
        case END_REASONS.TIMEOUT: return win ? '相手が時間切れになりました' : '時間切れになりました';
        case END_REASONS.DISCONNECT: return win ? '相手の接続が切れました' : '接続が切れました';
        case END_REASONS.NO_SHOW: return '対戦が成立しませんでした（レート変動なし）';
        case END_REASONS.DESYNC: return messageFor('desync');
        default: return '';
    }
}

function finalize() {
    if (!st.inMatch) return;
    clearTimeout(st.endTimer);

    let result, reason, rating = null;
    if (st.serverEnd) {
        ({ result, reason, rating } = st.serverEnd);
    } else if (st.localEnd) {
        const w = st.localEnd.winner;
        result = w === -1 ? RESULTS.DRAW : (w === 0 ? RESULTS.WIN : RESULTS.LOSE);
        reason = st.localEnd.reason;
    } else {
        return;
    }

    const title = { [RESULTS.WIN]: 'VICTORY', [RESULTS.LOSE]: 'DEFEAT', [RESULTS.DRAW]: 'DRAW', [RESULTS.VOID]: 'NO CONTEST' }[result];
    endOnlineBattle(title, reason);
    st.inMatch = false;
    st.turnQueue = [];
    stopTurnTimer();
    setBanner('');
    if (gameState.isPaused) st.deps.closePause();
    showResult(title, describe(result, reason), result, rating);
}

function showResult(title, desc, result, rating) {
    if (result === RESULTS.WIN) sound.playSE('victory');
    else if (result === RESULTS.LOSE) sound.playSE('defeat');

    const tit = $('result-title');
    tit.innerText = title;
    tit.className = `text-5xl font-black italic font-orbitron mb-2 uppercase tracking-tighter drop-shadow-lg z-10 ${result === RESULTS.WIN ? 'text-emerald-400' : result === RESULTS.LOSE ? 'text-rose-500' : 'text-white'}`;
    $('result-desc').innerText = desc;

    show('tower-result-stats', false);
    show('btn-retry-tower', false);
    $('streak-result-box')?.classList.add('hidden');
    // VS CPU 用の「もう一度」ボタン・連戦成績は出さない
    show('btn-rematch', false);
    $('series-stats')?.classList.remove('flex');
    show('series-stats', false);

    // レート変動
    const box = $('online-result-box');
    if (rating) {
        const delta = rating.after - rating.before;
        $('online-result-rating').innerText = `${rating.before} → ${rating.after}`;
        const d = $('online-result-delta');
        d.innerText = `${delta >= 0 ? '+' : ''}${delta}`;
        d.className = `font-orbitron font-black text-2xl ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-300'}`;
        if (st.profile) st.profile.rating = rating.after;
    }
    box.classList.toggle('hidden', !rating);
    show('online-result-note', false);

    const again = $('btn-online-again');
    again.disabled = false;
    again.classList.remove('opacity-50');
    if (st.kind === 'p2p') {
        const gone = st.peerLeft || !st.session || st.session.closed;
        again.innerText = '再戦する';
        show('btn-online-again', !gone);
        if (gone) setResultNote(messageFor('peer_left'));
    } else {
        again.innerText = 'もう一度マッチング';
        show('btn-online-again', true);
    }

    const ov = $('result-overlay');
    ov.classList.remove('hidden');
    setTimeout(() => ov.classList.add('opacity-100'), 10);
}

function setResultNote(text) {
    const el = $('online-result-note');
    el.innerText = text;
    el.classList.toggle('hidden', !text);
}

// ---------------------------------------------------------------------------
// 通信からのイベント
// ---------------------------------------------------------------------------

// 古いセッションからのイベントを無視するためのラッパー
const guard = (fn) => function (...args) {
    if (st.session && (st.session.h === handlers)) return fn(...args);
};

const handlers = {
    onQueued: guard(() => { $('online-search-status').innerText = '対戦相手を探しています…'; }),

    onMatched: guard(() => {
        stopSearchTimer();
        $('online-search-status').innerText = '相手が見つかりました！';
    }),

    onStart: guard((info) => startBattle(info)),
    onResync: guard((info) => startBattle(info)),

    onOpponentReady: guard(() => {
        st.oppReady = true;
        if (st.inMatch && !st.committed && !st.animating) setMessage('Opponent Ready!');
    }),

    onTurn: guard((t) => {
        st.turnQueue.push(t);
        pump();
    }),

    onEnd: guard((end) => {
        st.serverEnd = end;
        if (!st.inMatch) {
            // 対戦画面に入る前に終わった（相手が現れなかった等）
            st.session = null;
            return openLobby(describe(end.result, end.reason));
        }
        const natural = NATURAL_ENDS.includes(end.reason);
        const stillPlaying = st.animating || st.turnQueue.length > 0;
        // 盤面で決着した場合は最後のターンの演出が終わってから結果を出す
        if (natural && stillPlaying && !st.localEnd) {
            clearTimeout(st.endTimer);
            st.endTimer = setTimeout(finalize, END_WAIT_MS);
            return;
        }
        finalize();
    }),

    onOpponentDisconnected: guard(() => setBanner('相手の接続が切れました。復帰を待っています…')),
    onOpponentReconnected: guard(() => setBanner('')),
    onConnectionLost: guard(() => setBanner('接続が切れました。再接続しています…')),
    onConnectionRestored: guard(() => setBanner('')),

    onError: guard((code) => {
        if (code === 'illegal_move' && st.inMatch) {
            // 手が受理されなかったので選び直す
            st.committed = false;
            gameState.isProc = false;
            gameState.selectedCmd = null;
            $('command-wrapper').classList.remove('ui-hidden');
            setMessage('Command Select');
            updateUI();
        }
    }),

    onFatal: guard((code) => {
        if (st.inMatch) {
            // 対戦中に続行不能になった
            st.serverEnd = {
                result: code === 'desync' ? RESULTS.VOID : RESULTS.LOSE,
                reason: code === 'desync' ? END_REASONS.DESYNC : END_REASONS.DISCONNECT,
                rating: null
            };
            st.peerLeft = true;
            return finalize();
        }
        st.session = null;
        stopSearchTimer();
        openLobby(messageFor(code));
    }),

    // --- フレンド戦（P2P）のみ ---

    onRoomReady: guard((code) => { $('online-room-code').innerText = code; }),

    onPeerConnected: guard(() => { sound.playSE('ready'); }),

    onPickCharacter: guard(() => {
        st.inMatch = false;
        const ov = $('result-overlay');
        ov.classList.add('hidden');
        ov.classList.remove('opacity-100');
        show('online-screen', false);
        st.deps.showCharSelect();
    }),

    onRematchRequested: guard(() => setResultNote('相手が再戦を希望しています')),

    onPeerLeft: guard(() => {
        st.peerLeft = true;
        if (st.inMatch) {
            st.serverEnd = { result: RESULTS.WIN, reason: END_REASONS.DISCONNECT, rating: null };
            return finalize();
        }
        const resultShown = !$('result-overlay').classList.contains('hidden');
        if (resultShown) {
            show('btn-online-again', false);
            setResultNote(messageFor('peer_left'));
        } else {
            st.session = null;
            openLobby(messageFor('peer_left'));
        }
    })
};

// フレンド戦はページを閉じたことを相手がすぐ知る手段がないので、閉じる前に退出を伝える。
// （サーバー対戦は、切断から一定時間内なら再接続できるようにあえて何も送らない）
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        if (st.kind === 'p2p' && st.session) st.session.leave();
    });
}

// ---------------------------------------------------------------------------
// main.js / HTML から呼ばれる入口
// ---------------------------------------------------------------------------

export const online = {
    init(deps) { st.deps = deps; },

    isOnlineMode: () => gameState.gameMode === GAME_MODES.ONLINE,
    inMatch: () => st.inMatch,

    openLobby() {
        sound.playSE('click');
        shutdown();
        openLobby();
    },

    exit() {
        sound.playSE('click');
        shutdown();
        show('online-screen', false);
        show('title-screen', true);
    },

    // タイトルへ戻る等で対戦から抜ける（対戦中なら降参になる）
    shutdown,

    start(mode) {
        sound.playSE('click');
        startServerFlow(mode);
    },

    showFriendMenu() {
        sound.playSE('click');
        shutdown();
        setNotice('');
        showStep('friend');
    },

    hostRoom() {
        sound.playSE('click');
        startP2P('host');
    },

    showJoin() {
        sound.playSE('click');
        showStep('join');
        $('online-join-input').value = '';
        $('online-join-input').focus();
    },

    joinRoom() {
        const code = normalizeRoomCode($('online-join-input').value);
        if (!code) return setNotice('部屋コードは6文字です。');
        sound.playSE('click');
        startP2P('join', code);
    },

    // 待機・部屋作成・接続のキャンセル
    cancel() {
        sound.playSE('click');
        shutdown();
        setNotice('');
        showStep('lobby');
        refreshProfile();
    },

    async copyRoomCode() {
        const code = $('online-room-code').innerText;
        try {
            await navigator.clipboard.writeText(code);
            $('online-copy-label').innerText = 'コピーしました';
            setTimeout(() => { $('online-copy-label').innerText = 'コードをコピー'; }, 1500);
        } catch { /* クリップボードが使えない環境 */ }
    },

    async editName() {
        const current = $('online-name').innerText;
        const input = window.prompt(`表示名（${NAME_MAX_LENGTH}文字まで）`, current);
        if (input === null) return;
        try {
            const name = await changeName(input);
            if (!name) return setNotice('その名前は使えません。');
            if (st.profile) st.profile.name = name;
            setNotice('');
            renderProfile();
        } catch {
            setNotice('名前を変更できませんでした。');
        }
    },

    async showRanking() {
        sound.playSE('click');
        showStep('ranking');
        const list = $('online-ranking-list');
        list.innerText = '読み込み中…';
        try {
            const players = await fetchLeaderboard();
            list.innerHTML = '';
            if (players.length === 0) list.innerText = 'まだレート戦の記録がありません。';
            const myId = getStoredAccount()?.playerId;
            for (const p of players) {
                const row = document.createElement('div');
                row.className = `flex items-center gap-3 px-3 py-2 rounded-xl border ${p.playerId === myId ? 'border-sky-500 bg-sky-950/40' : 'border-slate-800 bg-slate-900/60'}`;
                const cell = (text, cls) => {
                    const s = document.createElement('span');
                    s.className = cls;
                    s.innerText = text; // 名前は他人が決めた文字列なので、必ずテキストとして表示する
                    row.appendChild(s);
                };
                cell(String(p.rank), 'w-7 text-right font-orbitron font-black text-slate-500 text-sm');
                cell(p.name, 'flex-1 text-left font-bold text-sm truncate');
                cell(`${p.wins}-${p.losses}-${p.draws}`, 'font-orbitron text-[10px] text-slate-500');
                cell(String(p.rating), 'w-12 text-right font-orbitron font-black text-amber-400');
                list.appendChild(row);
            }
        } catch {
            list.innerText = 'ランキングを取得できませんでした。';
        }
    },

    backToLobby() {
        sound.playSE('click');
        setNotice('');
        showStep('lobby');
        refreshProfile();
    },

    // キャラクター選択の確定
    onCharChosen(charId) {
        st.charId = charId;
        if (st.kind === 'server') {
            beginQueue();
        } else if (st.kind === 'p2p' && st.session) {
            $('select-title').innerText = 'Waiting for Opponent...';
            $('char-grid').classList.add('pointer-events-none', 'opacity-50');
            st.session.pickCharacter(charId);
        }
    },

    // キャラクター選択画面の「戻る」
    onBackFromSelect() {
        shutdown();
        openLobby();
    },

    submitMove,

    // 結果画面の「もう一度」
    again() {
        sound.playSE('click');
        if (st.kind === 'p2p') {
            if (!st.session || st.session.closed) return;
            const again = $('btn-online-again');
            again.disabled = true;
            again.classList.add('opacity-50');
            again.innerText = '相手の返事を待っています…';
            st.session.requestRematch();
            return;
        }
        // サーバー対戦: 同じモード・同じキャラクターで並び直す
        const { mode, charId } = st;
        shutdown();
        const ov = $('result-overlay');
        ov.classList.add('hidden');
        ov.classList.remove('opacity-100');
        st.kind = 'server';
        st.mode = mode;
        st.charId = charId;
        gameState.gameMode = GAME_MODES.ONLINE;
        beginQueue();
    }
};
