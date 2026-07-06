// Reddit 連携の単体スモークテスト。LLM も Telegram も不要。
// 「認証できる → サブレディットの top を取得できる」ところまでを確認する。
// データファイルへの書き込みはしない（読み取り専用の疎通確認）。
//
// ローカル: 環境変数を渡して `node scripts/check-reddit.mjs`
// GitHub:   Actions の "check-reddit" ワークフローを手動実行（Reddit の5 Secrets のみでOK）

import { redditToken, fetchTop } from "../lib/reddit.mjs";

const SUBREDDIT = process.env.CHECK_SUBREDDIT || "medlabprofessionals";
const LIMIT = Number(process.env.CHECK_LIMIT || 5);

async function main() {
  console.log(`▶ Reddit 連携チェック: r/${SUBREDDIT}（top/week, ${LIMIT}件）`);

  console.log("① トークン取得中…");
  const token = await redditToken();
  console.log(`  ✓ アクセストークン取得OK（長さ ${token.length}）`);

  console.log("② 投稿取得中…");
  const posts = await fetchTop(token, { subreddit: SUBREDDIT, limit: LIMIT });
  console.log(`  ✓ ${posts.length} 件取得`);

  if (!posts.length) {
    throw new Error("0 件でした。サブレディット名や期間を確認してください。");
  }

  console.log("\n取得サンプル（本文は保存しない設計なのでタイトルと指標のみ）:");
  for (const p of posts) {
    const t = p.raw_title.length > 60 ? p.raw_title.slice(0, 60) + "…" : p.raw_title;
    console.log(`  • [${p.score}pt / ${p.num_comments}c] ${t}`);
    console.log(`    ${p.url}`);
  }

  console.log("\n✅ Reddit 連携は正常です。次は LLM 要約（LLM_API_KEY）へ進めます。");
}

main().catch((e) => {
  console.error("\n❌ Reddit 連携チェック失敗:\n" + e.message);
  process.exit(1);
});
