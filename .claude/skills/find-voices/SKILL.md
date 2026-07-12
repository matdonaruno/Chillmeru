---
name: find-voices
description: >-
  Chillmeru（臨床検査技師向け「現場の声」サイト）向けに、Reddit/Xから面白い・共感できる
  投稿を探して要約し、data/us/voices.json に手動追加するプレイブック。
  「Xの投稿探して」「Redditで良い投稿ないか探して」「現場の声を追加して」
  「voicesに新しいの足して」のような依頼で使う。Reddit公式APIの審査待ちの間の
  つなぎ運用（手動投入パイプラインの一種）。
---

# 現場の声を探して追加する（find-voices）

Reddit/Xを見て「あるある」「もやもや」に刺さる臨床検査技師の投稿を見つけ、
Chillmeruの`data/us/voices.json`に要約として追加するプレイブック。

## 前提・変更してはいけない制約（CLAUDE.md参照）

- **原文は保存・転載しない**。要約のみ（`summary_ja`は言い換え、本文コピペ厳禁）。
- **topic/resonanceは`lib/taxonomy.mjs`の値のみ**使う。ハードコード禁止。
- **commit/pushは必ずユーザーに確認してから**。要約案を提示 → 内容確認 →
  OKが出たら`data/us/voices.json`/`data/meta.json`を更新 → `npm run build`で疎通確認
  → それでもcommit/pushは指示されるまで実行しない。

## できること・できないことの前提

Xの検索・閲覧は、この対話に紐づく`claude-in-chrome`ブラウザ拡張で行う。
これは**このセッション限りの手段**であり、GitHub Actionsの自動デイリー実行
（`daily.yml`）からは呼び出せない。つまりこのSkillは「手動投入の一種」であって、
Reddit/Xの自動収集パイプラインではない。Reddit公式Data API審査が通れば、
Redditの自動化は`daily.yml`にそのまま任せられる（スコアベースで人間の判断が
不要なため）。Xは今後も「たまに対話で探す」運用が向いている
（理由: 有料API化・ToS上スクレイピング不可・そもそも良い投稿を選ぶ判断が
自動化しづらい）。

## 手順

### 1. Reddit/Xを検索する

**Reddit**: `r/medlabprofessionals`が本命（自動パイプラインと同じソース）。
`old.reddit.com`や`www.reddit.com`の検索・sort=topなどをブラウザで見に行く。

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

### 2. 投稿を評価する（スパム除外の判断基準）

- 個人の本音・実体験・ジョークか？ 企業/求人代行/宣伝アカウントではないか？
- 日本の読者が読んで「あるある」「もやもや」「へえ」と思える具体性があるか？
- 汎用的すぎる啓発文（「〇〇の日おめでとう」等）は基本的に見送る。

### 3. Voiceオブジェクトを組み立てる（`lib/types.ts`の`Voice`型に準拠）

| フィールド | 決め方 |
|---|---|
| `id` | `x_<tweet_id>` または `reddit_t3_<id>` |
| `url` | 投稿の恒久リンク（permalink） |
| `origin_country` | ISO 3166-1 alpha-2小文字。プロフィール（所属団体等）や文脈から推定。不明なら`"us"`にフォールバック |
| `title_ja` | 全角20字程度の見出し |
| `summary_ja` | 2〜3文の要約（言い換え、原文転載しない） |
| `topic` | `lib/taxonomy.mjs`の`TOPICS`から選ぶ |
| `resonance` | `RESONANCES`から選ぶ、当てはまらなければ`null` |
| `score` | Xなら「いいね」数、Redditなら投稿スコア（upvote）。不明なら見た目の反応量から妥当な値を入れる（0で埋めない） |
| `num_comments` | Xなら返信数、Redditならコメント数 |
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

## 参考: このSkillが生まれた経緯

2026-07-12、Reddit以外の情報源としてX（Twitter）を試した際に作成。LinkedInは
自動取得不可・手動貼り付けのみ対応（規約上スクレイピング不可、公式APIはパートナー
限定）と結論づけ、Xは手動でも「あるある」「もやもや」に刺さる投稿が見つかる
ことを確認した上で、この手順を再現可能にするために作成した。
