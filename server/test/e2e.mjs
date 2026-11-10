/**
 * サーバーの通しテスト。ローカルで起動したサーバーに2人ぶんの接続を張って実際に対戦する。
 *
 *   npm run db:migrate:local
 *   npx wrangler dev --port 8787 --var TURN_MS:1500 --var ANIM_GRACE_MS:300 --var DISCONNECT_GRACE_MS:1500 --var CONNECT_MS:2000
 *   npm run test:e2e
 */
import assert from 'node:assert/strict';

const BASE = process.env.SERVER_URL || 'http://localhost:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');
const V = 1;

async function api(path, { token, body } = {}) {
    const res = await fetch(BASE + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json() };
}

// メッセージを順番に待てる WebSocket ラッパー
function open(url) {
    const ws = new WebSocket(url);
    const queue = [], waiters = [];
    let closed = false;
    const push = m => { const w = waiters.shift(); if (w) w(m); else queue.push(m); };
    ws.onmessage = e => push(JSON.parse(e.data));
    ws.onclose = () => { closed = true; while (waiters.length) waiters.shift()({ t: '__closed' }); };
    return {
        ws,
        send: m => ws.send(JSON.stringify(m)),
        close: () => ws.close(),
        // 指定した種類のメッセージが来るまで読み飛ばす
        async next(type, timeoutMs = 8000) {
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                let m = queue.shift();
                if (!m) {
                    if (closed) throw new Error(`socket closed while waiting for ${type}`);
                    m = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), Math.max(1, deadline - Date.now()));
                        waiters.push(v => { clearTimeout(timer); resolve(v); });
                    });
                }
                if (m.t === '__closed') throw new Error(`socket closed while waiting for ${type}`);
                if (m.t === type) return m;
            }
        }
    };
}

async function register(name) {
    const { status, data } = await api('/api/register', { body: { name } });
    assert.equal(status, 200);
    return data;
}

const queueUrl = (p, mode, char) => `${WS_BASE}/ws/queue?v=${V}&token=${p.token}&mode=${mode}&char=${char}`;
const matchUrl = (p, id) => `${WS_BASE}/ws/match/${id}?v=${V}&token=${p.token}`;

// 2人をマッチングさせ、対戦部屋に入った状態を返す
async function pairUp(a, b, mode, chars = ['NORMAL', 'NORMAL']) {
    const qa = open(queueUrl(a, mode, chars[0]));
    await qa.next('queued');
    const qb = open(queueUrl(b, mode, chars[1]));
    const [ma, mb] = await Promise.all([qa.next('matched'), qb.next('matched')]);
    assert.equal(ma.matchId, mb.matchId);
    const sa = open(matchUrl(a, ma.matchId)), sb = open(matchUrl(b, ma.matchId));
    const [startA, startB] = await Promise.all([sa.next('start'), sb.next('start')]);
    return { matchId: ma.matchId, sa, sb, startA, startB };
}

async function playTurn(sa, sb, turn, moveA, moveB) {
    sa.send({ t: 'move', turn, move: moveA });
    sb.send({ t: 'move', turn, move: moveB });
    return Promise.all([sa.next('turn'), sb.next('turn')]);
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('登録・プロフィール・名前変更', async () => {
    const p = await register('テスト太郎');
    assert.equal(p.name, 'テスト太郎');
    assert.equal(p.rating, 1500);
    assert.match(p.token, /^[0-9a-f]{64}$/);

    const me = await api('/api/me', { token: p.token });
    assert.equal(me.data.playerId, p.playerId);
    assert.equal(me.data.rank, null);

    const renamed = await api('/api/name', { token: p.token, body: { name: '  新しい  名前  ' } });
    assert.equal(renamed.data.name, '新しい 名前');
    assert.equal((await api('/api/name', { token: p.token, body: { name: '   ' } })).status, 400);
    assert.equal((await api('/api/me', { token: 'x'.repeat(64) })).status, 401);
    assert.equal((await api('/api/me', { token: 'a'.repeat(64) })).status, 401);
});

test('不正な接続は理由つきで断られる', async () => {
    const p = await register('bad');
    const cases = [
        [`${WS_BASE}/ws/queue?v=${V}&token=${'0'.repeat(64)}&mode=ranked&char=NORMAL`, 'unauthorized'],
        [`${WS_BASE}/ws/queue?v=999&token=${p.token}&mode=ranked&char=NORMAL`, 'version_mismatch'],
        [`${WS_BASE}/ws/queue?v=${V}&token=${p.token}&mode=friend&char=NORMAL`, 'invalid_mode'],
        [`${WS_BASE}/ws/queue?v=${V}&token=${p.token}&mode=ranked&char=VOID_EATER`, 'invalid_character'],
        [`${WS_BASE}/ws/match/${crypto.randomUUID()}?v=${V}&token=${p.token}`, 'match_not_found']
    ];
    for (const [url, code] of cases) {
        const err = await open(url).next('error');
        assert.equal(err.code, code);
    }
});

test('レート戦: 決着まで対戦し、レートと戦績が更新される', async () => {
    const a = await register('Alice'), b = await register('Bob');
    const { sa, sb, startA, startB } = await pairUp(a, b, 'ranked');
    assert.equal(startA.opp.name, 'Bob');
    assert.equal(startB.opp.name, 'Alice');
    assert.equal(startA.you.charId, 'NORMAL');
    assert.equal(startA.turn, 1);

    // 相手が先に手を出すと opp_ready が届くが、手の中身は届かない
    sa.send({ t: 'move', turn: 1, move: 'CHARGE' });
    await sb.next('opp_ready');
    sb.send({ t: 'move', turn: 1, move: 'CHARGE' });
    const [t1a, t1b] = await Promise.all([sa.next('turn'), sb.next('turn')]);
    assert.deepEqual([t1a.you, t1a.opp, t1b.you, t1b.opp], ['CHARGE', 'CHARGE', 'CHARGE', 'CHARGE']);

    // コスト不足の手は拒否される（NORMAL の攻撃はエネルギー1が必要。今は1あるので、2回連続では撃てない）
    const [t2a] = await playTurn(sa, sb, 2, 'ATTACK', 'CHARGE'); // B: HP 3→2, A: E 1→0
    assert.equal(t2a.you, 'ATTACK');
    sa.send({ t: 'move', turn: 3, move: 'ATTACK' });
    assert.equal((await sa.next('error')).code, 'illegal_move');

    // 以降 A はチャージ→攻撃を繰り返し、B はチャージし続ける
    // B は毎ターン+1なので、A が先に倒しきれるよう進める
    await playTurn(sa, sb, 3, 'CHARGE', 'GUARD');
    await playTurn(sa, sb, 4, 'ATTACK', 'CHARGE'); // B HP 2→1
    await playTurn(sa, sb, 5, 'CHARGE', 'GUARD');
    await playTurn(sa, sb, 6, 'ATTACK', 'CHARGE'); // B HP 1→0

    const [endA, endB] = await Promise.all([sa.next('end'), sb.next('end')]);
    assert.equal(endA.result, 'WIN');
    assert.equal(endB.result, 'LOSE');
    assert.equal(endA.reason, 'ko');
    assert.deepEqual(endA.rating, { before: 1500, after: 1516 });
    assert.deepEqual(endB.rating, { before: 1500, after: 1484 });

    const meA = (await api('/api/me', { token: a.token })).data;
    const meB = (await api('/api/me', { token: b.token })).data;
    assert.deepEqual([meA.rating, meA.wins, meA.losses], [1516, 1, 0]);
    assert.deepEqual([meB.rating, meB.wins, meB.losses], [1484, 0, 1]);

    const board = (await api('/api/leaderboard')).data.players;
    const ia = board.findIndex(p => p.playerId === a.playerId), ib = board.findIndex(p => p.playerId === b.playerId);
    assert.ok(ia >= 0 && ib >= 0 && ia < ib);
});

test('カジュアル戦: レートは変わらない', async () => {
    const a = await register('CasA'), b = await register('CasB');
    const { sa, sb } = await pairUp(a, b, 'casual', ['ASSASSIN', 'ASSASSIN']);
    sa.send({ t: 'forfeit' });
    const [endA, endB] = await Promise.all([sa.next('end'), sb.next('end')]);
    assert.equal(endA.result, 'LOSE');
    assert.equal(endB.result, 'WIN');
    assert.equal(endA.reason, 'forfeit');
    assert.equal(endA.rating, null);
    const me = (await api('/api/me', { token: a.token })).data;
    assert.deepEqual([me.rating, me.wins, me.losses], [1500, 0, 0]);
});

test('時間切れは自動でCHARGEになり、連続すると負け', async () => {
    const a = await register('SlowA'), b = await register('FastB');
    const { sa, sb } = await pairUp(a, b, 'ranked', ['TANK', 'TANK']);
    sb.send({ t: 'move', turn: 1, move: 'GUARD' });
    const t1 = await sa.next('turn');
    assert.deepEqual([t1.you, t1.auto, t1.opp], ['CHARGE', true, 'GUARD']);
    sb.send({ t: 'move', turn: 2, move: 'GUARD' });
    const [endA, endB] = await Promise.all([sa.next('end'), sb.next('end')]);
    assert.equal(endA.reason, 'timeout');
    assert.equal(endA.result, 'LOSE');
    assert.equal(endB.result, 'WIN');
});

test('切断しても猶予内に戻れば続行でき、局面を取り戻せる', async () => {
    const a = await register('ReA'), b = await register('ReB');
    const { matchId, sa, sb } = await pairUp(a, b, 'casual');
    await playTurn(sa, sb, 1, 'CHARGE', 'CHARGE');
    sa.close();
    const disc = await sb.next('opp_disconnected');
    assert.ok(disc.graceMs > 0);

    const sa2 = open(matchUrl(a, matchId));
    const sync = await sa2.next('sync');
    assert.equal(sync.turn, 2);
    assert.deepEqual(sync.state.map(s => s.energy), [1, 1]);
    assert.equal(sync.last.turn, 1);
    await sb.next('opp_reconnected');

    const [t2] = await playTurn(sa2, sb, 2, 'ATTACK', 'CHARGE');
    assert.equal(t2.you, 'ATTACK');
    sa2.send({ t: 'forfeit' });
    await sb.next('end');
});

test('切断したまま猶予を過ぎると負け', async () => {
    const a = await register('GoneA'), b = await register('StayB');
    const { sa, sb } = await pairUp(a, b, 'ranked');
    sa.close();
    await sb.next('opp_disconnected');
    const end = await sb.next('end');
    assert.equal(end.result, 'WIN');
    assert.equal(end.reason, 'disconnect');
    assert.equal(end.rating.after, 1516);
    assert.equal((await api('/api/me', { token: a.token })).data.losses, 1);
});

test('相手が入室しなければ無効試合', async () => {
    const a = await register('ShowA'), b = await register('NoShowB');
    const qa = open(queueUrl(a, 'ranked', 'NORMAL'));
    await qa.next('queued');
    const qb = open(queueUrl(b, 'ranked', 'NORMAL'));
    const [ma] = await Promise.all([qa.next('matched'), qb.next('matched')]);
    const sa = open(matchUrl(a, ma.matchId));
    const end = await sa.next('end');
    assert.equal(end.result, 'VOID');
    assert.equal(end.reason, 'no_show');
    assert.equal((await api('/api/me', { token: a.token })).data.rating, 1500);
});

test('待機をキャンセルした人とは組まれない / 同じ人の二重待機は古いほうが外れる', async () => {
    const a = await register('CancelA'), b = await register('B2'), c = await register('C2');
    const qa = open(queueUrl(a, 'casual', 'NORMAL'));
    await qa.next('queued');
    qa.send({ t: 'cancel' });
    await new Promise(r => setTimeout(r, 300));

    const qb1 = open(queueUrl(b, 'casual', 'NORMAL'));
    await qb1.next('queued');
    const qb2 = open(queueUrl(b, 'casual', 'NORMAL'));
    await qb2.next('queued');
    assert.equal((await qb1.next('error')).code, 'replaced');

    const qc = open(queueUrl(c, 'casual', 'NORMAL'));
    const [mb, mc] = await Promise.all([qb2.next('matched'), qc.next('matched')]);
    assert.equal(mb.matchId, mc.matchId);
});

test('他人の試合には入れない', async () => {
    const a = await register('InA'), b = await register('InB'), x = await register('Outsider');
    const { matchId, sa } = await pairUp(a, b, 'casual');
    assert.equal((await open(matchUrl(x, matchId)).next('error')).code, 'match_not_found');
    sa.send({ t: 'forfeit' });
});

let failed = 0;
for (const { name, fn } of tests) {
    try {
        await fn();
        console.log(`  ok   ${name}`);
    } catch (err) {
        failed++;
        console.log(`  FAIL ${name}\n       ${err.stack}`);
    }
}
console.log(failed ? `\n${failed} / ${tests.length} failed` : `\nall ${tests.length} passed`);
process.exit(failed ? 1 : 0);
