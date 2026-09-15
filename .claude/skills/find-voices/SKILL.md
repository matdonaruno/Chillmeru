---
name: find-voices
description: >-
  Chillmeru（臨床検査技師向け「現場の声」サイト）向けに、Reddit/X/LinkedInから
  面白い・共感できる投稿を探して要約し、data/us/voices.json に手動追加するプレイブック。
  「Xの投稿探して」「Redditで良い投稿ないか探して」「現場の声を追加して」
  「voicesに新しいの足して」のような依頼で使う。追加した声は、vaultのSNSネタ帳（投稿メモ）と
  sns_operation/handoff（X投稿文）にも渡すところまでが1セット。「sns_operationに渡して」
  「voicesを投稿メモにして」のような依頼にも使う。Reddit公式Data API申請は却下済みで、
  この対話内ブラウジングによる手動投入がReddit取得の恒久的な本線運用。
---

# 現場の声を探して追加する（find-voices）

Reddit/X/LinkedInを見て「あるある」「もやもや」に刺さる臨床検査技師の投稿を見つけ、
Chillmeruの`data/us/voices.json`に要約として追加するプレイブック。

## 見つけた投稿の渡し方（LinkedIn・その他手動ソース共通）

**投稿のURLと本文をこのチャットにそのまま貼るだけでいい。** テンプレも
ファイルも不要。`data/inbox/voices.txt`は使わない（そちらは
`process-inbox.mjs`用の別経路で、この対話内での運用では使わない）。

**スクリーンショットではなくテキストで受け取ること。** 2026-08-29に検索結果の
スクショを4枚もらったが、フィード全体を縦長に撮った画像は縮小率が高く、1枚目
以外は本文がまったく判読できなかった。要約は本文が読めないと書けないので、
画像で渡されたら「URLと本文をテキストで」と頼み直す。ユーザーに撮り直しを
させるより、コピペの方が早くて確実。
貼られたら、この後の「3. Voiceオブジェクトを組み立てる」の表に沿って
Claudeが要約案を作り、確認を取ってから`data/us/voices.json`に反映する。

## 前提・変更してはいけない制約（CLAUDE.md参照）

- **原文は保存・転載しない**。要約のみ（`summary_ja`は言い換え、本文コピペ厳禁）。
- **topic/resonanceは`lib/taxonomy.mjs`の値のみ**使う。ハードコード禁止。
- **commit/pushは必ずユーザーに確認してから**。要約案を提示 → 内容確認 →
  OKが出たら`data/us/voices.json`/`data/meta.json`を更新 → `npm run build`で疎通確認
  → それでもcommit/pushは指示されるまで実行しない。

## できること・できないことの前提

Reddit/Xの検索・閲覧は、この対話に紐づく`claude-in-chrome`ブラウザ拡張で行う。
これは**このセッション限りの手段**であり、GitHub Actionsの自動デイリー実行
（`daily.yml`）からは呼び出せない。つまりこのSkillは「手動投入の一種」であって、
自動収集パイプラインではない。

Reddit公式Data API申請は却下済み（2026-07-21、理由は定型文のみで不明）。
`lib/reddit.mjs`の無認証JSON/RSSエンドポイントもTLS指紋レベルのボット判定で
GitHub Actions・自宅回線どちらからも403/429ブロックされる（README「Reddit」参照）。
一方で`claude-in-chrome`（ログイン済みの実ブラウザセッション）経由なら
`old.reddit.com`のsubreddit一覧・検索・個別投稿・コメントすべて問題なく読める
ことを2026-08-14に確認済み。これは無認証の自動プログラムがブロックされる話であって、
人間（に紐づくセッション）が普通にページを読むこと自体を禁じる規約ではないと
判断している。**Redditはこの方式を恒久的な本線として使う**（Data API復活は
見込まない前提）。

**LinkedInには同じ方式を使わない**。LinkedInの利用規約は「自動化された手段
（拡張機能を含む）でのサービスアクセス」自体を明示的に禁止しており、
実際にそれっぽい挙動でアカウント凍結された事例も多い。Redditの場合は
無認証プログラムのボット判定の話でしかなく規約上の制約ではなかったのに対し、
LinkedInは規約でアカウント単位のリスクがある。LinkedInは今まで通り
**チャットへの手動貼り付けのみ**で対応する。

## 手順

### 1. Reddit/X/LinkedInを検索する

**Reddit**（`mcp__claude-in-chrome__*`、事前に`ToolSearch`でロード）:
- `https://old.reddit.com/r/medlabprofessionals/top/?sort=top&t=week`のように
  sort/期間を変えてnavigateする。`old.reddit.com/r/<sub>/search?q=...&restrict_sr=on`
  でサブレディット内検索もできる。
- **本命**: `r/medlabprofessionals`（自動パイプラインと同じソース）。
- **ネタが少ない時のフォールバック**（実在確認済み、2026-08-14）:
  `r/medlabtechs`・`r/MLS_CLS`・`r/medlab`・`r/medlabcirclejerk`
  （「no filter」を謳う分、本音の愚痴は拾いやすいが下品な表現も混じるので
  要約時に選別する）・`r/MedLabInCanada`（`origin_country: "ca"`の候補になる）。
  `r/labrats`は臨床検査ではなく研究室全般向けで読者層がずれるため対象外。
- 投稿本文の正確な投稿日時は`get_page_text`ではなく`javascript_tool`で
  `document.querySelector('time.live-timestamp')?.getAttribute('datetime')`
  を実行してISO8601を取得し、`created_utc`の算出に使う（「2 days ago」等の
  相対表記は暗算しない）。

**X**（`mcp__claude-in-chrome__*`、事前に`ToolSearch`でロード）:
- `https://x.com/search?q=<query>&f=live` の形で直接navigateする。
- **当たりが良かったクエリの型**: `"clinical lab" (exhausted OR short-staffed OR "no one understands")`
  のような「業界特有の名詞」+「本音の感情語」の組み合わせ。
- **ノイズが多い/避けるべきパターン**:
  - `#medlab` `#labtwitter` などのハッシュタグ単体検索 → 学校の宣伝、
    「Happy Lab Science Day」的な当たり障りない投稿、ポッドキャスト宣伝が大半。
  - `"medical laboratory scientist"` のプレーンフレーズ検索 → ナイジェリア等の
    求人ボットスパムに埋め尽くされる。
  - `"clinical lab"`は看護学生の実習（"clinical rotation"の意味）にもヒットする
    誤検出があるので、投稿者プロフィールが看護学生でないか確認する。
- 個別ポストのpermalinkは、投稿の日時リンク（例: `Apr 5`）の`href`から
  `/USERNAME/status/TWEET_ID`を取得する（`read_page`の`filter: "interactive"`で拾える）。

**LinkedIn**（claude-in-chromeは使わない。ユーザー自身のブラウザで探してもらう）:
- 下記の検索URLをクリックして開き、良さそうな投稿が見つかったら
  URLと本文をこのチャットに貼ってもらう（貼り方は上の「見つけた投稿の渡し方」参照）。
- **職種を一意に特定するフレーズだけを使う**（LinkedInの投稿検索は
  `/search/results/content/?keywords=`形式。引用符のフレーズ検索は効くが、
  `NOT`等のブール除外は効かない前提で組むこと）:
  - [`"medical laboratory scientist" burnout`](https://www.linkedin.com/search/results/content/?keywords=%22medical%20laboratory%20scientist%22%20burnout)
  - [`"clinical laboratory scientist" understaffed`](https://www.linkedin.com/search/results/content/?keywords=%22clinical%20laboratory%20scientist%22%20understaffed)
  - [`"medical laboratory technologist" undervalued`](https://www.linkedin.com/search/results/content/?keywords=%22medical%20laboratory%20technologist%22%20undervalued)
  - [`"MLS ASCP"`](https://www.linkedin.com/search/results/content/?keywords=%22MLS%20ASCP%22)（資格名。当事者しか書かないので純度が高い）

- **使ってはいけない語**（2026-08-29に実地で確認）:
  - `"medical technologist"` … 英語圏では**放射線技師**（radiologic technologist /
    MRT）を指す文脈で広く使われ、検索結果がradiology・imaging系で埋まる。
  - `"lab tech"` … 研究室の技術員・歯科技工士なども拾う。
  - `"clinical lab"` … 看護学生の実習（clinical rotation）に誤ヒットする
    （Xでの既知の問題と同じ）。
- **実地の結果（2026-08-29）**: 上記の旧クエリで検索したところ、拾えたのは
  求人代行・RPO・ニュースレターの企業宣伝、放射線技師の投稿、当事者でない人が
  書いたバーンアウト啓発文（リアクション一桁）ばかりで、**臨床検査技師本人の
  本音投稿はゼロだった**。LinkedInは啓発的・前向きな内容に偏るうえ、職種の
  境界が曖昧なので、Reddit/Xより密度は明確に低い。**Redditを先に当たり、
  LinkedInは余力があれば見る程度でよい**。

### 2. 投稿を評価する（スパム除外の判断基準）

- 個人の本音・実体験・ジョークか？ 企業/求人代行/宣伝アカウントではないか？
- 日本の読者が読んで「あるある」「もやもや」「へえ」と思える具体性があるか？
- 汎用的すぎる啓発文（「〇〇の日おめでとう」等）は基本的に見送る。

### 3. Voiceオブジェクトを組み立てる（`lib/types.ts`の`Voice`型に準拠）

| フィールド | 決め方 |
|---|---|
| `id` | `x_<tweet_id>` / `reddit_t3_<id>` / LinkedInは`linkedin_<activity_id>`（URL中の`-activity-<数字>-`から抽出、取れなければURLのハッシュで代用） |
| `url` | 投稿の恒久リンク（permalink） |
| `origin_country` | ISO 3166-1 alpha-2小文字。プロフィール（所属団体等）や文脈から推定。不明なら`"us"`にフォールバック |
| `title_ja` | 全角20字程度の見出し |
| `summary_ja` | 2〜3文の要約（言い換え、原文転載しない） |
| `topic` | `lib/taxonomy.mjs`の`TOPICS`から選ぶ |
| `resonance` | `RESONANCES`から選ぶ、当てはまらなければ`null` |
| `score` | Xなら「いいね」数、Redditなら投稿スコア（upvote）、LinkedInなら「いいね」等のリアクション数。不明なら見た目の反応量から妥当な値を入れる（0で埋めない） |
| `num_comments` | Xなら返信数、Redditならコメント数、LinkedInならコメント数 |
| `created_utc` | UNIX秒。**暗算せず**`date -j -u -f "%Y-%m-%d %H:%M:%S" "YYYY-MM-DD HH:MM:SS" +%s`（macOS）で正確に算出する |
| `fetched_at` | 現在時刻のISO8601（`date -u +%FT%T.000Z`等） |

`origin_country`はフロント（`src/scripts/feed.client.mjs`の`flagEmoji()`/`platformLabel()`/`sourceLabel()`）が
国旗＋プラットフォーム名のピルを自動描画するために使う。日本語要約だけだと
「海外の声」という新鮮さが失われるため追加した項目（2026-07-12）。未設定でも
`🌐`にフォールバックするので壊れはしないが、必ず埋めること。

### 4. マージして書き出す

`lib/voicesStore.mjs`の`mergeVoices()`/`writeVoicesAndMeta()`と同じロジック
（新着を先頭に、`created_utc`降順、`data/meta.json`の`counts.us`・`updated_at`を更新）で
`data/us/voices.json`を直接編集する。dedupeキーは`id`。

### 5. 検証してから確認を取る

1. `npm run build`で疎通確認。
2. 追加した要約案（title_ja/summary_ja/topic/resonance/出典URL）を一覧で
   ユーザーに提示し、**内容を確認してもらう**。
3. commit/pushは明示的に指示されてから実行する。

### 6. SNS素材として渡す（vault投稿メモ＋sns_operation handoff）

**要約の内容をユーザーが確認したら、そのバッチの声を毎回SNS側に渡す。** サイトに載せただけで
終わらせない（2026-09-04・09-14の9件はこの手順がなかったため、09-15まで渡し漏れていた）。
事実源は**確認済みの`summary_ja`だけ**。英語原文を読み直して情報を足さない。

**6-1. vault に投稿メモを書く**（obsidian-idea-engine → opost の取り込み経路）

- 置き場所: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian-IdeaVault/02-PROJECTS/Chillmeru/`
- **1ノート1テーマ**。バッチの声をテーマでまとめる（複数の声を横断した切り口に価値がある）。
  1本だけで強い声は単独ノートでよい。ファイル名は`YYYY-MM-DD-idea-<テーマ>.md`
- 形式は既存ノート（`2026-09-03-idea-asinine-rules.md` / `2026-09-15-idea-*.md`）に揃える:
  frontmatter `type: idea` / `status: seed` / `topic: Chillmeru` / `source:`（URL。複数ならYAML配列）/
  `related: "[[chillmeru-index]]"`、本文は「元ネタ → フックになる切り口 → 具体エピソード
  （要約・言い換え）→ 構成案 → 発信ガード確認」
- 🔴 **tagsに`ai-generated` / `no-ai`を付けない、`07-GENERATED/`に置かない。**
  engineの`selectMemos`が除外するため、opostまで届かなくなる
- `chillmeru-index.md`の「## SNSネタ帳」に1行ずつリンクを足す（新しい順、BIPログとは別セクション）

**6-2. すぐ投稿できるX投稿文を handoff に置く**

- 置き場所: `~/Documents/sns_operation/handoff/chillmeru-voices/`（`README.md` / `posts.md` / `posts.json` / `x-weighted-len.py`）
- 1声 = main（見出し【海外ラボの声 #N】+ 何が起きたか + 出典行`(米Reddit・r/medlabprofessionals)`）
  → followup（コメント欄の反応 + 問いかけ）の2本立て。**`#N`は通し番号**で、既存の続きから振る
- `posts.json`の`posts`に追記し、`batches`にバッチを1件足す。`posts.md`とREADMEの一覧・「次にやること」も更新する
- 🔴 **文字数はXの重み付き長（全角=2）で280以内。** 書いたら`x-weighted-len.py`で全本を検証する
- 本文に生URLを入れない（URL付き投稿は$0.20）。出典はサブレディット名のみ（Xならアカウント名を出さず「米X」等）
- 文体は`~/Documents/sns_operation/x_historu_noAI.txt`（本人の非AI投稿）が正。短い段落、言い差しか問いかけで終える

**発信ガード（6-1・6-2共通）**

- 出典行・「海外」の明示を削らない。消すと投稿者自身の職場の話に読める（匿名性ルール: 職場が割れるのがNG）
- 一人称で自分の職場の話にしない（「うちでも〜」NG）。メーカー名・実製品名を批判的な文脈で出さない
- 告発に読める話（給料未払い等）は出来事だけを書き、原因を推測しない
- 健康・特性の話（ADHD等）は「向いている/向いていない」と一般化しない
- 他職種への不満は投稿者の発言として括弧に入れ、地の文では責めない
- スクリーンショットを添付するならRedditのユーザー名を塗りつぶす

vault・handoffはどちらもChillmeruリポジトリの外なので、commit対象ではない。
**投稿そのものはしない**（投稿は運用側・ユーザーが判断する）。

## 参考: このSkillが生まれた経緯

2026-07-12、Reddit以外の情報源としてX（Twitter）を試した際に作成。LinkedInは
自動取得不可・手動貼り付けのみ対応（規約上スクレイピング不可、公式APIはパートナー
限定）と結論づけ、Xは手動でも「あるある」「もやもや」に刺さる投稿が見つかる
ことを確認した上で、この手順を再現可能にするために作成した。
