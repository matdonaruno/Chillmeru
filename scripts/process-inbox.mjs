// 手動投入パイプライン。Reddit API承認待ちの間の一時的な運用手段。
// Redditの投稿をブラウザで読んで data/inbox/voices.txt にコピペで貯め、
// まとめてLLM要約して data/us/voices.json に反映する。
//
// data/inbox/voices.txt は git管理しない（.gitignore済み）。原文を一時的にでも
// リポジトリ（今はpublic）に残さないため。CLAUDE.mdの「原文bodyを保存・表示しない」
// という設計制約と同じ理由。コミットされるのはLLM要約後のJSONだけ。
//
// 使い方:
//   1. data/inbox/voices.txt に投稿を貼る（フォーマットは自動生成されるテンプレ参照）
//   2. LLM_API_KEY を渡して `node scripts/process-inbox.mjs`
//   3. 表示される要約を確認する
//   4. 問題なければ data/us/voices.json / data/meta.json をcommit
//      （inboxは自動で空になり、次のコピペに備える。原文はcommitされない）

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { summarizePost } from "../lib/llm.mjs";
import { readVoices, mergeVoices, writeVoicesAndMeta } from "../lib/voicesStore.mjs";

const COUNTRY = "us";
const KEEP = 30;
const INBOX_PATH = "data/inbox/voices.txt";
const INBOX_TEMPLATE = `# ここにRedditの投稿をコピペして貯めてください。1件ずつ下記フォーマットで、
# 区切りは "---" だけの行にします（複数件まとめて貼ってOK）。
# SCORE / COMMENTS は分かれば入れる（省略可、省略時は0）。
# このファイルはgit管理していません（原文をリポジトリに残さないため）。
#
# URL: https://www.reddit.com/r/medlabprofessionals/comments/xxxxx/...
# TITLE: 投稿タイトル（原文のまま）
# SCORE: 342
# COMMENTS: 88
# BODY:
# 投稿本文をそのまま貼る（複数行OK）
# ---
`;

function parseInbox(text) {
  const blocks = text
    .split(/^---\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const entries = [];
  for (const block of blocks) {
    // "#" で始まる行（テンプレの説明文）は無視する
    const content = block
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n")
      .trim();
    if (!content) continue;

    const urlMatch = content.match(/^URL:\s*(.+)$/m);
    const titleMatch = content.match(/^TITLE:\s*(.+)$/m);
    const scoreMatch = content.match(/^SCORE:\s*(\d+)/m);
    const commentsMatch = content.match(/^COMMENTS:\s*(\d+)/m);
    const bodyMatch = content.match(/^BODY:\s*\n([\s\S]*)$/m);
    if (!urlMatch || !titleMatch) continue;

    entries.push({
      url: urlMatch[1].trim(),
      raw_title: titleMatch[1].trim(),
      raw_selftext: (bodyMatch?.[1] ?? "").trim(),
      score: scoreMatch ? Number(scoreMatch[1]) : 0,
      num_comments: commentsMatch ? Number(commentsMatch[1]) : 0,
    });
  }
  return entries;
}

/** RedditのURLからfullname形式のidを作る。自動取得パイプラインと同じ形式にして
 *  将来Reddit APIが復活したときの二重取得を防ぐ。取れなければURLのハッシュにフォールバック。 */
function idFromUrl(url) {
  const m = url.match(/\/comments\/([a-z0-9]+)\//i);
  if (m) return `reddit_t3_${m[1]}`;
  let hash = 0;
  for (const ch of url) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `manual_${hash.toString(36)}`;
}

async function main() {
  await mkdir("data/inbox", { recursive: true });
  const raw = await readFile(INBOX_PATH, "utf8").catch(() => "");
  const entries = parseInbox(raw);

  if (!entries.length) {
    console.log("inboxは空です。data/inbox/voices.txt に貼ってから実行してください。");
    await writeFile(INBOX_PATH, INBOX_TEMPLATE);
    return;
  }

  const existing = await readVoices(COUNTRY);
  const seen = new Set(existing.map((v) => v.id));
  const now = new Date().toISOString();
  const added = [];

  for (const entry of entries) {
    const id = idFromUrl(entry.url);
    if (seen.has(id)) {
      console.log(`  ⏭ 既出のためスキップ: ${entry.raw_title}`);
      continue;
    }
    const s = await summarizePost(entry);
    const voice = {
      id,
      url: entry.url,
      title_ja: s.title_ja,
      summary_ja: s.summary_ja,
      topic: s.topic,
      resonance: s.resonance ?? null,
      score: entry.score,
      num_comments: entry.num_comments,
      created_utc: Math.floor(Date.now() / 1000),
      fetched_at: now,
    };
    added.push(voice);
    seen.add(id); // 同じinbox内に重複URLが貼られていた場合の二重追加も防ぐ
    console.log(`  ✓ ${voice.title_ja}`);
    console.log(`    ${voice.summary_ja}`);
    console.log(`    topic=${voice.topic} resonance=${voice.resonance ?? "null"}`);
  }

  if (added.length) {
    const merged = mergeVoices(existing, added, KEEP);
    await writeVoicesAndMeta(COUNTRY, merged);
    console.log(`\n${added.length}件追加、合計${merged.length}件。data/us/voices.json を更新しました。`);
  } else {
    console.log("\n新規追加なし（すべて既出）。");
  }

  await writeFile(INBOX_PATH, INBOX_TEMPLATE);
  console.log("inboxをクリアしました。次のコピペに備えてください。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
