# CLAUDE.md — Claude Code 向けプロジェクトガイド

このリポジトリは **Chillmeru** のMVPスキャフォールド。詳細な設計意図は README.md 参照。

## 一言で
日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる、
サーバーレス・gitネイティブな日次更新コンテンツサイト。読み取り専用。

## 今のところ動くもの / 動かないもの
- Reddit取得（`lib/reddit.mjs`）は認証なしの公開JSONエンドポイントで実装済み・
  スモークテスト（`scripts/check-reddit.mjs` / `.github/workflows/check-reddit.yml`）あり。
  2026年の Reddit Responsible Builder Policy で script アプリの新規セルフサーブ
  作成が実質ブロックされたため、OAuth（password grant）は不採用にした経緯がある。
  **実測済みの問題**: `ubuntu-latest` ランナーIPだけでなく、self-hosted runner
  （自宅Mac、住宅回線IP）からも403/429で一律ブロックされる。curlでブラウザ風
  ヘッダーを付けても403のままな一方、実ブラウザでは開けるため、TLS指紋レベルの
  ボット判定と推定（ヘッダー偽装での回避は意図的な対策すり抜けになるため不採用）。
  **Reddit公式の非商用Data API申請を提出済み（審査待ち）**。承認されれば
  `oauth.reddit.com` 経由のOAuthに戻す（README「Reddit」参照、過去コミットに
  OAuth実装あり）。審査結果が来るまでRedditデータの実取得はできない前提で、
  他の作業はseedデータ（`data/us/voices.json`）で進める。
- LLM要約（`lib/llm.mjs`、Gemini `gemini-3.5-flash`、構造化出力でJSON強制）と
  Telegram通知（`lib/telegram.mjs`）は実装済み。それぞれ単体スモークテストあり
  （`scripts/check-llm.mjs` / `scripts/check-telegram.mjs` とその workflow）。
  未検証なのは実際のAPIキーでの動作確認のみ（README「各連携を単体で確認する」参照）。
- フロントエンド（`src/pages/index.astro`、Astro/SSG）は実装済み。topicタブ・
  resonanceバッジ・ダークモード対応。`npm run build` でseedデータの表示を確認済み。

## 次にClaude Codeにやってほしそうなタスク（優先順）
1. LLM_API_KEY / TELEGRAM_BOT_TOKEN・CHAT_ID を使った `check-llm` / `check-telegram`
   の動作確認（Reddit APIの審査結果を待たずに進められる）
2. Reddit Data API申請が承認され次第、`lib/reddit.mjs` をOAuth実装に戻し
   `node scripts/fetch-voices.mjs` を通しで動作確認
3. 求人（Adzuna API）・給与統計（e-Stat / BLS）の取得スクリプトを
   `fetch-voices.mjs` と同じパターンで追加

## 変更してはいけない設計上の制約
- **原文bodyを保存・表示しない**。`Voice` 型（`lib/types.ts`）は要約のみ持つ。
  著作権・API規約対策としてスキーマに焼き込んである。緩めない。
- **topic / resonance の値は `lib/taxonomy.mjs` が唯一の正**。
  スクリプト・フロントとも直接文字列をハードコードせずここを import する。
- **n8n / Supabase は使わない**方針で確定済み（README参照）。
  オーケストレーションはGitHub Actions cron、ストレージはリポジトリ内JSON。
- 投稿は **ドラフト生成＋Telegram通知＋手動投稿**がMVPの形。
  完全自動化（X従量APIでの自動ポスト）は将来の拡張として、今回は実装しない。

## 命名
- サービス名: **Chillmeru**（チルメル）。旧仮称「世界のラボ」からの改名済み。
  ディレクトリ名 `sekai-no-lab` は working title の名残で、リポジトリ名は
  移行時に `chillmeru` へ変えて差し支えない。
- 独自ドメイン・SNSハンドルの実際の空き状況は未確認（README参照）。
