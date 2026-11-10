# GG Demon オンライン対戦サーバー

ランダムマッチ・レート戦のためのサーバーです。Cloudflare Workers の上で動きます。
フレンド戦はブラウザ同士が直接つながる（P2P）ので、このサーバーを使いません。

## 構成

```
ブラウザ ──HTTP──▶ Worker ──▶ D1（プレイヤー・レート・対戦履歴）
   │                 │
   └──WebSocket──────┼──▶ Matchmaker（待機列。全体で1つ）
                     └──▶ MatchRoom （対戦部屋。1試合につき1つ）
```

| 部品 | 役割 |
| :--- | :--- |
| Worker 本体 | API と WebSocket の入口。トークンで本人確認する |
| Matchmaker（Durable Object） | 待機列を持ち、相手を見つけて対戦部屋を作る |
| MatchRoom（Durable Object） | 両者の手を受け取り、判定して結果を配る。持ち時間・切断・レート更新もここ |
| D1 | プレイヤー、レート、対戦履歴の保存 |

設計上のポイント:

* **判定はサーバーが行う**: クライアントは自分の手を送るだけで、相手の手は両者が出し終わるまで届きません。後出しや結果の改ざんはできません。
* **判定ロジックは共通**: サーバーもブラウザも `js/online/pvp.js` を使います。ルールを変えるときはこのファイルだけ直せば両方に反映されます（変更後はサーバーの再デプロイが必要）。
* **負荷が小さい**: 通信は1ターンに数通の短いメッセージだけです。接続は待機中に休止（Hibernation）するので、待っているだけの時間は課金対象になりません。
* **アカウントは匿名**: 初回に ID とトークンを発行し、ブラウザの localStorage に保存します。サーバーにはトークンのハッシュだけを残します。

### ルール（サーバーが強制するもの）

| 項目 | 値 | 定義場所 |
| :--- | :--- | :--- |
| 1ターンの持ち時間 | 30秒（時間切れは自動でCHARGE） | `js/online/protocol.js` の `TIMING` |
| 連続時間切れ | 2回で負け | 同上 |
| 切断の猶予 | 20秒以内に再接続できなければ負け | 同上 |
| 入室の猶予 | マッチ成立から20秒。来なければ無効試合（レート変動なし） | 同上 |
| ターン上限 | 60ターンで引き分け | `js/online/pvp.js` の `MAX_TURNS` |
| レート | Elo方式、初期値1500、K=32 | `js/online/rating.js` |
| マッチング | レート差100から開始、1秒ごとに25ずつ拡大、30秒で無制限 | `js/online/matchmaking.js` |

## デプロイ手順

Cloudflare のアカウント（無料プランで可）が必要です。

```bash
cd server
npm install
npx wrangler login
```

1. データベースを作ります。表示された `database_id` を `wrangler.toml` の `database_id` に書き写してください。

    ```bash
    npx wrangler d1 create ggdemon
    ```

2. テーブルを作ります。

    ```bash
    npm run db:migrate
    ```

3. デプロイします。完了すると `https://ggdemon-online.<あなたのサブドメイン>.workers.dev` のようなURLが表示されます。

    ```bash
    npm run deploy
    ```

4. ゲーム側にサーバーのURLを教えます。Cloudflare Pages の設定 →「環境変数」に `VITE_ONLINE_SERVER_URL` を追加して再デプロイしてください（GitHub Pages の場合はリポジトリ直下に `.env.production` を置いてビルド）。

5. （推奨）`wrangler.toml` の `ALLOWED_ORIGINS` をゲームのURLに絞って、もう一度 `npm run deploy` します。

    ```toml
    ALLOWED_ORIGINS = "https://ggdemon.pages.dev"
    ```

## ローカルで動かす

```bash
cd server
npm install
npm run db:migrate:local
npm run dev            # http://localhost:8787
```

別のターミナルでゲームを起動すると（リポジトリ直下で `npm run dev`）、開発時は自動で `http://localhost:8787` に接続します。ブラウザを2つ開けば1台で対戦を試せます（片方はシークレットウィンドウにすると別プレイヤーになります）。

### テスト

* ルール・レート・マッチング・P2P通信の単体テスト: リポジトリ直下で `npm test`
* サーバーの通しテスト（2人ぶん接続して実際に対戦する。Node.js 22 以上が必要）: 時間設定を短くしてサーバーを起動してから実行します。

    ```bash
    npx wrangler dev --port 8787 --var TURN_MS:1500 --var ANIM_GRACE_MS:300 --var DISCONNECT_GRACE_MS:1500 --var CONNECT_MS:2000
    npm run test:e2e
    ```

## API

| メソッド | パス | 内容 |
| :--- | :--- | :--- |
| GET | `/api/health` | 稼働確認 |
| POST | `/api/register` | アカウント作成。トークンはこの応答でのみ返る |
| GET | `/api/me` | 自分のプロフィール（要トークン） |
| POST | `/api/name` | 表示名の変更（要トークン） |
| GET | `/api/leaderboard` | レート上位50人 |
| WebSocket | `/ws/queue?mode=ranked\|casual&char=...` | 待機列に並ぶ |
| WebSocket | `/ws/match/:id` | 対戦部屋に入る（再接続も同じ） |

メッセージの形式は `js/online/protocol.js` と `src/index.js` を参照してください。互換性のない変更をしたら `PROTOCOL_VERSION` を上げると、古いクライアントには「再読み込みしてください」と表示されます。

## 今後の課題

* アカウント作成に回数制限がありません。荒らしが出たら Cloudflare の Rate Limiting ルールを `/api/register` に設定してください。
* 別の端末へのレート引き継ぎ（ログイン機能）は未実装です。
* フレンド戦は接続の仲介に PeerJS の公開サーバーを使っています。回線によっては直接つながらない組み合わせがあります（中継用の TURN サーバーは未設定）。
