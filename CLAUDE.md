# CLAUDE.md — Claude Code 向けプロジェクトガイド

このリポジトリは **Chillmeru** のMVPスキャフォールド。詳細な設計意図は README.md 参照。

## 一言で
日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる、
サーバーレス・gitネイティブな日次更新コンテンツサイト。読み取り専用。

## セッション引き継ぎメモ（2026-07-11時点、状況が変わったら更新/削除してよい）
- **daily-jobsの429対策**（2026-08-29）: 8月後半、`daily-jobs`が断続的に失敗していた
  （8/20-24, 8/27-29）。原因はモデルの変更ではなく、GLMが返す
  `429 code 1305`（该模型当前访问量过大＝無料枠のflashモデルが混雑中）。
  問題の本体はGLM側ではなく`scripts/fetch-jobs.mjs`の作りにあり、20件中1件でも
  429で落ちると`main().catch()`でプロセスごと終了し、**それまでに成功していた
  要約が全部捨てられていた**（`writeFile`がループの後ろにあるため）。対策として
  (1)`summarizeJob`をtry/catchで包んで失敗分だけスキップ（スキップした求人は
  jobs.jsonに入らない＝次回もseenに含まれず自動で再挑戦される）、
  (2)全滅時（新着>0かつ成功0）だけ明示的にexit 1、(3)リトライ待ちを
  1s/3s→5s/15s/30s/60sの5回に延長、(4)要約に25分のwall-clock budget（正常時の
  所要は11〜13分なので、暴走時だけ効く値）、(5)リトライのたびにモデルを
  `glm-4.7-flash`↔`glm-4.5-flash`で切り替え。
  **モデル候補は必ず実測してから足すこと**: `gh workflow run check-llm.yml
  -f model=<id>`（`--ref <branch>`でブランチ指定可）で、そのモデルIDが実際に
  このAPIキーで通るか確認できる。ドキュメントに無料と書いてある
  `glm-4-flash-250414`は、実際には`400 code 1211 模型不存在`で使えなかった。
  当て推量のモデルIDを入れると、429と見分けのつかない別の失敗経路が増えるだけになる。
  逆に`glm-4.5-flash`は、`glm-4.7-flash`が5回連続429だったのと同じ時刻に
  1回目で通った（混雑がモデル単位で起きる証拠）。
  **cronは変えていない**: 当初はGitHubのスケジュール遅延（実測15分〜8時間）で
  中国時間の日中＝GLM混雑帯に着地するのが原因かと考えたが、実行時刻と失敗は
  相関しなかった。定刻付近（UTC 21:4x〜21:5x＝中国05時台の深夜）の6回でも
  2勝5敗で失敗しており、時間をずらしても429は避けられない。
- **手動投入の運用が変わった**: `LLM_API_KEY=... node scripts/process-inbox.mjs`ではなく、
  **Claude Codeとの対話セッション内で直接 `data/inbox/voices.txt` を読んで要約する**
  運用に切り替え済み（LLM APIコスト・Netlifyデプロイプレビューのビルド分数、両方の節約が目的）。
  やり方: 投稿本文（URL込み）をチャットに貼る → Claudeが`lib/llm.mjs`の`summarizePost()`と
  同じ制約（title_ja ~20字、summary_ja 2-3文、topic/resonanceはtaxonomy準拠）で要約 →
  `lib/voicesStore.mjs`の`mergeVoices()`/`writeVoicesAndMeta()`と同じロジックで
  `data/us/voices.json`/`data/meta.json`に反映 → 内容確認 → commit/push。
  `data/inbox/voices.txt`はgit管理外なので、リモートセッションとローカルとで別ファイル
  （中身は共有されない）。貼るのはチャット本文に対してであり、ファイル経由ではない。
- **LLMプロバイダをGeminiからGLMに切替済み**（2026-07-11）: `daily-jobs`実行中に
  Geminiが`429 quota exceeded`（クォータ超過・課金プラン起因、リトライでは解決しない）
  で恒久的に失敗したため、`lib/llm.mjs`を智譜AI/Zhipu AIの GLM（`glm-4.7-flash`、
  `https://open.bigmodel.cn/api/paas/v4/chat/completions`）に全面切替。
  環境変数名は`LLM_API_KEY`のまま流用（呼び出し側`summarizePost`/`summarizeJob`は無変更）。
  GitHub Secretsの`LLM_API_KEY`はGLMキーに差し替え済み（`daily-jobs`が実際に
  GLMへ到達して429を返している＝認証は通っていることで確認、2026-08-29）。
  GeminiのresponseSchemaと違いGLMの`response_format: json_object`はJSON構造までは
  強制しないため、期待する形はプロンプト文面に明記し、受け取り側の検証
  （`TOPICS.includes()`等）で安全側に倒している。
- **求人カードのスキーマを分割済み**: `summary_ja`単一フィールドから`content_ja`
  （業務内容）/`qualification_ja`（資格・待遇）の2フィールドに変更し、
  `JobCard.astro`で内容／報酬／資格のラベル付きスペック表示にした。
- **現状のブランチ・PR状態**: `main`はAdzuna統合まで。以下2つは**まだmainに未マージ**（要ユーザー承認）:
  - PR #7 `fix/llm-retry-transient-errors`（LLMリトライ実装。同内容を`feat/manual-inbox`にも
    直接コミット済みなので、PR#7自体は将来マージしても実質差分なしになる見込み）
  - PR #8 `feat/manual-inbox`（手動投入パイプライン一式 + 手動処理した現場の声10件のデータ
    + 求人スキーマ分割 + LLMリトライ + GLM切替）
  **本番サイトにはまだ出ていない**（PR未マージのため）。
- **フロントのデータ取得をビルド時importからランタイムfetchに変更済み**（2026-07-12）:
  Netlifyは1デプロイ15クレジット消費・月300クレジット上限（他のLPサイトとも共有）のため、
  `data/*.json`を更新するたびに再デプロイしたくないという制約から設計変更した。
  `src/pages/index.astro`は`data/us/voices.json`等をもう`import`しない。代わりに
  `src/scripts/feed.client.mjs`が`https://raw.githubusercontent.com/matdonaruno/Chillmeru/main/data/...`
  をブラウザから直接fetchし、カードのHTML生成・トピックフィルタ配線まで行う
  （`VoiceCard.astro`/`JobCard.astro`は不要になったため削除、アイコンデータは
  `lib/icons.mjs`に切り出してAstro側とクライアント側で共有）。raw.githubusercontent.comは
  数分キャッシュなので手動投入→push後すぐ反映される（jsDelivrは時間単位キャッシュなので不採用）。
  対になっているのが`netlify.toml`の`ignore`ルール：`data/`だけの変更（自動パイプライン・
  手動投入コミット）ならNetlifyはビルドをスキップする。コード変更時は通常通りデプロイされる。
  **今後**: 手動投入で`data/us/voices.json`等を更新してpushするだけでよく、
  Netlify再デプロイは発生しない（コードを変えない限り）。
- **LinkedInは情報源として不採用（自動取得は不可）**: Redditと違い認証不要の公開JSON
  エンドポイントが存在せず、公式APIもパートナー限定でコンテンツ読み取りのセルフサーブがない。
  スクレイピングは規約違反かつ`lib/reddit.mjs`のヘッダー偽装を採用しなかった判断（意図的な
  対策すり抜けは不採用）と矛盾するため見送り。ただし手動投入パイプラインはソースを問わないので、
  LinkedIn投稿もReddit投稿と同様に**チャットに貼り付けてもらえば同じ運用で処理可能**。
- **Xは`find-voices` Skillで手動投入に対応**（2026-07-12）: `.claude/skills/find-voices/SKILL.md`。
  `claude-in-chrome`ブラウザ拡張でXを検索・閲覧して要約する運用（このセッション限りの手段で、
  GitHub Actionsの自動デイリー実行からは呼べない）。当たりの良い検索パターン・避けるべき
  ノイズ（求人スパム、ハッシュタグ単体検索の宣伝投稿、看護学生の"clinical lab"誤検出）を
  Skill内に記録済み。Reddit公式Data API申請は却下されたため、Xとブラウザ手動投入は
  今後もつなぎではなく本線の運用として継続する。
- **Voice型に`origin_country`を追加**（2026-07-12、`lib/types.ts`）: ISO 3166-1 alpha-2小文字。
  日本語要約だけだと「海外の声」という新鮮さが失われるため、`src/scripts/feed.client.mjs`が
  国旗＋プラットフォーム名（Reddit/X）のピルをカードに描画する。自動パイプライン
  （`scripts/fetch-voices.mjs`）は`r/medlabprofessionals`が米国中心のため常に`"us"`を刻む。
  手動投入時は投稿者のプロフィール等から推定し、不明なら`"us"`にフォールバック。
- **基本的なSEO対応を追加**（2026-07-12）: `@astrojs/sitemap`導入（`astro.config.mjs`、
  ビルド時に`sitemap-index.xml`/`sitemap-0.xml`を生成）、`public/robots.txt`
  （sitemapへのリンク付き）、canonical link、OGP（og:url/site_name/locale/image）、
  Twitter Card（summary_large_image）、`WebSite`のJSON-LD構造化データを`index.astro`に追加。
  og:imageはスプラッシュと同じ写真（bg-08）を1200px幅で書き出して使い回している。
  ユーザーが所有する`~/.claude/skills/nextjs-static-seo-llmo/SKILL.md`はNext.js App Router
  static-export専用（`robots.ts`/`sitemap.ts`のforce-static、Firebase Hosting等）のため
  このAstroプロジェクトには直接適用せず、その中の一般的なSEOチェックリスト部分だけを
  Astro流に実装した。GA4/Consent Mode・hreflang多言語・llms.txt・セキュリティヘッダーは
  現状のスコープ外（アナリティクス未導入、日本語単一ページ、独自ドメイン未取得のため）。

## 今のところ動くもの / 動かないもの
- Reddit取得（`lib/reddit.mjs`）は認証なしの公開JSONエンドポイントで実装済み・
  スモークテスト（`scripts/check-reddit.mjs` / `.github/workflows/check-reddit.yml`）あり。
  2026年の Reddit Responsible Builder Policy で script アプリの新規セルフサーブ
  作成が実質ブロックされたため、OAuth（password grant）は不採用にした経緯がある。
  **実測済みの問題**: `ubuntu-latest` ランナーIPだけでなく、self-hosted runner
  （自宅Mac、住宅回線IP）からも403/429で一律ブロックされる。curlでブラウザ風
  ヘッダーを付けても403のままな一方、実ブラウザでは開けるため、TLS指紋レベルの
  ボット判定と推定（ヘッダー偽装での回避は意図的な対策すり抜けになるため不採用）。
  **Reddit公式の非商用Data API申請は却下された**（2026-07-21付、Reddit Support）。
  却下理由は「Responsible Builder Policy不遵守および/または詳細不足」という定型文のみで、
  具体的な指摘なし。申請文面自体もどこにも保存しておらず検証不能だった
  （反省点、[[feedback_save_external_submissions]]相当）。Devvit（Reddit公式アプリ基盤）
  経由の自動化も調査の結果、データアクセスがモデレーション目的の利用に限定されており
  対象外と確定。ヘッドレスブラウザでのスクレイピング、Zapier/n8n系の外部SaaS中継も
  それぞれ「bot対策の意図的すり抜け」「既存のn8n不使用方針と矛盾」で不採用と判断した。
  **2026-08-14、`claude-in-chrome`（対話に紐づくログイン済み実ブラウザ）経由なら
  `old.reddit.com`が403なしで問題なく読めることを確認済み**。無認証プログラムへの
  ボット判定であって、人間のブラウジング自体を禁じる規約ではないと判断し、これを
  Redditの**恒久的な本線**として採用（`.claude/skills/find-voices/SKILL.md`に手順化済み）。
  `oauth.reddit.com`経由のOAuth復帰は当面見込まない。`scripts/process-inbox.mjs`
  （手動投入パイプライン）も引き続き併用し、ブラウザで読んだ投稿を
  `data/inbox/voices.txt` にコピペで貯め、まとめてLLM要約→`data/us/voices.json`に反映する。
  inboxはgit管理外（原文をリポジトリに残さないため、下の設計制約と同じ理由）。
  **`daily.yml`（daily-voices、Reddit自動取得cron）は2026-08-15に`gh workflow disable`で
  無効化済み**。直近8日連続で`Error: reddit fetch 403`で失敗し続けており、復活の見込みが
  ないため。ファイル自体は残しているので、将来また自動化の目処が立てば
  `gh workflow enable daily.yml`で戻せる。`daily-jobs.yml`（Adzuna求人取得）は無関係で
  正常稼働中（`daily-jobs`はactiveのまま）。
- LLM要約（`lib/llm.mjs`、GLM `glm-4.7-flash`、`response_format: json_object`でJSON強制）と
  Telegram通知（`lib/telegram.mjs`）は実装済み。それぞれ単体スモークテストあり
  （`scripts/check-llm.mjs` / `scripts/check-telegram.mjs` とその workflow）。
  未検証なのは実際のAPIキーでの動作確認のみ（README「各連携を単体で確認する」参照）。
- フロントエンド（`src/pages/index.astro`、Astro/SSG）は実装済み。モバイルファーストの
  グラスモーフィズムUI（ダーク固定）、「現場の声」/「求人」のタブ切り替え、topicタブ・
  resonanceバッジ・給与レンジバッジ。Netlifyにデプロイ済み（`chillmeru.netlify.app`）。
- 求人（`lib/adzuna.mjs`、Adzuna API）は実装済み・スモークテストあり
  （`scripts/check-adzuna.mjs` / `.github/workflows/check-adzuna.yml`）。
  `daily-jobs.yml` で独立して動く（Reddit側の問題と無関係）。**利用規約により
  個別求人へのリンクバックのみ表示し、求人数・平均給与などの集計は行わない**
  （フロントにも実装しない。徹底すること）。未検証なのは実際のAPIキーでの
  動作確認のみ。

## 次にClaude Codeにやってほしそうなタスク（優先順）
1. ADZUNA_APP_ID/KEY を使った `check-adzuna` の動作確認、
   LLM_API_KEY / TELEGRAM_BOT_TOKEN・CHAT_ID を使った `check-llm` / `check-telegram`
   の動作確認
2. （保留）Reddit Data API再申請の要否をユーザーと相談。申請するなら却下理由
   （Responsible Builder Policy不遵守/詳細不足という定型文のみ）を踏まえ、
   ユースケースの説明をより具体化する必要がある。当面はfind-voices Skill経由の
   手動投入（X）と`process-inbox.mjs`（Reddit含む）が本線。
3. 給与統計（e-Stat / BLS）の取得スクリプトを追加。BLSはSOCコード`29-2011`
   （Medical and Clinical Laboratory Technologists）だがOEWSのseries ID組み立てが複雑、
   e-Statは統計表ID（statsDataId）を年度ごとにポータルで確認する必要があり、
   どちらも実装→ワークフロー実行→ずれを直す、の反復が必要な見込み

## Git運用（2026-08-16決定）
- **長寿命の作業ブランチを使い回さない**。`feat/manual-inbox`をsquash mergeで
  何度もmainに統合しつつ同じブランチで作業を継続していたところ、squash merge後は
  mainとそのブランチの間に祖先関係がなくなるため、次にPRを作るたびにgitが古い
  共通祖先までdiffを取り直し、実質同一内容のファイルでも機械的にマージコンフリクトを
  起こすようになった（PR#9, #10で連続発生。詳細は`.claude/`外だが、セッションの
  プロジェクトメモリ`feat-manual-inbox-status.md`参照）。`feat/manual-inbox`は
  2026-08-16に削除済み。
- **今後は変更ごとに使い捨てブランチを切る**: `main`から都度新しいブランチ
  （例: `data/2026-08-16-voices`、`docs/xxx`）を作り、PRをsquash mergeしたら
  ローカル・リモートとも即削除する。次の変更ではまた`main`から新しく切る。
  同じブランチを2回以上のPRにまたがって使い回さないこと。

## 変更してはいけない設計上の制約
- **原文bodyを保存・表示しない**。`Voice` 型（`lib/types.ts`）は要約のみ持つ。
  著作権・API規約対策としてスキーマに焼き込んである。緩めない。
  手動投入用の `data/inbox/` も同じ理由でgit管理外（`.gitignore`）にしてある。
  ここに新しい「原文を扱う」経路を足すときは、必ずgit管理外にすること。
- **topic / resonance の値は `lib/taxonomy.mjs` が唯一の正**。
  スクリプト・フロントとも直接文字列をハードコードせずここを import する。
- **Adzunaの求人データは集計しない**（求人数・平均給与・トレンド等）。
  利用規約で継続的な集計表示に書面許可が必要なため。個別求人カードのみ表示する。
- **n8n / Supabase は使わない**方針で確定済み（README参照）。
  オーケストレーションはGitHub Actions cron、ストレージはリポジトリ内JSON。
- 投稿は **ドラフト生成＋Telegram通知＋手動投稿**がMVPの形。
  完全自動化（X従量APIでの自動ポスト）は将来の拡張として、今回は実装しない。

## 命名
- サービス名: **Chillmeru**（チルメル）。旧仮称「世界のラボ」からの改名済み。
  ディレクトリ名 `sekai-no-lab` は working title の名残で、リポジトリ名は
  移行時に `chillmeru` へ変えて差し支えない。
- 独自ドメイン・SNSハンドルの実際の空き状況は未確認（README参照）。
