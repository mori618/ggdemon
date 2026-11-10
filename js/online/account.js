/**
 * プレイヤーのアカウント（登録不要の匿名アカウント）。
 * 初回にサーバーが発行する ID とトークンをこの端末の localStorage に保存する。
 * トークンが本人確認の鍵なので、端末のデータを消すとレートは引き継げない。
 */
import { SERVER_URL, hasServer } from './config.js';
import { sanitizeName, randomGuestName } from './protocol.js';

const ACCOUNT_KEY = 'ggdemon_online_account';
const NAME_KEY = 'ggdemon_online_name';

function read(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 保存できない環境 */ }
}

export function getStoredAccount() {
    try {
        const a = JSON.parse(read(ACCOUNT_KEY) || 'null');
        return a && typeof a.token === 'string' && typeof a.playerId === 'string' ? a : null;
    } catch { return null; }
}

// 表示名（サーバーが無くてもフレンド戦で使う）
export function getLocalName() {
    let name = sanitizeName(read(NAME_KEY) || '');
    if (!name) {
        name = randomGuestName();
        write(NAME_KEY, name);
    }
    return name;
}

async function api(path, { token, body } = {}) {
    const res = await fetch(SERVER_URL + path, {
        method: body ? 'POST' : 'GET',
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || `http_${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function register() {
    const p = await api('/api/register', { body: { name: getLocalName() } });
    write(ACCOUNT_KEY, JSON.stringify({ playerId: p.playerId, token: p.token }));
    write(NAME_KEY, p.name);
    return p;
}

/**
 * サーバー上のプロフィールを取得する。アカウントが無ければ作る。
 * 戻り値: { playerId, name, rating, wins, losses, draws, rank }
 */
export async function fetchProfile() {
    if (!hasServer()) throw new Error('no_server');
    const account = getStoredAccount();
    if (!account) return register();
    try {
        const p = await api('/api/me', { token: account.token });
        write(NAME_KEY, p.name);
        return p;
    } catch (err) {
        // サーバー側にアカウントが無い（データが初期化された等）場合は作り直す
        if (err.status === 401) return register();
        throw err;
    }
}

/**
 * 表示名を変更する。サーバーがあればサーバーにも反映する。
 * 戻り値: 確定した表示名（使えない名前なら null）
 */
export async function changeName(raw) {
    const name = sanitizeName(raw);
    if (!name) return null;
    write(NAME_KEY, name);
    const account = getStoredAccount();
    if (hasServer() && account) {
        const p = await api('/api/name', { token: account.token, body: { name } });
        return p.name;
    }
    return name;
}

export async function fetchLeaderboard() {
    return (await api('/api/leaderboard')).players;
}
