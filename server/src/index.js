/**
 * GG Demon オンライン対戦サーバー（Cloudflare Workers）
 *
 *  Worker 本体   : HTTP API（登録・プロフィール・ランキング）と WebSocket の入口。トークン認証を行う
 *  Matchmaker    : 待機列を1つだけ持つ Durable Object。相手を見つけて対戦部屋を作る
 *  MatchRoom     : 1試合につき1つの Durable Object。両者の手を受け取り、判定して結果を配る
 *  D1 (SQLite)   : プレイヤー・レート・対戦履歴
 *
 * 判定ロジックはクライアントと同じ js/online/pvp.js を使う。
 */
import { DurableObject } from 'cloudflare:workers';
import { PROTOCOL_VERSION, MATCH_MODES, TIMING, RESULTS, END_REASONS, sanitizeName, randomGuestName } from '../../js/online/protocol.js';
import { createMatch, resolveTurn, isLegalMove, defaultMove, isPvpCharId, viewFor } from '../../js/online/pvp.js';
import { findPairs, needsRetry } from '../../js/online/matchmaking.js';
import { INITIAL_RATING, updateRatings } from '../../js/online/rating.js';
import { sha256Hex, randomHex } from '../../js/online/commit.js';

const QUEUE_RETRY_MS = 2000;   // レート差の許容幅が広がるのを待って再判定する間隔
const CLEANUP_MS = 60000;      // 試合終了後、部屋のデータを消すまでの時間
const WS_OPEN = 1;

// 時間設定。環境変数（TURN_MS など）で上書きできる（主に自動テスト用）
function timing(env) {
    const pick = key => {
        const v = Number(env[key]);
        return Number.isFinite(v) && v > 0 ? v : TIMING[key];
    };
    return {
        TURN_MS: pick('TURN_MS'),
        ANIM_GRACE_MS: pick('ANIM_GRACE_MS'),
        CONNECT_MS: pick('CONNECT_MS'),
        DISCONNECT_GRACE_MS: pick('DISCONNECT_GRACE_MS'),
        MAX_TIMEOUTS: pick('MAX_TIMEOUTS')
    };
}

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

function corsHeaders(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin');
    let allow = '*';
    if (!allowed.includes('*')) allow = (origin && allowed.includes(origin)) ? origin : allowed[0];
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
}

function originAllowed(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
    if (allowed.includes('*')) return true;
    const origin = request.headers.get('Origin');
    return !!origin && allowed.includes(origin);
}

function json(request, env, body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) }
    });
}

function send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* 既に閉じている */ }
}

function closeQuietly(ws, code = 1000, reason = '') {
    try { ws.close(code, reason); } catch { /* 既に閉じている */ }
}

// WebSocket の接続要求を「エラーを1通送って閉じる」形で断る。
// HTTPエラーで断るとブラウザ側で理由が分からないため。
function rejectSocket(code) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    send(server, { t: 'error', code });
    closeQuietly(server, 4001, code);
    return new Response(null, { status: 101, webSocket: client });
}

function getToken(request, url) {
    const auth = request.headers.get('Authorization') || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return url.searchParams.get('token') || '';
}

async function authenticate(request, url, env) {
    const token = getToken(request, url);
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const hash = await sha256Hex(token);
    return env.DB
        .prepare('SELECT id, name, rating, wins, losses, draws FROM players WHERE token_hash = ?')
        .bind(hash).first();
}

async function withRank(env, player) {
    const games = player.wins + player.losses + player.draws;
    let rank = null;
    if (games > 0) {
        const row = await env.DB
            .prepare('SELECT COUNT(*) AS n FROM players WHERE rating > ? AND (wins + losses + draws) > 0')
            .bind(player.rating).first();
        rank = (row?.n ?? 0) + 1;
    }
    return { playerId: player.id, name: player.name, rating: player.rating, wins: player.wins, losses: player.losses, draws: player.draws, rank };
}

// ---------------------------------------------------------------------------
// Worker 本体
// ---------------------------------------------------------------------------

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(request, env) });
        }

        try {
            if (path === '/api/health') {
                return json(request, env, { ok: true, protocol: PROTOCOL_VERSION });
            }

            if (path === '/api/register' && request.method === 'POST') {
                const body = await request.json().catch(() => ({}));
                const name = sanitizeName(body.name) || randomGuestName();
                const id = crypto.randomUUID();
                const token = randomHex(32);
                const now = Date.now();
                await env.DB
                    .prepare('INSERT INTO players (id, token_hash, name, rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                    .bind(id, await sha256Hex(token), name, INITIAL_RATING, now, now).run();
                // トークンはここで一度だけ返す（サーバーにはハッシュしか残さない）
                return json(request, env, { playerId: id, token, name, rating: INITIAL_RATING, wins: 0, losses: 0, draws: 0, rank: null });
            }

            if (path === '/api/me' && request.method === 'GET') {
                const player = await authenticate(request, url, env);
                if (!player) return json(request, env, { error: 'unauthorized' }, 401);
                return json(request, env, await withRank(env, player));
            }

            if (path === '/api/name' && request.method === 'POST') {
                const player = await authenticate(request, url, env);
                if (!player) return json(request, env, { error: 'unauthorized' }, 401);
                const body = await request.json().catch(() => ({}));
                const name = sanitizeName(body.name);
                if (!name) return json(request, env, { error: 'invalid_name' }, 400);
                await env.DB.prepare('UPDATE players SET name = ?, updated_at = ? WHERE id = ?')
                    .bind(name, Date.now(), player.id).run();
                return json(request, env, await withRank(env, { ...player, name }));
            }

            if (path === '/api/leaderboard' && request.method === 'GET') {
                const { results } = await env.DB
                    .prepare('SELECT id, name, rating, wins, losses, draws FROM players WHERE (wins + losses + draws) > 0 ORDER BY rating DESC, updated_at ASC LIMIT 50')
                    .all();
                return json(request, env, {
                    players: results.map((p, i) => ({ rank: i + 1, playerId: p.id, name: p.name, rating: p.rating, wins: p.wins, losses: p.losses, draws: p.draws }))
                });
            }

            if (path === '/ws/queue' || path.startsWith('/ws/match/')) {
                if (request.headers.get('Upgrade') !== 'websocket') {
                    return json(request, env, { error: 'websocket_required' }, 426);
                }
                if (!originAllowed(request, env)) return rejectSocket('forbidden_origin');
                if (Number(url.searchParams.get('v')) !== PROTOCOL_VERSION) return rejectSocket('version_mismatch');

                const player = await authenticate(request, url, env);
                if (!player) return rejectSocket('unauthorized');

                // Durable Object には検証済みのプレイヤー情報だけを渡す（トークンは渡さない）
                const headers = new Headers(request.headers);
                headers.set('x-gg-player', encodeURIComponent(JSON.stringify({ id: player.id, name: player.name, rating: player.rating })));

                if (path === '/ws/queue') {
                    const mode = url.searchParams.get('mode');
                    const charId = url.searchParams.get('char');
                    if (mode !== MATCH_MODES.RANKED && mode !== MATCH_MODES.CASUAL) return rejectSocket('invalid_mode');
                    if (!isPvpCharId(charId)) return rejectSocket('invalid_character');
                    const stub = env.MATCHMAKER.get(env.MATCHMAKER.idFromName('global'));
                    return stub.fetch(new Request(`https://do/queue?mode=${mode}&char=${charId}`, { headers }));
                }

                const matchId = path.slice('/ws/match/'.length);
                if (!/^[0-9a-f-]{36}$/.test(matchId)) return rejectSocket('match_not_found');
                const stub = env.MATCH_ROOM.get(env.MATCH_ROOM.idFromName(matchId));
                return stub.fetch(new Request('https://do/join', { headers }));
            }

            return json(request, env, { error: 'not_found' }, 404);
        } catch (err) {
            console.error('request failed', err);
            return json(request, env, { error: 'internal_error' }, 500);
        }
    }
};

function playerFromHeader(request) {
    return JSON.parse(decodeURIComponent(request.headers.get('x-gg-player')));
}

// ---------------------------------------------------------------------------
// Matchmaker: 待機列
// 待機者の情報は各 WebSocket に付けた attachment に持たせる（休止しても消えない）。
// ---------------------------------------------------------------------------

export class Matchmaker extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        // 生存確認の ping は Durable Object を起こさずに自動応答する
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    }

    async fetch(request) {
        const url = new URL(request.url);
        const player = playerFromHeader(request);

        // 同じプレイヤーが別タブなどで待機していたら、古いほうを外す
        for (const ws of this.ctx.getWebSockets()) {
            const a = ws.deserializeAttachment();
            if (a && !a.done && a.playerId === player.id) {
                ws.serializeAttachment({ ...a, done: true });
                send(ws, { t: 'error', code: 'replaced' });
                closeQuietly(ws, 4000, 'replaced');
            }
        }

        const [client, server] = Object.values(new WebSocketPair());
        this.ctx.acceptWebSocket(server);
        const mode = url.searchParams.get('mode');
        server.serializeAttachment({
            key: crypto.randomUUID(),
            playerId: player.id,
            name: player.name,
            rating: player.rating,
            mode,
            charId: url.searchParams.get('char'),
            joinedAt: Date.now(),
            done: false
        });
        send(server, { t: 'queued', mode, rating: player.rating });

        await this.tryMatch();
        return new Response(null, { status: 101, webSocket: client });
    }

    waiting() {
        const list = [];
        for (const ws of this.ctx.getWebSockets()) {
            if (ws.readyState !== WS_OPEN) continue;
            const a = ws.deserializeAttachment();
            if (a && !a.done) list.push({ ...a, ws });
        }
        return list;
    }

    async tryMatch() {
        const entries = this.waiting();
        const pairs = findPairs(entries, Date.now());

        // 部屋を作る await の間に別の参加が割り込んでも二重に組まないよう、先に印を付ける
        for (const e of pairs.flat()) e.ws.serializeAttachment({ ...e.ws.deserializeAttachment(), done: true });

        if (needsRetry(entries, pairs)) {
            if ((await this.ctx.storage.getAlarm()) === null) {
                await this.ctx.storage.setAlarm(Date.now() + QUEUE_RETRY_MS);
            }
        }

        for (const [a, b] of pairs) {
            const matchId = crypto.randomUUID();
            try {
                const room = this.env.MATCH_ROOM.get(this.env.MATCH_ROOM.idFromName(matchId));
                const res = await room.fetch(new Request('https://do/init', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: matchId,
                        mode: a.mode,
                        players: [a, b].map(e => ({ id: e.playerId, name: e.name, rating: e.rating, charId: e.charId }))
                    })
                }));
                if (!res.ok) throw new Error(`init failed: ${res.status}`);
                for (const e of [a, b]) {
                    send(e.ws, { t: 'matched', matchId });
                    closeQuietly(e.ws, 1000, 'matched');
                }
            } catch (err) {
                console.error('failed to create match', err);
                for (const e of [a, b]) {
                    send(e.ws, { t: 'error', code: 'match_create_failed' });
                    closeQuietly(e.ws, 1011, 'match_create_failed');
                }
            }
        }
    }

    async alarm() {
        await this.tryMatch();
    }

    async webSocketMessage(ws, message) {
        let msg;
        try { msg = JSON.parse(message); } catch { return; }
        if (msg?.t === 'cancel') {
            const a = ws.deserializeAttachment();
            if (a) ws.serializeAttachment({ ...a, done: true });
            closeQuietly(ws, 1000, 'cancelled');
        }
    }

    async webSocketClose(ws, code) {
        const a = ws.deserializeAttachment();
        if (a) ws.serializeAttachment({ ...a, done: true });
        closeQuietly(ws, code === 1005 || code === 1006 ? 1000 : code);
    }

    async webSocketError(ws) {
        closeQuietly(ws, 1011);
    }
}

// ---------------------------------------------------------------------------
// MatchRoom: 1試合ぶんの部屋
// 状態は storage に保存する（休止・再起動しても続きから再開できる）。
// ---------------------------------------------------------------------------

export class MatchRoom extends DurableObject {
    constructor(ctx, env) {
        super(ctx, env);
        ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
        this.timing = timing(env);
    }

    load() { return this.ctx.storage.get('m'); }
    save(m) { return this.ctx.storage.put('m', m); }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/init') {
            const body = await request.json();
            const now = Date.now();
            const m = {
                id: body.id,
                mode: body.mode,
                players: body.players,
                match: createMatch(body.players.map(p => p.charId)),
                phase: 'waiting',          // waiting → playing → ended
                pending: [null, null],     // 今のターンに受け取った手
                timeouts: [0, 0],          // 連続時間切れ回数
                discAt: [null, null],      // 切断した時刻
                last: null,                // 直前のターン結果（再接続時の追いつき用）
                deadline: now + this.timing.CONNECT_MS,
                result: null,
                createdAt: now
            };
            await this.save(m);
            await this.ctx.storage.setAlarm(m.deadline);
            return new Response('{"ok":true}');
        }

        // --- WebSocket 入室 ---
        const player = playerFromHeader(request);
        const m = await this.load();
        const side = m ? m.players.findIndex(p => p.id === player.id) : -1;
        if (!m || side < 0) return rejectSocket('match_not_found');

        const [client, server] = Object.values(new WebSocketPair());

        if (m.phase === 'ended') {
            // 終了済みの試合に戻ってきた場合は結果だけ伝える
            server.accept();
            send(server, this.endMessage(m, side));
            closeQuietly(server, 1000, 'ended');
            return new Response(null, { status: 101, webSocket: client });
        }

        // 同じ側の古い接続は外す（再接続・別タブ）
        for (const ws of this.ctx.getWebSockets(String(side))) {
            ws.serializeAttachment({ side, gone: true });
            closeQuietly(ws, 4000, 'replaced');
        }
        this.ctx.acceptWebSocket(server, [String(side)]);
        server.serializeAttachment({ side, gone: false });

        const wasDisconnected = m.discAt[side] !== null;
        m.discAt[side] = null;

        if (m.phase === 'waiting') {
            if (this.isConnected(1 - side)) {
                m.phase = 'playing';
                m.deadline = Date.now() + this.timing.TURN_MS + this.timing.ANIM_GRACE_MS;
                this.broadcast(s => this.stateMessage(m, s, 'start'));
            }
        } else {
            send(server, this.stateMessage(m, side, 'sync'));
            if (wasDisconnected) this.sendTo(1 - side, { t: 'opp_reconnected' });
        }

        await this.save(m);
        await this.schedule(m);
        return new Response(null, { status: 101, webSocket: client });
    }

    // --- 送信まわり ---

    sockets(side, except = null) {
        return this.ctx.getWebSockets(String(side)).filter(ws =>
            ws !== except && ws.readyState === WS_OPEN && !ws.deserializeAttachment()?.gone);
    }

    isConnected(side, except = null) {
        return this.sockets(side, except).length > 0;
    }

    sendTo(side, msg) {
        for (const ws of this.sockets(side)) send(ws, msg);
    }

    broadcast(build) {
        for (const side of [0, 1]) this.sendTo(side, build(side));
    }

    stateMessage(m, side, type) {
        const pub = p => ({ name: p.name, rating: p.rating, charId: p.charId });
        return {
            t: type,
            matchId: m.id,
            mode: m.mode,
            turn: m.match.turn,
            turnMs: this.timing.TURN_MS,
            remainingMs: Math.max(0, m.deadline - this.timing.ANIM_GRACE_MS - Date.now()),
            you: pub(m.players[side]),
            opp: pub(m.players[1 - side]),
            state: viewFor(m.match, side),
            committed: m.pending[side] !== null,
            oppCommitted: m.pending[1 - side] !== null,
            last: m.last ? this.turnMessage(m.last, side) : null
        };
    }

    turnMessage(last, side) {
        return { t: 'turn', turn: last.turn, you: last.moves[side], opp: last.moves[1 - side], auto: !!last.auto[side] };
    }

    endMessage(m, side) {
        const r = m.result;
        let result = RESULTS.VOID;
        if (r.winner === -1) result = RESULTS.DRAW;
        else if (r.winner === 0 || r.winner === 1) result = r.winner === side ? RESULTS.WIN : RESULTS.LOSE;
        return {
            t: 'end',
            result,
            reason: r.reason,
            mode: m.mode,
            rating: r.ratings ? { before: r.ratings[side].before, after: r.ratings[side].after } : null
        };
    }

    // --- 受信 ---

    async webSocketMessage(ws, message) {
        const att = ws.deserializeAttachment();
        if (!att || att.gone) return;
        let msg;
        try { msg = JSON.parse(message); } catch { return; }
        if (!msg || typeof msg.t !== 'string') return;

        const m = await this.load();
        if (!m || m.phase !== 'playing') return;
        const side = att.side;

        if (msg.t === 'move') {
            // 古いターン宛て・二重送信は無視
            if (msg.turn !== m.match.turn || m.pending[side] !== null) return;
            if (!isLegalMove(m.match, side, msg.move)) {
                send(ws, { t: 'error', code: 'illegal_move' });
                return;
            }
            m.pending[side] = msg.move;
            m.timeouts[side] = 0;
            if (m.pending[1 - side] !== null) {
                await this.resolve(m, [false, false]);
            } else {
                this.sendTo(1 - side, { t: 'opp_ready' });
                await this.save(m);
            }
        } else if (msg.t === 'forfeit') {
            await this.finish(m, 1 - side, END_REASONS.FORFEIT);
        }
    }

    async webSocketClose(ws, code) {
        closeQuietly(ws, code === 1005 || code === 1006 ? 1000 : code);
        const att = ws.deserializeAttachment();
        if (!att || att.gone) return;
        const m = await this.load();
        if (!m || m.phase !== 'playing') return;
        if (this.isConnected(att.side, ws)) return; // 別の接続が生きている

        m.discAt[att.side] = Date.now();
        this.sendTo(1 - att.side, { t: 'opp_disconnected', graceMs: this.timing.DISCONNECT_GRACE_MS });
        await this.save(m);
        await this.schedule(m);
    }

    async webSocketError(ws) {
        await this.webSocketClose(ws, 1011);
    }

    // --- 進行 ---

    async resolve(m, auto) {
        const out = resolveTurn(m.match, m.pending);
        m.last = { turn: out.turn, moves: out.moves, auto };
        m.pending = [null, null];
        this.broadcast(side => this.turnMessage(m.last, side));

        if (out.outcome) {
            await this.finish(m, out.outcome.winner, out.outcome.reason);
        } else {
            m.deadline = Date.now() + this.timing.TURN_MS + this.timing.ANIM_GRACE_MS;
            await this.save(m);
            await this.schedule(m);
        }
    }

    async schedule(m) {
        if (m.phase === 'ended') return;
        let at = m.deadline;
        for (const d of m.discAt) {
            if (d !== null) at = Math.min(at, d + this.timing.DISCONNECT_GRACE_MS);
        }
        await this.ctx.storage.setAlarm(Math.max(at, Date.now() + 50));
    }

    async alarm() {
        const m = await this.load();
        if (!m) return;
        if (m.phase === 'ended') {
            // 終了からしばらく経ったので部屋を片付ける
            await this.ctx.storage.deleteAll();
            return;
        }
        const now = Date.now();

        if (m.phase === 'waiting') {
            if (now < m.deadline) return this.schedule(m);
            // どちらかが入室しなかった → 無効試合（レート変動なし）
            return this.finish(m, null, END_REASONS.NO_SHOW);
        }

        // 切断したまま猶予を過ぎた側は負け
        const gone = m.discAt.map(d => d !== null && now >= d + this.timing.DISCONNECT_GRACE_MS);
        if (gone[0] || gone[1]) {
            const winner = gone[0] && gone[1] ? -1 : (gone[0] ? 1 : 0);
            return this.finish(m, winner, END_REASONS.DISCONNECT);
        }

        if (now >= m.deadline) {
            // 時間切れ: 手を出していない側は自動で行動する。連続すると負け
            const auto = m.pending.map(p => p === null);
            for (const side of [0, 1]) {
                if (auto[side]) {
                    m.timeouts[side] += 1;
                    m.pending[side] = defaultMove(m.match, side);
                }
            }
            const out = m.timeouts.map(n => n >= this.timing.MAX_TIMEOUTS);
            if (out[0] || out[1]) {
                const winner = out[0] && out[1] ? -1 : (out[0] ? 1 : 0);
                return this.finish(m, winner, END_REASONS.TIMEOUT);
            }
            return this.resolve(m, auto);
        }

        return this.schedule(m);
    }

    /**
     * 試合を終わらせる。winner: 0 | 1 | -1(引き分け) | null(無効試合)
     */
    async finish(m, winner, reason) {
        if (m.phase === 'ended') return;
        // D1 への書き込みを待つ間に別のイベントが来ても二重に確定しないよう、先に終了状態を保存する
        m.phase = 'ended';
        m.result = { winner, reason, ratings: null };
        await this.save(m);

        if (winner !== null) {
            try {
                m.result.ratings = await this.record(m, winner, reason);
                await this.save(m);
            } catch (err) {
                console.error('failed to record match', err);
            }
        }

        for (const side of [0, 1]) {
            const msg = this.endMessage(m, side);
            for (const ws of this.sockets(side)) {
                send(ws, msg);
                ws.serializeAttachment({ side, gone: true });
                closeQuietly(ws, 1000, 'ended');
            }
        }
        await this.ctx.storage.setAlarm(Date.now() + CLEANUP_MS);
    }

    // 対戦履歴を残し、レート戦ならレートと戦績を更新する
    async record(m, winner, reason) {
        const db = this.env.DB;
        const [p1, p2] = m.players;
        const now = Date.now();
        const rated = m.mode === MATCH_MODES.RANKED;
        const turns = m.last ? m.last.turn : 0;

        if (!rated) {
            await db.prepare(
                'INSERT INTO matches (id, mode, p1, p2, char1, char2, winner, reason, turns, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(m.id, m.mode, p1.id, p2.id, p1.charId, p2.charId, winner, reason, turns, now).run();
            return null;
        }

        // 待機中に別の試合でレートが変わっている可能性があるので、最新値を読み直す
        const { results } = await db.prepare('SELECT id, rating FROM players WHERE id IN (?, ?)').bind(p1.id, p2.id).all();
        const current = id => results.find(r => r.id === id)?.rating ?? INITIAL_RATING;
        const before = [current(p1.id), current(p2.id)];
        const score = winner === -1 ? 0.5 : (winner === 0 ? 1 : 0);
        const after = updateRatings(before[0], before[1], score);

        const upd = 'UPDATE players SET rating = ?, wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = ? WHERE id = ?';
        const flags = side => [winner === side ? 1 : 0, (winner !== -1 && winner !== side) ? 1 : 0, winner === -1 ? 1 : 0];
        await db.batch([
            db.prepare(upd).bind(after[0], ...flags(0), now, p1.id),
            db.prepare(upd).bind(after[1], ...flags(1), now, p2.id),
            db.prepare(
                'INSERT INTO matches (id, mode, p1, p2, char1, char2, winner, reason, turns, r1_before, r1_after, r2_before, r2_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(m.id, m.mode, p1.id, p2.id, p1.charId, p2.charId, winner, reason, turns, before[0], after[0], before[1], after[1], now)
        ]);

        return [0, 1].map(i => ({ before: before[i], after: after[i] }));
    }
}
