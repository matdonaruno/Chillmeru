// 日次パイプライン本体。ビルド不要でActionsから `node scripts/fetch-voices.mjs` で動く。
// 流れ: Reddit取得 → 既出idを除外 → 新着だけLLM要約 → マージして最新N件を書き出し → Telegramにドラフト通知
//
// 必要な環境変数（GitHub Secrets）:
//   REDDIT_USER_AGENT      （認証なしの公開JSONエンドポイントを使うため、これだけでOK）
//   LLM_API_KEY            （GLM/bigmodel.cn）
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
//
// ※ RedditのAPIは非商用・低頻度なら無料枠で足りるが、着手前に現行の規約・レート制限を要確認。
// ※ 広告運用に振ると商用扱いになり前提が変わる。MVPは非商用で通す。

import { fetchTop } from "../lib/reddit.mjs";
import { summarizePost } from "../lib/llm.mjs";
import { notifyTelegram } from "../lib/telegram.mjs";
import { readVoices, mergeVoices, writeVoicesAndMeta } from "../lib/voicesStore.mjs";

const COUNTRY = "us";
const SUBREDDIT = "medlabprofessionals";
const KEEP = 15;            // フロント表示・保持する最新件数
const FETCH_LIMIT = 25;     // 1回に見に行く投稿数

async function main() {
  const existing = await readVoices(COUNTRY);
  const seen = new Set(existing.map((v) => v.id));

  const posts = await fetchTop({ subreddit: SUBREDDIT, limit: FETCH_LIMIT });
  const fresh = posts.filter((p) => !seen.has(p.id));

  const now = new Date().toISOString();
  const added = [];
  for (const p of fresh) {
    const s = await summarizePost(p);
    added.push({
      id: p.id,
      url: p.url,
      title_ja: s.title_ja,
      summary_ja: s.summary_ja,
      topic: s.topic,
      resonance: s.resonance ?? null,
      score: p.score,
      num_comments: p.num_comments,
      created_utc: p.created_utc,
      fetched_at: now,
    });
  }

  const merged = mergeVoices(existing, added, KEEP);
  await writeVoicesAndMeta(COUNTRY, merged);

  // 新着があれば1件だけドラフト通知（あるある/もやもや優先で選ぶと共感が乗りやすい）
  if (added.length) {
    const pick = added.find((v) => v.resonance) ?? added[0];
    await notifyTelegram(pick);
  }
  console.log(`added ${added.length}, total ${merged.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
