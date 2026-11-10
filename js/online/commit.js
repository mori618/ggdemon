/**
 * コミット＆リビール（P2P のフレンド戦で使う後出し防止）。
 *
 * 1. 自分の手に乱数（nonce）を付けてハッシュ化し、ハッシュだけを先に送る
 * 2. 相手のハッシュを受け取ってから、手と nonce を公開する
 * 3. 受け取った側はハッシュを再計算して、後から手を変えていないことを確認する
 */
const subtle = () => globalThis.crypto.subtle;

function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
    return toHex(await subtle().digest('SHA-256', new TextEncoder().encode(text)));
}

export function randomHex(bytes = 16) {
    const a = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(a);
    return toHex(a);
}

// context には「何ターン目の誰の手か」等を入れ、別の場面への使い回しを防ぐ
export async function makeCommit(context, value) {
    const nonce = randomHex(16);
    const hash = await sha256Hex(`${context}|${value}|${nonce}`);
    return { hash, nonce };
}

export async function verifyCommit(hash, context, value, nonce) {
    if (typeof hash !== 'string' || typeof value !== 'string' || typeof nonce !== 'string') return false;
    return (await sha256Hex(`${context}|${value}|${nonce}`)) === hash;
}
