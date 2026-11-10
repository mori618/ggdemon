/**
 * オンライン対戦の通信規約（クライアントとサーバーで共有）。
 * 互換性のない変更をしたら PROTOCOL_VERSION を上げる。
 */
export const PROTOCOL_VERSION = 1;

export const MATCH_MODES = {
    RANKED: 'ranked',
    CASUAL: 'casual',
    FRIEND: 'friend'
};

// 対戦の時間設定（ミリ秒）
export const TIMING = {
    TURN_MS: 30000,          // 1ターンの持ち時間
    ANIM_GRACE_MS: 4000,     // ターン演出ぶんの猶予（サーバー側の締切に上乗せ）
    CONNECT_MS: 20000,       // マッチ成立から両者が入室するまでの猶予
    DISCONNECT_GRACE_MS: 20000, // 切断から負け確定までの猶予
    MAX_TIMEOUTS: 2          // 連続で時間切れするとこの回数で負け
};

// 試合結果（自分視点）
export const RESULTS = {
    WIN: 'WIN',
    LOSE: 'LOSE',
    DRAW: 'DRAW',
    VOID: 'VOID' // 無効試合（相手が入室しなかった等）。レート変動なし
};

// 決着理由
export const END_REASONS = {
    KO: 'ko',
    DOUBLE_KO: 'double_ko',
    CHARGE: 'charge',
    DOUBLE_CHARGE: 'double_charge',
    TURN_LIMIT: 'turn_limit',
    FORFEIT: 'forfeit',
    TIMEOUT: 'timeout',
    DISCONNECT: 'disconnect',
    NO_SHOW: 'no_show',
    DESYNC: 'desync'
};

export const NAME_MAX_LENGTH = 12;

// 表示名を正規化する。使えない場合は null
export function sanitizeName(raw) {
    if (typeof raw !== 'string') return null;
    // 制御文字・ゼロ幅文字・改行類を除去し、空白を詰める
    const name = raw
        .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
    const chars = Array.from(name);
    if (chars.length === 0) return null;
    return chars.slice(0, NAME_MAX_LENGTH).join('');
}

export function randomGuestName() {
    return `Player${Math.floor(1000 + Math.random() * 9000)}`;
}
