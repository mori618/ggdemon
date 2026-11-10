/**
 * フレンド戦（P2P）の通信。サーバーを介さず、ブラウザ同士を WebRTC で直接つなぐ。
 * 接続の仲介（シグナリング）には PeerJS の公開サーバーを使う。
 *
 * 判定役のサーバーがいないので、後出しを防ぐためにキャラクター選択と毎ターンの手は
 * 「コミット＆リビール」で交換する（commit.js 参照）。局面は両者が同じエンジン（pvp.js）で
 * それぞれ計算し、食い違いがないか毎ターン照合する。
 *
 * 画面側へは handlers のコールバックで通知する:
 *   onRoomReady(code) / onPeerConnected({ name }) / onPickCharacter()
 *   onStart(info) / onOpponentReady() / onTurn({ turn, you, opp })
 *   onRematchRequested() / onPeerLeft() / onFatal(code)
 */
import { PROTOCOL_VERSION, MATCH_MODES, sanitizeName } from './protocol.js';
import { createMatch, resolveTurn, isLegalMove, isPvpCharId, PVP_MOVES } from './pvp.js';
import { makeCommit, verifyCommit } from './commit.js';

const PEER_PREFIX = 'ggdemon-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字（I, O, 0, 1）を除く
const CODE_LENGTH = 6;
const CONNECT_TIMEOUT_MS = 15000;
const ICE_LOST_MS = 8000;

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
];

export function generateRoomCode() {
    const bytes = new Uint8Array(CODE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export function normalizeRoomCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return code.length === CODE_LENGTH ? code : null;
}

export class P2PSession {
    /**
     * PeerClass: PeerJS の Peer（テスト時は差し替えられる）
     */
    constructor(myName, handlers, PeerClass = globalThis.Peer) {
        this.myName = myName;
        this.h = handlers;
        this.PeerClass = PeerClass;
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.closed = false;
        this.oppName = 'Opponent';
        this.helloDone = false;
        this.connectTimer = null;
        this.iceTimer = null;
        this.round = 0;
        this.resetRound();
    }

    emit(name, ...args) {
        const fn = this.h[name];
        if (fn) fn(...args);
    }

    resetRound() {
        this.match = null;
        this.playing = false;
        this.char = { mine: null, myCommit: null, sentReveal: false, theirHash: null, theirs: null };
        this.rematch = { mine: false, theirs: false };
        this.resetTurn();
    }

    resetTurn() {
        this.move = { mine: null, myCommit: null, sentReveal: false, theirHash: null, theirs: null };
    }

    // --- 接続 ---

    createPeer(id) {
        if (!this.PeerClass) throw new Error('peerjs_unavailable');
        const peer = new this.PeerClass(id, { debug: 0, config: { iceServers: ICE_SERVERS } });
        this.peer = peer;
        peer.on('error', (err) => {
            if (this.closed) return;
            const type = err && err.type;
            if (type === 'unavailable-id' && this.isHost && !this.conn) {
                // 部屋コードが偶然かぶった → 別のコードで作り直す
                peer.destroy();
                this.host();
            } else if (type === 'peer-unavailable') {
                this.fatal('room_not_found');
            } else if (!this.helloDone) {
                this.fatal('connect_failed');
            }
            // 対戦開始後のシグナリングサーバーのエラーは、相手との直接接続には影響しないので無視する
        });
        return peer;
    }

    // 部屋を作って相手を待つ
    host() {
        this.isHost = true;
        const code = generateRoomCode();
        const peer = this.createPeer(PEER_PREFIX + code);
        peer.on('open', () => { if (!this.closed && this.peer === peer) this.emit('onRoomReady', code); });
        peer.on('connection', (conn) => {
            if (this.conn) { conn.close(); return; } // 3人目は入れない
            this.attach(conn);
        });
    }

    // 部屋コードを指定して入る
    join(code) {
        this.isHost = false;
        const peer = this.createPeer(undefined);
        peer.on('open', () => {
            if (this.closed) return;
            this.attach(peer.connect(PEER_PREFIX + code, { reliable: true }));
        });
        this.connectTimer = setTimeout(() => {
            if (!this.helloDone) this.fatal('connect_failed');
        }, CONNECT_TIMEOUT_MS);
    }

    attach(conn) {
        this.conn = conn;
        conn.on('open', () => {
            if (this.closed) return;
            this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.myName });
            this.watchIce(conn);
        });
        conn.on('data', (data) => {
            if (this.closed || this.conn !== conn) return;
            this.onMessage(data).catch(() => this.fatal('desync'));
        });
        conn.on('close', () => this.onPeerGone(conn));
        conn.on('error', () => this.onPeerGone(conn));
    }

    // 回線断の検知。PeerJS の close は届くのが遅いことがあるため ICE の状態も見る
    watchIce(conn) {
        const pc = conn.peerConnection;
        if (!pc || !pc.addEventListener) return;
        pc.addEventListener('iceconnectionstatechange', () => {
            const state = pc.iceConnectionState;
            clearTimeout(this.iceTimer);
            if (state === 'failed' || state === 'closed') this.onPeerGone(conn);
            else if (state === 'disconnected') this.iceTimer = setTimeout(() => this.onPeerGone(conn), ICE_LOST_MS);
        });
    }

    onPeerGone(conn) {
        if (this.closed || this.conn !== conn) return;
        this.closed = true;
        this.cleanup();
        this.emit('onPeerLeft');
    }

    send(msg) {
        if (this.conn && this.conn.open) this.conn.send(msg);
    }

    // --- 受信 ---

    async onMessage(msg) {
        if (!msg || typeof msg.t !== 'string') return;

        if (msg.t === 'hello') {
            if (this.helloDone) return;
            if (msg.v !== PROTOCOL_VERSION) return this.fatal('version_mismatch');
            this.helloDone = true;
            clearTimeout(this.connectTimer);
            this.oppName = sanitizeName(msg.name) || 'Opponent';
            this.emit('onPeerConnected', { name: this.oppName });
            this.emit('onPickCharacter');
            return;
        }
        if (!this.helloDone) return;

        switch (msg.t) {
            case 'char_commit':
                if (msg.round !== this.round || this.char.theirHash || typeof msg.hash !== 'string') return;
                this.char.theirHash = msg.hash;
                this.revealCharIfReady();
                break;

            case 'char_reveal': {
                if (msg.round !== this.round || !this.char.theirHash || this.char.theirs) return;
                // 自分のコミットを送る前に相手が公開してくることはない（手順違反）
                if (!this.char.myCommit) return this.fatal('desync');
                const c = this.char;
                const ok = isPvpCharId(msg.charId)
                    && await verifyCommit(c.theirHash, this.ctx('char', 1), msg.charId, msg.nonce);
                if (this.char !== c || c.theirs) return; // 検証中に状況が変わった（重複受信など）
                if (!ok) return this.fatal('desync');
                c.theirs = msg.charId;
                this.startIfReady();
                break;
            }

            case 'move_commit':
                if (!this.playing || msg.round !== this.round || msg.turn !== this.match.turn || this.move.theirHash) return;
                if (typeof msg.hash !== 'string') return;
                // 相手が見ている局面と自分の局面が一致しているか確認する
                if (msg.state !== this.stateDigest(1)) return this.fatal('desync');
                this.move.theirHash = msg.hash;
                if (!this.move.mine) this.emit('onOpponentReady');
                this.revealMoveIfReady();
                break;

            case 'move_reveal': {
                if (!this.playing || msg.round !== this.round || msg.turn !== this.match.turn) return;
                if (!this.move.theirHash || this.move.theirs) return;
                if (!this.move.myCommit) return this.fatal('desync');
                const m = this.move;
                const ok = PVP_MOVES.includes(msg.move)
                    && isLegalMove(this.match, 1, msg.move)
                    && await verifyCommit(m.theirHash, this.ctx('move', 1), msg.move, msg.nonce);
                if (this.move !== m || m.theirs) return; // 検証中に状況が変わった（重複受信など）
                if (!ok) return this.fatal('desync');
                m.theirs = msg.move;
                this.resolveIfReady();
                break;
            }

            case 'rematch':
                if (msg.round !== this.round || this.playing || this.rematch.theirs) return;
                this.rematch.theirs = true;
                if (!this.rematch.mine) this.emit('onRematchRequested');
                this.nextRoundIfReady();
                break;

            case 'leave':
                this.onPeerGone(this.conn);
                break;
        }
    }

    // コミットに混ぜる文脈。who: 0 = 自分, 1 = 相手。ホストを 'H'、参加側を 'G' として区別する
    ctx(kind, who) {
        const mineIsHost = this.isHost;
        const role = (who === 0) === mineIsHost ? 'H' : 'G';
        const turn = kind === 'move' ? this.match.turn : 0;
        return `${kind}|${this.round}|${turn}|${role}`;
    }

    // side から見た局面の要約（side: 0 = 自分視点, 1 = 相手視点）
    stateDigest(side) {
        const s = [this.match.sides[side], this.match.sides[1 - side]];
        return `${this.match.turn}:${s.map(x => `${x.charId},${x.hp},${x.energy}`).join(';')}`;
    }

    // --- キャラクター選択 ---

    async pickCharacter(charId) {
        if (this.closed || this.char.mine || !isPvpCharId(charId)) return;
        this.char.mine = charId;
        this.char.myCommit = await makeCommit(this.ctx('char', 0), charId);
        this.send({ t: 'char_commit', round: this.round, hash: this.char.myCommit.hash });
        this.revealCharIfReady();
    }

    revealCharIfReady() {
        const c = this.char;
        if (!c.myCommit || !c.theirHash || c.sentReveal) return;
        c.sentReveal = true;
        this.send({ t: 'char_reveal', round: this.round, charId: c.mine, nonce: c.myCommit.nonce });
        this.startIfReady();
    }

    startIfReady() {
        const c = this.char;
        if (!c.sentReveal || !c.theirs || this.playing) return;
        this.match = createMatch([c.mine, c.theirs]); // 自分を side 0 として持つ
        this.playing = true;
        this.resetTurn();
        this.emit('onStart', {
            mode: MATCH_MODES.FRIEND,
            turn: 1,
            turnMs: 0, // フレンド戦は時間制限なし
            you: { name: this.myName, rating: null, charId: c.mine },
            opp: { name: this.oppName, rating: null, charId: c.theirs }
        });
    }

    // --- ターン進行 ---

    async submitMove(move) {
        if (this.closed || !this.playing || this.move.mine) return;
        if (!isLegalMove(this.match, 0, move)) return;
        this.move.mine = move;
        const digest = this.stateDigest(0);
        const turn = this.match.turn;
        const commit = await makeCommit(this.ctx('move', 0), move);
        this.move.myCommit = commit;
        this.send({ t: 'move_commit', round: this.round, turn, hash: commit.hash, state: digest });
        this.revealMoveIfReady();
    }

    revealMoveIfReady() {
        const m = this.move;
        if (!m.myCommit || !m.theirHash || m.sentReveal) return;
        m.sentReveal = true;
        this.send({ t: 'move_reveal', round: this.round, turn: this.match.turn, move: m.mine, nonce: m.myCommit.nonce });
        this.resolveIfReady();
    }

    resolveIfReady() {
        const m = this.move;
        if (!m.sentReveal || !m.theirs) return;
        const out = resolveTurn(this.match, [m.mine, m.theirs]);
        this.resetTurn();
        if (out.outcome) this.playing = false;
        this.emit('onTurn', { turn: out.turn, you: out.moves[0], opp: out.moves[1], auto: false });
    }

    // --- 再戦 ---

    requestRematch() {
        if (this.closed || this.playing || this.rematch.mine) return;
        this.rematch.mine = true;
        this.send({ t: 'rematch', round: this.round });
        this.nextRoundIfReady();
    }

    nextRoundIfReady() {
        if (!this.rematch.mine || !this.rematch.theirs) return;
        this.round += 1;
        this.resetRound();
        this.emit('onPickCharacter');
    }

    // --- 終了 ---

    leave() {
        if (this.closed) return;
        this.send({ t: 'leave' });
        this.closed = true;
        // 'leave' が相手に届くのを少し待ってから切る
        setTimeout(() => this.cleanup(), 200);
    }

    fatal(code) {
        if (this.closed) return;
        this.send({ t: 'leave' });
        this.closed = true;
        setTimeout(() => this.cleanup(), 200);
        this.emit('onFatal', code);
    }

    cleanup() {
        clearTimeout(this.connectTimer);
        clearTimeout(this.iceTimer);
        this.playing = false;
        const peer = this.peer;
        this.peer = null;
        this.conn = null;
        if (peer) { try { peer.destroy(); } catch { /* 既に破棄済み */ } }
    }
}
