/**
 * マッチングの組み合わせ決定（純粋関数）。
 *
 * - カジュアル: 待っている順に組む
 * - レート戦: レートが近い相手と組む。待ち時間が長いほど許容するレート差を広げ、
 *   一定時間を過ぎたら誰とでも組む（人が少なくても対戦が成立するように）
 */
import { MATCH_MODES } from './protocol.js';

export const BASE_WINDOW = 100;        // 待ち始めの許容レート差
export const WINDOW_PER_SEC = 25;      // 1秒ごとに広がる許容レート差
export const OPEN_AFTER_MS = 30000;    // これ以上待ったらレート差を問わない

export function ratingWindow(waitMs) {
    if (waitMs >= OPEN_AFTER_MS) return Infinity;
    return BASE_WINDOW + WINDOW_PER_SEC * Math.max(0, waitMs) / 1000;
}

/**
 * entries: [{ key, playerId, mode, rating, joinedAt }]
 * 戻り値: [[entryA, entryB], ...]
 */
export function findPairs(entries, now) {
    const pairs = [];
    const byWait = (a, b) => a.joinedAt - b.joinedAt;

    // カジュアル: 先着順
    const casual = entries.filter(e => e.mode === MATCH_MODES.CASUAL).sort(byWait);
    const usedCasual = new Set();
    for (let i = 0; i < casual.length; i++) {
        if (usedCasual.has(i)) continue;
        for (let j = i + 1; j < casual.length; j++) {
            if (usedCasual.has(j) || casual[j].playerId === casual[i].playerId) continue;
            usedCasual.add(i); usedCasual.add(j);
            pairs.push([casual[i], casual[j]]);
            break;
        }
    }

    // レート戦: 長く待っている人から、許容範囲内で最もレートが近い相手を探す
    const ranked = entries.filter(e => e.mode === MATCH_MODES.RANKED).sort(byWait);
    const used = new Set();
    for (let i = 0; i < ranked.length; i++) {
        if (used.has(i)) continue;
        const a = ranked[i];
        const windowA = ratingWindow(now - a.joinedAt);
        let best = -1, bestDiff = Infinity;
        for (let j = 0; j < ranked.length; j++) {
            if (j === i || used.has(j)) continue;
            const b = ranked[j];
            if (b.playerId === a.playerId) continue;
            const diff = Math.abs(a.rating - b.rating);
            // どちらかの許容範囲に入っていれば成立
            const allowed = Math.max(windowA, ratingWindow(now - b.joinedAt));
            if (diff <= allowed && diff < bestDiff) { best = j; bestDiff = diff; }
        }
        if (best >= 0) {
            used.add(i); used.add(best);
            pairs.push([a, ranked[best]]);
        }
    }

    return pairs;
}

// まだ組めていないレート戦の待機者が2人以上いるか（＝時間経過で成立しうるか）
export function needsRetry(entries, pairs) {
    const matched = new Set(pairs.flat().map(e => e.key));
    const waiting = entries.filter(e => e.mode === MATCH_MODES.RANKED && !matched.has(e.key));
    return new Set(waiting.map(e => e.playerId)).size >= 2;
}
