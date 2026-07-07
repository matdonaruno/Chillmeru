// LLM要約の単体スモークテスト。Reddit も Telegram も不要。
// サンプル投稿1件を要約させ、taxonomy に沿ったJSONが返るか確認する。
// データファイルへの書き込みはしない。
//
// ローカル: LLM_API_KEY を渡して `node scripts/check-llm.mjs`
// GitHub:   Actions の "check-llm" ワークフローを手動実行（LLM_API_KEY のみでOK）

import { summarizePost } from "../lib/llm.mjs";
import { TOPICS, RESONANCES } from "../lib/taxonomy.mjs";

const SAMPLE_POST = {
  raw_title: "Anyone else running the night shift completely alone with 200+ specimens?",
  raw_selftext:
    "Our lab has been short-staffed for months and management still won't approve overtime pay. " +
    "I'm the only MLS on nights handling everything from STAT chemistries to blood bank. " +
    "Curious if this is normal everywhere or just my hospital.",
};

async function main() {
  console.log("▶ LLM要約チェック: サンプル投稿1件を要約させる");
  const out = await summarizePost(SAMPLE_POST);

  console.log("\n返ってきたJSON:");
  console.log(JSON.stringify(out, null, 2));

  const problems = [];
  if (typeof out.title_ja !== "string" || !out.title_ja) problems.push("title_ja が空/不正");
  if (typeof out.summary_ja !== "string" || !out.summary_ja) problems.push("summary_ja が空/不正");
  if (!TOPICS.includes(out.topic)) problems.push(`topic が taxonomy 外: ${out.topic}`);
  if (out.resonance !== null && !RESONANCES.includes(out.resonance)) {
    problems.push(`resonance が taxonomy 外: ${out.resonance}`);
  }

  if (problems.length) {
    throw new Error("スキーマ不整合:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  }

  console.log("\n✅ LLM要約は正常です。次は Telegram 通知（TELEGRAM_BOT_TOKEN/CHAT_ID）へ進めます。");
}

main().catch((e) => {
  console.error("\n❌ LLM要約チェック失敗:\n" + e.message);
  process.exit(1);
});
