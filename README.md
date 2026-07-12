# Chillmeru（チルメル）— データパイプライン（MVPスキャフォールド）

日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる窓。
"chill"（力を抜く／デジタルデトックス）＋「見る」。サーバーレス・gitネイティブ・低コスト。
読み取り専用の日次更新コンテンツサイト。

暫定ホスティング: `chillmeru.netlify.app`（Netlify、独自ドメイン取得前のサブドメイン運用）
アカウント名は X / Telegram / GitHub とも `chillmeru` で統一。

## 構成

- **オーケストレーション**: GitHub Actions の cron（`.github/workflows/daily.yml`）
- **ストレージ**: リポジトリ内のフラットJSON（git = DB兼履歴。diffがそのままBIPネタ）
- **処理（現場の声）**: `scripts/fetch-voices.mjs`（Reddit取得 → 既出除外 → 新着だけLLM要約 → 書き出し → Telegramドラフト通知）
  - `lib/reddit.mjs` / `lib/llm.mjs` / `lib/telegram.mjs` に処理ごとに切り出し、
    それぞれ単体で検証できる（下記「各連携を単体で確認する」参照）
- **処理（求人）**: `scripts/fetch-jobs.mjs`（Adzuna検索 → 既出除外 → 新着だけLLM要約 → 書き出し）
  - `daily.yml` とは独立した `daily-jobs.yml` で動く（Reddit側の問題に影響されないため）
  - Adzuna利用規約により、個別求人への恒久リンクのみ表示。求人数・平均給与などの
    **集計は行わない**（フロントにも実装しない）
- **分類**: `lib/taxonomy.mjs`（唯一の正）／型は `lib/types.ts`
- **フロント**: `src/pages/index.astro`（Astro、SSG）。ページ本体はビルド時に静的出力するが、
  `data/*.json` はビルド時にimportせず、`src/scripts/feed.client.mjs` がブラウザから
  GitHub `main` の生JSON（raw.githubusercontent.com）を直接fetchして描画する。
  データ更新のたびにNetlifyの1デプロイ15クレジットを消費したくないための構成で、
  `netlify.toml` の `ignore` ルールにより `data/` だけの変更ではデプロイ自体がスキップされる
  （コード変更時のみ通常通りデプロイ）。
  「現場の声」「求人」をタブで切り替え表示（topicタブ + resonanceバッジ / 給与レンジバッジ / 発信元の国旗ピル）。
  Web Share API（非対応環境はクリップボードコピーにフォールバック）の共有ボタン、
  `@astrojs/sitemap` によるsitemap・`robots.txt`・OGP/Twitter Card・WebSiteのJSON-LDも実装済み。
  `npm run build` で `dist/` に出力し、Netlify の無料枠にそのまま載る
  （`netlify.toml` 同梱、`chillmeru.netlify.app` 等のサブドメイン運用）

## データモデル（`lib/types.ts`）

`Voice` は原文bodyを持たない。id・URL・指標・日本語**要約**のみ。
これで規約/著作権の制約を「保存しないから表示しようがない」形でスキーマに焼き込む。
要約は必ず元投稿へリンクし、原典に敬意とトラフィックを返す。

### 2軸の分類
- `topic`（何の話か）: workload / salary / career / certification / culture
- `resonance`（どう刺さるか）: aruaru（あるある）/ moyamoya（もやもや）/ null
- resonanceが立つほど「共感」寄り、topicがcertification・career寄りほど「制度・教育」寄り。
  投稿の反応がどちらに寄るかの計測軸そのものになる。

### `origin_country`（投稿者の発信元国）
ISO 3166-1 alpha-2小文字（例: `"us"`, `"ng"`）。`data/us/`のような
サイト区分としての「国」（`voicesPath(country)`）とは別概念で、投稿者個人の
所在国を指す。日本語要約だけだと「海外の声」という新鮮さが失われるため、
フロント（`src/scripts/feed.client.mjs`）が国旗＋プラットフォーム名（Reddit/X）の
ピルをカードに描画するのに使う。自動パイプラインは`r/medlabprofessionals`が
米国中心のため常に`"us"`を刻む。手動投入時は投稿者のプロフィール等から推定し、
不明なら`"us"`にフォールバックする。

## 使い方（日常運用）

### 「現場の声」を増やす

3つの経路がある。

1. **自動（Reddit）**: `r/medlabprofessionals`の新着投稿をGitHub Actionsが自動取得・要約
   （`daily.yml`）。ただしReddit公式Data APIの承認が下りるまでは`.json`エンドポイントが
   ブロックされているため停止中（詳細は下記「Reddit」の注意書き参照）。
2. **手動（Reddit / LinkedIn）**: 投稿本文＋URLをClaude Codeとのチャットに直接貼り付ける。
   `lib/llm.mjs`の`summarizePost()`と同じ制約（title_ja ~20字、summary_ja 2-3文、
   topic/resonanceはtaxonomy準拠、原文はそのまま転載しない）で要約してもらい、
   `data/us/voices.json`に反映する。（`data/inbox/`+`node scripts/process-inbox.mjs`という
   コピペ→スクリプト実行の経路も残っているが、LLM APIコストの節約のため現在は
   チャット内で直接要約する運用が主）
3. **手動（X/Twitter）**: Claude Codeに「Xの投稿探して」のように頼むと
   `find-voices` Skill（`.claude/skills/find-voices/SKILL.md`）が起動し、ブラウザで
   Xを検索・求人スパムや宣伝投稿を除外・要約までを一通り行う。LinkedIn同様、
   Xも認証なしの公開JSONエンドポイントが無く自動収集はできないため、この
   ブラウザ経由の手動投入が唯一の手段。

いずれの経路でも、要約後は`npm run build`で疎通確認 → 要約内容をレビュー →
`git commit` / `git push`（明示的に指示してから）という流れで進める。

### 求人を更新する

`node scripts/fetch-jobs.mjs`（Adzuna API、`ADZUNA_APP_ID`/`ADZUNA_APP_KEY`が必要）。
GitHub Actionsの`daily-jobs.yml`から`workflow_dispatch`で手動実行もできる。

### データを更新してもNetlifyの再デプロイは走らない

`data/*.json`をpushしても、Netlifyの本番デプロイは走らない
（`netlify.toml`の`ignore`ルールで`data/`だけの変更はスキップされる）。
フロントは`src/scripts/feed.client.mjs`がGitHubの`main`ブランチから実行時に
fetchする構成のため、pushしてから数分（raw.githubusercontent.comのキャッシュ）で
サイトに反映される。**コード（`src/`・`lib/`・設定ファイル等）を変更したときだけ**、
通常通りNetlifyが再ビルド・再デプロイする（1回15クレジット消費、月300クレジットの
共有枠を他サイトとも分け合っているため頻度に注意）。

## セットアップ

1. Reddit は**認証なしの公開JSONエンドポイント**（`https://www.reddit.com/r/xxx/top.json`）を使う。
   script アプリの登録は不要。具体的な `REDDIT_USER_AGENT` を用意するだけでよい。
   ※ 2026年に Reddit が Responsible Builder Policy を導入し、script アプリの
   セルフサーブ新規作成が実質ブロックされたための代替。非商用・低頻度なら
   無料枠で足りるが、**着手前に現行の規約・レート制限を確認**。将来レート制限や
   ブロックに当たった場合は Reddit の公式データAPI申請（非商用向け）に切り替える。
2. LLMは **GLM**（智譜AI/Zhipu AI、`glm-4.7-flash`、`response_format: json_object`でJSON強制）を使用。
   2026-07-11にGemini（クォータ超過で `daily-jobs` が停止）から切替済み。
   [bigmodel.cn](https://bigmodel.cn/) でAPIキーを発行し `LLM_API_KEY` に設定。
   別プロバイダに替えたい場合は `lib/llm.mjs` の `callLLM()` を差し替える。
3. Telegram: BotFather でボットを作りトークン取得（ボット名も `chillmeru_bot` 等に揃えると統一感が出る）、自分の chat_id を控える。
4. Adzuna（求人）: https://developer.adzuna.com/signup でメール登録すると
   `app_id` / `app_key` が即時発行される。無料枠・非商用利用可だが、
   **求人数・平均給与などの集計を継続的に表示するには書面の許可が必要**（利用規約）。
   Chillmeruは個別求人へのリンクバックのみ表示し、集計は行わない設計。
5. 下記を GitHub リポジトリの **Secrets** に登録。

### 必要な Secrets
```
REDDIT_USER_AGENT   例: chillmeru/0.1 by u/yourname
LLM_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
ADZUNA_APP_ID
ADZUNA_APP_KEY
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

承認待ちの間は、Reddit以外の各連携（下記）とフロントエンドの検証・開発を進められる。
`data/us/voices.json` には現在、上記「使い方（日常運用）」の手動投入経路で
追加してきた実データが入っている（自動パイプライン停止中でも空にはならない）。

#### つなぎ: 手動投入（`scripts/process-inbox.mjs`）

承認が来るまでの間、ブラウザで手動でReddit投稿を読んで日本語要約を
反映させる手段。`data/inbox/voices.txt` にコピペで貯めて実行すると、
自動取得パイプラインと同じLLM要約・スキーマで `data/us/voices.json` に
追記される。

```
LLM_API_KEY=... node scripts/process-inbox.mjs
```

- `data/inbox/voices.txt` は **git管理していない**（`.gitignore`）。
  原文を一時的にでもリポジトリ（public）に残さないため。要約後の
  JSON（`data/us/voices.json`）だけがcommit対象になる。
- 実行すると要約結果がターミナルに表示されるので、そこで内容を確認できる。
- 実行後、inboxは自動でテンプレートに戻る（次のコピペに備える）。
- 既出URL（`/comments/<id>/` から復元したidが一致）は自動でスキップされる。
- フォーマットはinboxファイル自体にコメントとして書いてある
  （`URL:` / `TITLE:` / `SCORE:` / `COMMENTS:`(省略可) / `BODY:`）。

### LLM（GLM要約）

`LLM_API_KEY`（GLM/bigmodel.cnのAPIキー）の Secret だけ登録すれば動く。
Redditアクセスはブロックされていないので通常の `ubuntu-latest` でそのまま動く。

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

### Adzuna（求人）

`ADZUNA_APP_ID` / `ADZUNA_APP_KEY` を登録すれば動く。Reddit問題とは無関係に
通常の `ubuntu-latest` でそのまま動く。

- **GitHub 上で**: Actions → **check-adzuna** → *Run workflow*
  （`.github/workflows/check-adzuna.yml`）。
- **ローカルで**: 環境変数を渡して `node scripts/check-adzuna.mjs`。

## ローカル実行

フロントエンド（Astroビルド）:
```
npm install
npm run dev       # http://localhost:4321 で確認
npm run build     # dist/ に静的出力
```

データパイプライン:
```
node scripts/fetch-voices.mjs   # 現場の声（Reddit）
node scripts/fetch-jobs.mjs     # 求人（Adzuna）
```
（上記の環境変数を渡した状態で。手動ならActionsの「Run workflow」でも可）

## デプロイ（Netlify）

1. https://app.netlify.com → **Add new site → Import an existing project**
2. GitHubを選び、`chillmeru` リポジトリを選択
3. ビルド設定は `netlify.toml` に同梱済み（`npm run build` / 公開ディレクトリ `dist`）
   なのでそのまま **Deploy** でよい
4. 初回デプロイ後、`<サイト名>.netlify.app` のURLが発行される
   （`chillmeru.netlify.app` を希望する場合は Site settings → Change site name）
5. コード（`src/`・`lib/`・設定ファイル等）を変更してpushしたときだけ自動で
   再ビルド・再デプロイされる。`data/*.json` だけの変更（自動パイプライン・
   手動投入コミット）は `netlify.toml` の `ignore` ルールでビルド自体がスキップされる
   （データはフロントが実行時にGitHub `main` からfetchするため再デプロイ不要。
   詳しくは上記「使い方（日常運用）」参照）。

## 投稿フロー（MVP）

サーバーレスなのでTelegramのボタン押下を受け取る常駐先がない。よって完全自動ではなく:
1. パイプラインが新着から1件選び、投稿文（＋将来は画像）をTelegramに送る
2. 「Xで開く」リンクで投稿画面を開き、最終チェックして手で投稿

真のワンタップ自動投稿は、量が増えて **X従量API**（2026年時点でリンク付き投稿は1件$0.20）を
入れる段で、受け口（小さな常駐）と一緒に足す。それまでは手動で品質（冒頭2秒）を守るほうが得。

## 拡張の足し方
- **国を増やす**: `data/uk/` を作り、スクリプトの `COUNTRY`/`SUBREDDIT` を分岐
- **求人（Adzuna）**: `scripts/fetch-jobs.mjs` / `data/us/jobs.json` として実装済み
- **給与統計（e-Stat・BLS）**: 別スクリプト＋別JSONを足すだけ（今後の拡張）
- **通知先を増やす**: `notify*` 関数を足す。n8nは不要、ステップを増やすのがコードでの拡張性

## 注意
- cronはUTC。無料Actionsは起動が数分ずれる／60日無活動でスケジュール停止に注意。
  時刻厳守なら Cloudflare Workers Cron が素直。
- 広告運用に振ると商用扱いになりAPI規約の前提が変わる。MVPは非商用で通す。
- 名前「Chillmeru」は独自ドメイン（chillmeru.app 等）・X/GitHubハンドルの
  実際の空き状況を未確認（要・本人チェック）。取得済みでない前提で運用中。
