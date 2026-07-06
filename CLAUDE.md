# CLAUDE.md — Claude Code 向けプロジェクトガイド

このリポジトリは **Chillmeru** のMVPスキャフォールド。詳細な設計意図は README.md 参照。

## 一言で
日本の臨床検査技師が、海外（まずUS）の「現場の声」を日本語でサッと見れる、
サーバーレス・gitネイティブな日次更新コンテンツサイト。読み取り専用。

## 今のところ動くもの / 動かないもの
- `scripts/fetch-voices.mjs` は **骨格のみ**。`callLLM()` はプレースホルダ実装
  （Gemini想定のfetch呼び出しは書いてあるが未検証）。実行前に:
  1. Reddit script アプリを登録し、`.github/workflows/daily.yml` が参照する
     Secrets（README「必要なSecrets」参照）を GitHub リポジトリに設定
  2. `callLLM()` を実際に使うLLMプロバイダに合わせて調整・動作確認
  3. `node scripts/fetch-voices.mjs` をローカルで環境変数を渡して試す
- フロントエンドは**未着手**。`data/*.json` を読むだけのNext.js or Astroを
  この上に被せる想定（README「構成」参照）。

## 次にClaude Codeにやってほしそうなタスク（優先順）
1. `scripts/fetch-voices.mjs` のローカル動作確認・デバッグ
   （Reddit認証、LLM呼び出し、JSON書き出しの一連が通るか）
2. フロントエンドの雛形作成（Next.js or Astro、`data/us/voices.json` を
   topicタブ + resonance（あるある/もやもや）バッジ付きで表示）
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
