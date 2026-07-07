# タワーモード全事象（イベント等）の網羅的テスト実装計画

タワーモード内で発生しうるすべての「？」イベント（SAFE/RISK）、およびマップノード上の特殊事象（宝箱、ショップ、休憩所など）について、自動テスト（Vitest）を実装してクラッシュや状態異常が発生しないことを網羅的に検証します。

## 対象となる事象一覧

### SAFEイベント (12種類)
- `GOLD` (Lucky Encounter)
- `FREE_BUFF` (Strange Shrine)
- `EXTRA_LIFE` (Healing Spring)
- `SKILL_DROP` (Wandering Master)
- `SKILL_UPGRADE` (Training Camp)
- `HIDDEN_TREASURE` (Hidden Cave)
- `DISCOUNT_SHOP` (Traveling Merchant)
- `WEAK_ENEMY` (Sleeping Monster)
- `WEAK_BOSS` (Injured Boss)
- `LEGEND_TREASURE` (Legendary Chest)
- `STATUE_BLESSING` (Angel Statue)
- `MEGA_GOLD` (Treasure Hoard)

### RISKイベント (10種類)
- `TRAP` (Poison Trap)
- `TRIAL` (Demonic Trial)
- `MINI_BOSS` (Ambush)
- `ELITE_WARNING` (Ominous Presence)
- `STRONG_BOSS` (Dark Ritual)
- `CURSED_TREASURE` (Cursed Chest)
- `PAY_SKILL_UPGRADE` (Greedy Master)
- `SKILL_SELL` (Soul Merchant)
- `TIME_LEAP` (Time Distortion)
- `STATUE_GREET` (Demon Statue)

### マップノード事象
- `TREASURE` (通常宝箱 または ミミックによる戦闘開始)
- `SHOP` (アイテム購入処理、所持金不足のハンドリング)
- `REST` (キャンプでの回復処理)

## 提案する実装アプローチ

1. **テストファイルの分割**:
   - イベント用のテスト (`tests/events_integration.test.js`): SAFE/RISKの全22種類のイベントに対して、全選択肢をクリックするシナリオを記述します。
   - ノード用のテスト (`tests/map_nodes_integration.test.js`): 宝箱、ショップ、休憩所のクリックアクションと遷移をテストします。

2. **モックと状態初期化の共通化**:
   - テストの肥大化を防ぐため、実際の `index.html` のDOMを読み込み、`gameState` を毎回クリーンな状態に初期化するヘルパー関数を用意します。

3. **アサーション（確認項目）**:
   - すべてのイベント・ノードにおいて、**「エラーやクラッシュ（TypeError等）で処理が止まらないこと」**を最低限保証します。
   - 加えて、HPの増減やゴールドの増減、ステータス異常（エリートフラグ等）が正しく反映されているかをチェックします。

## ユーザーへの確認事項（Open Questions）

- **テスト対象の優先度**: 現在洗い出した22個のランダムイベントと3個のマップノード以外に、追加でテストしたい特定の事象（例: ボス撃破後のエンディング処理など）はありますか？
- **手動での動作確認**: 自動テストを実装してPASSさせるだけでなく、ゲーム画面上で全てのイベントを強制的に発生させて目視でテストできる「デバッグモード」のような機能も追加しますか？（テスト実装のみでよければ不要です）

## 検証プラン (Verification Plan)

### 自動テスト
- `npm run test` コマンドを実行し、作成した数十項目のテストケースがすべて `PASS` することを確認します。
- これにより、今後の機能追加や修正によって再びイベント処理が壊れる（リグレッション）のを防ぐことができます。
