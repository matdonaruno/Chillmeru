// Adzuna連携の単体スモークテスト。LLMもTelegramも不要。
// 「検索できる」ところまでを確認する。データファイルへの書き込みはしない。
//
// ローカル: 環境変数を渡して `node scripts/check-adzuna.mjs`
// GitHub:   Actions の "check-adzuna" ワークフローを手動実行（ADZUNA_APP_ID/APP_KEYのみでOK）

import { searchJobs } from "../lib/adzuna.mjs";

const WHAT = process.env.CHECK_WHAT || "medical laboratory technologist";
const LIMIT = Number(process.env.CHECK_LIMIT || 5);

async function main() {
  console.log(`▶ Adzuna連携チェック: "${WHAT}"（US, ${LIMIT}件）`);

  const jobs = await searchJobs({ what: WHAT, country: "us", limit: LIMIT });
  console.log(`  ✓ ${jobs.length} 件取得`);

  if (!jobs.length) {
    throw new Error("0 件でした。検索キーワードを確認してください。");
  }

  console.log("\n取得サンプル:");
  for (const j of jobs) {
    const salary =
      j.salary_min || j.salary_max
        ? `$${(j.salary_min ?? "?").toLocaleString?.() ?? j.salary_min}〜$${(j.salary_max ?? "?").toLocaleString?.() ?? j.salary_max}`
        : "給与非公開";
    console.log(`  • ${j.raw_title} @ ${j.company} (${j.location}) — ${salary}`);
    console.log(`    ${j.url}`);
  }

  console.log("\n✅ Adzuna連携は正常です。");
}

main().catch((e) => {
  console.error("\n❌ Adzuna連携チェック失敗:\n" + e.message);
  process.exit(1);
});
