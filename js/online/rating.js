/**
 * レート計算（Elo方式）。サーバーが使い、クライアントは表示の参考にするだけ。
 */
export const INITIAL_RATING = 1500;
export const MIN_RATING = 100;
export const K_FACTOR = 32;

export function expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * scoreA: A の結果（勝ち 1 / 引き分け 0.5 / 負け 0）
 * 戻り値: [A の新レート, B の新レート]
 */
export function updateRatings(ratingA, ratingB, scoreA, k = K_FACTOR) {
    const delta = Math.round(k * (scoreA - expectedScore(ratingA, ratingB)));
    return [
        Math.max(MIN_RATING, ratingA + delta),
        Math.max(MIN_RATING, ratingB - delta)
    ];
}
