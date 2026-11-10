// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { P2PSession, generateRoomCode, normalizeRoomCode } from '../js/online/p2pSession.js';
import { makeCommit } from '../js/online/commit.js';

// PeerJS の代わりになる、メモリ内でつながる偽物
function createFakeNetwork() {
    const peers = new Map();
    const later = (fn) => setTimeout(fn, 0);

    class Emitter {
        constructor() { this.listeners = {}; }
        on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
        fire(ev, ...args) { (this.listeners[ev] || []).forEach(fn => fn(...args)); }
    }

    class FakeConn extends Emitter {
        constructor() { super(); this.open = false; this.other = null; this.sent = []; }
        send(data) {
            this.sent.push(data);
            const other = this.other;
            const copy = JSON.parse(JSON.stringify(data));
            later(() => { if (other.open) other.fire('data', copy); });
        }
        close() {
            if (!this.open) return;
            this.open = false;
            const other = this.other;
            later(() => { this.fire('close'); if (other.open) { other.open = false; other.fire('close'); } });
        }
    }

    class FakePeer extends Emitter {
        constructor(id) {
            super();
            this.id = id || `anon-${Math.random()}`;
            later(() => {
                if (peers.has(this.id)) return this.fire('error', { type: 'unavailable-id' });
                peers.set(this.id, this);
                this.fire('open', this.id);
            });
        }
        connect(targetId) {
            const mine = new FakeConn(), theirs = new FakeConn();
            mine.other = theirs; theirs.other = mine;
            later(() => {
                const target = peers.get(targetId);
                if (!target) return this.fire('error', { type: 'peer-unavailable' });
                target.fire('connection', theirs);
                later(() => { mine.open = theirs.open = true; mine.fire('open'); theirs.fire('open'); });
            });
            return mine;
        }
        destroy() { peers.delete(this.id); }
    }
    return { FakePeer, peers };
}

const flush = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

function recorder() {
    const events = [];
    const h = {};
    for (const name of ['onRoomReady', 'onPeerConnected', 'onPickCharacter', 'onStart', 'onOpponentReady', 'onTurn', 'onRematchRequested', 'onPeerLeft', 'onFatal']) {
        h[name] = (...args) => events.push([name, ...args]);
    }
    const of = (name) => events.filter(e => e[0] === name);
    return { h, events, of };
}

describe('部屋コード', () => {
    it('紛らわしい文字を含まない6文字', () => {
        for (let i = 0; i < 50; i++) expect(generateRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    });
    it('入力の揺れ（小文字・空白・ハイフン）を吸収する', () => {
        expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234');
        expect(normalizeRoomCode('abc')).toBeNull();
        expect(normalizeRoomCode('')).toBeNull();
    });
});

describe('フレンド戦（P2P）', () => {
    let net, A, B, host, guest;

    async function connect() {
        net = createFakeNetwork();
        A = recorder(); B = recorder();
        host = new P2PSession('ホスト', A.h, net.FakePeer);
        host.host();
        await flush();
        const code = A.of('onRoomReady')[0][1];
        guest = new P2PSession('ゲスト', B.h, net.FakePeer);
        guest.join(code);
        await flush();
    }

    beforeEach(connect);

    it('接続するとお互いの名前が分かり、キャラクター選択に進む', () => {
        expect(A.of('onPeerConnected')[0][1]).toEqual({ name: 'ゲスト' });
        expect(B.of('onPeerConnected')[0][1]).toEqual({ name: 'ホスト' });
        expect(A.of('onPickCharacter')).toHaveLength(1);
        expect(B.of('onPickCharacter')).toHaveLength(1);
    });

    it('両者が選ぶまで相手のキャラクターは分からない', async () => {
        await host.pickCharacter('TANK');
        await flush();
        expect(A.of('onStart')).toHaveLength(0);
        // 先に選んだ側が送ったのはハッシュだけ
        const sent = host.conn.sent.filter(m => m.t.startsWith('char'));
        expect(sent).toHaveLength(1);
        expect(sent[0].t).toBe('char_commit');
        expect(JSON.stringify(sent[0])).not.toContain('TANK');

        await guest.pickCharacter('SAGE');
        await flush();
        expect(A.of('onStart')[0][1]).toMatchObject({ mode: 'friend', you: { name: 'ホスト', charId: 'TANK' }, opp: { name: 'ゲスト', charId: 'SAGE' } });
        expect(B.of('onStart')[0][1]).toMatchObject({ you: { charId: 'SAGE' }, opp: { charId: 'TANK' } });
    });

    async function start(a = 'NORMAL', b = 'NORMAL') {
        await host.pickCharacter(a);
        await guest.pickCharacter(b);
        await flush();
    }

    it('手はコミットしてから公開され、両者に同じターン結果が届く', async () => {
        await start();
        await host.submitMove('CHARGE');
        await flush();
        expect(B.of('onOpponentReady')).toHaveLength(1);
        expect(A.of('onTurn')).toHaveLength(0);
        // 相手が出すまで、自分の手は公開していない
        expect(host.conn.sent.some(m => m.t === 'move_reveal')).toBe(false);

        await guest.submitMove('GUARD');
        await flush();
        expect(A.of('onTurn')[0][1]).toEqual({ turn: 1, you: 'CHARGE', opp: 'GUARD', auto: false });
        expect(B.of('onTurn')[0][1]).toEqual({ turn: 1, you: 'GUARD', opp: 'CHARGE', auto: false });
        expect(host.match.sides[0]).toEqual(guest.match.sides[1]);
    });

    it('決着まで進められ、再戦は両者が希望したら始まる', async () => {
        await start('ASSASSIN', 'TANK'); // ASSASSIN は4回チャージで勝ち
        for (let i = 0; i < 4; i++) {
            await host.submitMove('CHARGE');
            await guest.submitMove('GUARD');
            await flush();
        }
        expect(A.of('onTurn')).toHaveLength(4);
        expect(host.match.outcome).toEqual({ winner: 0, reason: 'charge' });
        expect(guest.match.outcome).toEqual({ winner: 1, reason: 'charge' });
        expect(host.playing).toBe(false);

        host.requestRematch();
        await flush();
        expect(B.of('onRematchRequested')).toHaveLength(1);
        expect(A.of('onPickCharacter')).toHaveLength(1);
        guest.requestRematch();
        await flush();
        expect(A.of('onPickCharacter')).toHaveLength(2);
        expect(B.of('onPickCharacter')).toHaveLength(2);

        await start('TANK', 'TANK');
        expect(A.of('onStart')).toHaveLength(2);
    });

    it('コスト不足の手は出せない', async () => {
        await start();
        await host.submitMove('ATTACK'); // エネルギー0
        await flush();
        expect(host.move.mine).toBeNull();
        expect(B.of('onOpponentReady')).toHaveLength(0);
    });

    it('公開した手がコミットと違えば不正として中止する（後出し防止）', async () => {
        await start();
        await host.submitMove('CHARGE');
        await flush();
        // ゲストが改造クライアントだと仮定: GUARD でコミットしておき、相手の手を見てから CHARGE に変える
        const fake = await makeCommit(guest.ctx('move', 0), 'GUARD');
        guest.move.mine = 'GUARD';
        guest.move.myCommit = fake;
        guest.send({ t: 'move_commit', round: 0, turn: 1, hash: fake.hash, state: guest.stateDigest(0) });
        await flush();
        guest.send({ t: 'move_reveal', round: 0, turn: 1, move: 'CHARGE', nonce: fake.nonce });
        await flush();
        expect(A.of('onFatal')[0][1]).toBe('desync');
        expect(A.of('onTurn')).toHaveLength(0);
    });

    it('コミットせずに公開してきた手は受け付けない', async () => {
        await start();
        guest.send({ t: 'move_reveal', round: 0, turn: 1, move: 'CHARGE', nonce: 'abc' });
        await flush();
        await host.submitMove('CHARGE');
        await flush();
        expect(A.of('onTurn')).toHaveLength(0);
        expect(host.move.theirs).toBeNull();
    });

    it('局面が食い違っていたら中止する', async () => {
        await start();
        guest.match.sides[0].energy = 9; // ゲスト側だけ局面を書き換える
        await guest.submitMove('ATTACK');
        await flush();
        expect(A.of('onFatal')[0][1]).toBe('desync');
    });

    it('相手が抜けると通知される', async () => {
        await start();
        guest.leave();
        await flush();
        await new Promise(r => setTimeout(r, 250));
        expect(A.of('onPeerLeft')).toHaveLength(1);
        expect(host.closed).toBe(true);
    });

    it('3人目は部屋に入れない / 存在しない部屋はエラー', async () => {
        const C = recorder();
        const third = new P2PSession('3人目', C.h, net.FakePeer);
        third.join(A.of('onRoomReady')[0][1]);
        await flush();
        expect(C.of('onPeerConnected')).toHaveLength(0);
        expect(A.of('onPeerConnected')).toHaveLength(1);
        third.leave();

        const D = recorder();
        const lost = new P2PSession('迷子', D.h, net.FakePeer);
        lost.join('ZZZZZZ');
        await flush();
        expect(D.of('onFatal')[0][1]).toBe('room_not_found');
    });
});
