/**
 * サーバー経由の対戦（ランダムマッチ / レート戦）の通信。
 *
 *   queue()  → 待機列に並ぶ → 相手が見つかると対戦部屋へ自動で入室
 *   対戦中は手をサーバーに送り、両者の手が揃うと結果が返ってくる（判定はサーバー）
 *   通信が切れたら猶予時間内は自動で再接続する
 *
 * 画面側へは handlers のコールバックで通知する:
 *   onQueued() / onMatched() / onStart(info) / onResync(info) / onOpponentReady()
 *   onTurn({ turn, you, opp, auto }) / onEnd({ result, reason, rating })
 *   onOpponentDisconnected(graceMs) / onOpponentReconnected()
 *   onConnectionLost() / onConnectionRestored() / onError(code) / onFatal(code)
 */
import { PROTOCOL_VERSION, TIMING } from './protocol.js';
import { wsUrl } from './config.js';

const PING_MS = 20000;
const RECONNECT_DELAY_MS = 1500;

export class ServerSession {
    constructor(token, handlers) {
        this.token = token;
        this.h = handlers;
        this.ws = null;
        this.phase = 'idle'; // idle → queue → joining → playing → ended / closed
        this.matchId = null;
        this.turn = 0;
        this.myMove = null;
        this.pingTimer = null;
        this.reconnectTimer = null;
        this.reconnectUntil = 0;
    }

    emit(name, ...args) {
        const fn = this.h[name];
        if (fn) fn(...args);
    }

    // --- 待機列 ---

    queue(mode, charId) {
        this.phase = 'queue';
        const q = `v=${PROTOCOL_VERSION}&token=${this.token}&mode=${encodeURIComponent(mode)}&char=${encodeURIComponent(charId)}`;
        const ws = this.open(wsUrl(`/ws/queue?${q}`));
        ws.onmessage = (e) => {
            const msg = this.parse(e.data);
            if (!msg || this.ws !== ws) return;
            if (msg.t === 'queued') this.emit('onQueued');
            else if (msg.t === 'matched') {
                this.matchId = msg.matchId;
                this.phase = 'joining';
                this.emit('onMatched');
                this.detach();
                this.connectMatch();
            } else if (msg.t === 'error') this.fatal(msg.code);
        };
        ws.onclose = () => {
            if (this.ws === ws && this.phase === 'queue') this.fatal('connection_lost');
        };
    }

    // --- 対戦部屋 ---

    connectMatch() {
        const ws = this.open(wsUrl(`/ws/match/${this.matchId}?v=${PROTOCOL_VERSION}&token=${this.token}`));
        ws.onopen = () => {
            if (this.ws !== ws) return;
            if (this.reconnectUntil) {
                this.reconnectUntil = 0;
                this.emit('onConnectionRestored');
            }
        };
        ws.onmessage = (e) => {
            const msg = this.parse(e.data);
            if (msg && this.ws === ws) this.onMatchMessage(msg);
        };
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.stopPing();
            if (this.phase === 'joining' || this.phase === 'playing') this.scheduleReconnect();
        };
    }

    onMatchMessage(msg) {
        switch (msg.t) {
            case 'start':
                this.phase = 'playing';
                this.turn = msg.turn;
                this.myMove = null;
                this.emit('onStart', msg);
                break;
            case 'sync':
                this.onSync(msg);
                break;
            case 'opp_ready':
                this.emit('onOpponentReady');
                break;
            case 'turn':
                this.applyTurn(msg);
                break;
            case 'opp_disconnected':
                this.emit('onOpponentDisconnected', msg.graceMs);
                break;
            case 'opp_reconnected':
                this.emit('onOpponentReconnected');
                break;
            case 'end':
                this.phase = 'ended';
                this.detach();
                this.emit('onEnd', msg);
                break;
            case 'error':
                if (msg.code === 'illegal_move') {
                    this.myMove = null;
                    this.emit('onError', msg.code);
                } else {
                    this.fatal(msg.code);
                }
                break;
        }
    }

    applyTurn(msg) {
        if (msg.turn !== this.turn) return; // 既に処理済み
        this.turn += 1;
        this.myMove = null;
        this.emit('onTurn', { turn: msg.turn, you: msg.you, opp: msg.opp, auto: !!msg.auto });
    }

    // 再接続直後に届く現在の局面。手元とのずれを埋める
    onSync(msg) {
        if (this.phase === 'joining') {
            // 開始の通知を受け取る前に切れていた
            this.phase = 'playing';
            this.turn = msg.turn;
            this.emit('onStart', msg);
            return;
        }
        if (msg.turn === this.turn) {
            // 同じターン。送ったはずの手が届いていなければ送り直す
            if (this.myMove && !msg.committed) this.send({ t: 'move', turn: this.turn, move: this.myMove });
            if (msg.oppCommitted) this.emit('onOpponentReady');
        } else if (msg.last && msg.last.turn === this.turn && msg.turn === this.turn + 1) {
            // 切れている間に1ターン進んでいた → その結果を再生する
            this.applyTurn(msg.last);
        } else {
            // それ以上ずれていたら局面ごと取り直す
            this.turn = msg.turn;
            this.myMove = null;
            this.emit('onResync', msg);
        }
    }

    submitMove(move) {
        if (this.phase !== 'playing') return;
        this.myMove = move;
        this.send({ t: 'move', turn: this.turn, move });
    }

    // 降参して終了する（結果は onEnd で届く）
    forfeit() {
        if (this.phase === 'playing') this.send({ t: 'forfeit' });
    }

    // 待機のキャンセル・対戦からの離脱。対戦中なら降参扱い
    leave() {
        if (this.phase === 'queue') this.send({ t: 'cancel' });
        else if (this.phase === 'playing') this.send({ t: 'forfeit' });
        this.phase = 'closed';
        clearTimeout(this.reconnectTimer);
        this.detach();
    }

    // --- 接続まわり ---

    open(url) {
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.addEventListener('open', () => {
            if (this.ws !== ws) return;
            this.stopPing();
            this.pingTimer = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, PING_MS);
        });
        return ws;
    }

    parse(data) {
        if (data === 'pong') return null;
        try { return JSON.parse(data); } catch { return null; }
    }

    send(msg) {
        if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
    }

    stopPing() {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
    }

    // 今の接続を手放す（以降この接続からのイベントは無視される）
    detach() {
        this.stopPing();
        const ws = this.ws;
        this.ws = null;
        if (ws) { try { ws.close(); } catch { /* 既に閉じている */ } }
    }

    scheduleReconnect() {
        const now = Date.now();
        if (!this.reconnectUntil) {
            this.reconnectUntil = now + TIMING.DISCONNECT_GRACE_MS;
            this.emit('onConnectionLost');
        }
        if (now >= this.reconnectUntil) return this.fatal('connection_lost');
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (this.phase === 'joining' || this.phase === 'playing') this.connectMatch();
        }, RECONNECT_DELAY_MS);
    }

    fatal(code) {
        if (this.phase === 'closed' || this.phase === 'ended') return;
        const wasPlaying = this.phase === 'playing';
        this.phase = 'closed';
        clearTimeout(this.reconnectTimer);
        this.detach();
        this.emit('onFatal', code, wasPlaying);
    }
}
