# Chillmeru（チルメル）— データパイプライン（MVPスキャフォールド）

日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる窓。
"chill"（力を抜く／デジタルデトックス）＋「見る」。サーバーレス・gitネイティブ・低コスト。
読み取り専用の日次更新コンテンツサイト。

暫定ホスティング: `chillmeru.netlify.app`（Netlify、独自ドメイン取得前のサブドメイン運用）
アカウント名は X / Telegram / GitHub とも `chillmeru` で統一。

## 構成

- **オーケストレーション**: GitHub Actions の cron（`.github/workflows/daily.yml`）
- **ストレージ**: リポジトリ内のフラットJSON（git = DB兼履歴。diffがそのままBIPネタ）
- **処理**: `scripts/fetch-voices.mjs`（Reddit取得 → 既出除外 → 新着だけLLM要約 → 書き出し → Telegramドラフト通知）
  - `lib/reddit.mjs` / `lib/llm.mjs` / `lib/telegram.mjs` に処理ごとに切り出し、
    それぞれ単体で検証できる（下記「〜だけ先に確認する」参照）
- **分類**: `lib/taxonomy.mjs`（唯一の正）／型は `lib/types.ts`
- **フロント**: `src/pages/index.astro`（Astro、SSG）。`data/*.json` をビルド時に読み込み、
  topicタブ + resonance（あるある/もやもや）バッジ付きで表示。`npm run build` で `dist/` に出力し、
  Netlify の無料枠にそのまま載る（`netlify.toml` 同梱、`chillmeru.netlify.app` 等のサブドメイン運用）

## データモデル（`lib/types.ts`）

`Voice` は原文bodyを持たない。id・URL・指標・日本語**要約**のみ。
これで規約/著作権の制約を「保存しないから表示しようがない」形でスキーマに焼き込む。
要約は必ず元投稿へリンクし、原典に敬意とトラフィックを返す。

### 2軸の分類
- `topic`（何の話か）: workload / salary / career / certification / culture
- `resonance`（どう刺さるか）: aruaru（あるある）/ moyamoya（もやもや）/ null
- resonanceが立つほど「共感」寄り、topicがcertification・career寄りほど「制度・教育」寄り。
  投稿の反応がどちらに寄るかの計測軸そのものになる。

## セットアップ

1. Reddit は**認証なしの公開JSONエンドポイント**（`https://www.reddit.com/r/xxx/top.json`）を使う。
   script アプリの登録は不要。具体的な `REDDIT_USER_AGENT` を用意するだけでよい。
   ※ 2026年に Reddit が Responsible Builder Policy を導入し、script アプリの
   セルフサーブ新規作成が実質ブロックされたための代替。非商用・低頻度なら
   無料枠で足りるが、**着手前に現行の規約・レート制限を確認**。将来レート制限や
   ブロックに当たった場合は Reddit の公式データAPI申請（非商用向け）に切り替える。
2. LLMは **Gemini**（`gemini-3.5-flash`、構造化出力でJSONを直接強制）を使用。
   [Google AI Studio](https://aistudio.google.com/apikey) でAPIキーを発行し `LLM_API_KEY` に設定。
   別プロバイダに替えたい場合は `lib/llm.mjs` の `callLLM()` を差し替える。
3. Telegram: BotFather でボットを作りトークン取得（ボット名も `chillmeru_bot` 等に揃えると統一感が出る）、自分の chat_id を控える。
4. 下記を GitHub リポジトリの **Secrets** に登録。

### 必要な Secrets
```
REDDIT_USER_AGENT   例: chillmeru/0.1 by u/yourname
LLM_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

## 各連携を単体で確認する

本パイプラインを1本通す前に、Reddit / LLM / Telegram をそれぞれ単体で検証できる
（`lib/reddit.mjs` / `lib/llm.mjs` / `lib/telegram.mjs` に分離してあるため）。

### Reddit

`REDDIT_USER_AGENT` の Secret だけ登録すれば動く（認証情報は不要）。

- **GitHub 上で**: Actions → **check-reddit** → *Run workflow*。
  ログに取得タイトルと指標が出れば成功（`.github/workflows/check-reddit.yml`）。
- **ローカルで**: 環境変数を渡して `node scripts/check-reddit.mjs`。

#### ⚠️ GitHub のホスト型ランナーはRedditにブロックされている

実測済み: `ubuntu-latest`（GitHub Actionsの標準環境）のIPからも、自宅PCの
住宅回線IPからも、`www.reddit.com` / `old.reddit.com` の `.json` / `.rss` に
投げると**すべて403/429**で返ってくる。curlでブラウザそっくりのヘッダーを
付けても403のままな一方、実際のブラウザで直接開くとJSONが表示されるため、
単なるUser-Agent/ヘッダーの問題ではなく、TLS通信の"指紋"レベルでボットを
判別されていると見られる。ヘッダー偽装で回避する方向はReddit側の対策を
意図的にすり抜ける行為になるため採用しない。

現状の対応:

1. **self-hosted runner**（Mac/Raspberry Pi等）を用意済み。ただし上記の通り
   IPの種類を変えても403は解消しなかったため、根本解決にはならない。
   `check-reddit` の `workflow_dispatch` 入力で実行環境は選べる
   （`.github/workflows/check-reddit.yml`）。
2. **Reddit公式の非商用Data API申請を提出済み（審査待ち）**。
   `support.reddithelp.com` の Data Access Request チケットから、
   Devvitエコシステムでは対応不可能な理由（外部GitHubリポジトリへの
   書き込みが前提の設計）を明記して申請済み。承認されれば `oauth.reddit.com`
   経由の正規OAuth認証情報が発行され、この403を回避できる可能性が高い
   （このブロックは無認証パス側の挙動と推定されるため）。
   承認が来たら `lib/reddit.mjs` をOAuth実装に戻す（過去のコミット参照）。

承認待ちの間は、Reddit以外の各連携（下記）とフロントエンドを
seedデータ（`data/us/voices.json` のサンプル2件）で進められる。

### LLM（Gemini要約）

`LLM_API_KEY` の Secret だけ登録すれば動く。Redditアクセスはブロックされていないので
通常の `ubuntu-latest` でそのまま動く。

- **GitHub 上で**: Actions → **check-llm** → *Run workflow*
  （`.github/workflows/check-llm.yml`）。
- **ローカルで**: `LLM_API_KEY` を渡して `node scripts/check-llm.mjs`。

サンプル投稿1件を要約させ、`title_ja`/`summary_ja`/`topic`/`resonance` が
taxonomy に沿ったJSONで返るか確認する。

### Telegram

`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` を登録すれば動く。
実行すると**本物のテスト通知が実際に届く**。

- **GitHub 上で**: Actions → **check-telegram** → *Run workflow*
  （`.github/workflows/check-telegram.yml`）。
- **ローカルで**: 環境変数を渡して `node scripts/check-telegram.mjs`。

## ローカル実行

フロントエンド（Astroビルド）:
```
npm install
npm run dev       # http://localhost:4321 で確認
npm run build     # dist/ に静的出力
```

データパイプライン:
```
node scripts/fetch-voices.mjs
```
（上記の環境変数を渡した状態で。手動ならActionsの「Run workflow」でも可）

## デプロイ（Netlify）

1. https://app.netlify.com → **Add new site → Import an existing project**
2. GitHubを選び、`chillmeru` リポジトリを選択
3. ビルド設定は `netlify.toml` に同梱済み（`npm run build` / 公開ディレクトリ `dist`）
   なのでそのまま **Deploy** でよい
4. 初回デプロイ後、`<サイト名>.netlify.app` のURLが発行される
   （`chillmeru.netlify.app` を希望する場合は Site settings → Change site name）
5. `data/*.json` が更新されるたび（`daily.yml` のコミット時）に自動で再ビルド・再デプロイされる
   （Netlifyはpushをトリガーに自動ビルドする）

## 投稿フロー（MVP）

サーバーレスなのでTelegramのボタン押下を受け取る常駐先がない。よって完全自動ではなく:
1. パイプラインが新着から1件選び、投稿文（＋将来は画像）をTelegramに送る
2. 「Xで開く」リンクで投稿画面を開き、最終チェックして手で投稿

真のワンタップ自動投稿は、量が増えて **X従量API**（2026年時点でリンク付き投稿は1件$0.20）を
入れる段で、受け口（小さな常駐）と一緒に足す。それまでは手動で品質（冒頭2秒）を守るほうが得。

## 拡張の足し方
- **国を増やす**: `data/uk/` を作り、スクリプトの `COUNTRY`/`SUBREDDIT` を分岐
- **求人（Adzuna）/ 給与（e-Stat・BLS）**: 別スクリプト＋別JSONを足すだけ
- **通知先を増やす**: `notify*` 関数を足す。n8nは不要、ステップを増やすのがコードでの拡張性

## 注意
- cronはUTC。無料Actionsは起動が数分ずれる／60日無活動でスケジュール停止に注意。
  時刻厳守なら Cloudflare Workers Cron が素直。
- 広告運用に振ると商用扱いになりAPI規約の前提が変わる。MVPは非商用で通す。
- 名前「Chillmeru」は独自ドメイン（chillmeru.app 等）・X/GitHubハンドルの
  実際の空き状況を未確認（要・本人チェック）。取得済みでない前提で運用中。
