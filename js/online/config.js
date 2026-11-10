/**
 * オンライン対戦サーバーの接続先。
 * ビルド時の環境変数 VITE_ONLINE_SERVER_URL で指定する（例: https://ggdemon-online.xxxx.workers.dev）。
 * 未設定でも、サーバーを使わないフレンド戦（P2P）は遊べる。
 */
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const SERVER_URL = String(env.VITE_ONLINE_SERVER_URL || (env.DEV ? 'http://localhost:8787' : '')).replace(/\/+$/, '');

export const hasServer = () => SERVER_URL !== '';

export const wsUrl = (path) => SERVER_URL.replace(/^http/, 'ws') + path;
