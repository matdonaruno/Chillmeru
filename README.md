# Chillmeru（チルメル）— データパイプライン（MVPスキャフォールド）

日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる窓。
"chill"（力を抜く／デジタルデトックス）＋「見る」。サーバーレス・gitネイティブ・低コスト。
読み取り専用の日次更新コンテンツサイト。

暫定ホスティング: `chillmeru.pages.dev`（Cloudflare Pages、独自ドメイン取得前のサブドメイン運用）
アカウント名は X / Telegram / GitHub とも `chillmeru` で統一。

## 構成

- **オーケストレーション**: GitHub Actions の cron（`.github/workflows/daily.yml`）
- **ストレージ**: リポジトリ内のフラットJSON（git = DB兼履歴。diffがそのままBIPネタ）
- **処理**: `scripts/fetch-voices.mjs`（Reddit取得 → 既出除外 → 新着だけLLM要約 → 書き出し → Telegramドラフト通知）
- **分類**: `lib/taxonomy.mjs`（唯一の正）／型は `lib/types.ts`
- **フロント**: 未同梱。Next.js か Astro でこの `data/*.json` を読むだけ（Cloudflare Pages / Vercel 無料枠、`chillmeru.pages.dev` 等のサブドメインでそのまま公開可）

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

1. Reddit で **script タイプ**のアプリを登録（client_id / secret を取得）。
   非商用・低頻度なら無料枠で足りるが、**着手前に現行の規約・レート制限を確認**。
2. 安価なLLM（Gemini Flash / Gemma / Bedrock 等）のAPIキーを用意。
   `scripts/fetch-voices.mjs` の `callLLM()` を使うプロバイダに合わせて差し替え。
3. Telegram: BotFather でボットを作りトークン取得（ボット名も `chillmeru_bot` 等に揃えると統一感が出る）、自分の chat_id を控える。
4. 下記を GitHub リポジトリの **Secrets** に登録。

### 必要な Secrets
```
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USERNAME
REDDIT_PASSWORD
REDDIT_USER_AGENT   例: chillmeru/0.1 by u/yourname
LLM_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

## Reddit 連携だけ先に確認する

LLM/Telegram を用意する前に、Reddit の認証と取得だけを単体で検証できる。
Reddit の5つの Secret（`REDDIT_*`）だけ登録すれば動く。

- **GitHub 上で**: Actions → **check-reddit** → *Run workflow*。
  ログに取得タイトルと指標が出れば成功（`.github/workflows/check-reddit.yml`）。
- **ローカルで**: 環境変数を渡して `node scripts/check-reddit.mjs`。

script アプリの password grant の注意:
- 認証に使うアカウントは、その script アプリの **developer** に入れておく。
- **2FA 有効**なら `REDDIT_PASSWORD` は `パスワード:6桁コード` の形にする。
- **SSO のみ**（パスワード未設定）のアカウントは password grant 不可。

## ローカル実行
```
node scripts/fetch-voices.mjs
```
（上記の環境変数を渡した状態で。手動ならActionsの「Run workflow」でも可）

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
