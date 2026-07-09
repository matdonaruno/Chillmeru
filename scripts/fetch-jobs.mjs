// 求人パイプライン本体。ビルド不要でActionsから `node scripts/fetch-jobs.mjs` で動く。
// 流れ: Adzuna検索 → 既出idを除外 → 新着だけLLM要約 → マージして最新N件を書き出し
//
// 必要な環境変数（GitHub Secrets）:
//   ADZUNA_APP_ID / ADZUNA_APP_KEY （https://developer.adzuna.com/signup で登録）
//   LLM_API_KEY                    （Gemini）
//
// ※ Adzuna利用規約: 個別求人への恒久リンクの表示のみ許可。求人数・平均給与などの
//    集計を継続的に表示するには書面の許可が必要なため、本スクリプトは集計を行わない。
//    フロント側に "Powered by Adzuna" のアトリビューション表示が必須（README参照）。

import { readFile, writeFile } from "node:fs/promises";
import { searchJobs } from "../lib/adzuna.mjs";
import { summarizeJob } from "../lib/llm.mjs";

const COUNTRY = "us";
const WHAT = "medical laboratory technologist";
const KEEP = 15;           // フロント表示・保持する最新件数
const FETCH_LIMIT = 20;    // 1回に見に行く求人数
const JOBS_PATH = `data/${COUNTRY}/jobs.json`;
const META_PATH = "data/meta.json";

async function main() {
  const existing = JSON.parse(await readFile(JOBS_PATH, "utf8").catch(() => "[]"));
  const seen = new Set(existing.map((j) => j.id));

  const jobs = await searchJobs({ what: WHAT, country: COUNTRY, limit: FETCH_LIMIT });
  const fresh = jobs.filter((j) => !seen.has(j.id));

  const now = new Date().toISOString();
  const added = [];
  for (const j of fresh) {
    const s = await summarizeJob(j);
    added.push({
      id: j.id,
      url: j.url,
      title_ja: s.title_ja,
      summary_ja: s.summary_ja,
      company: j.company,
      location: j.location,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      created_utc: j.created_utc,
      fetched_at: now,
    });
  }

  // 新着を前に、掲載日時で並べて最新N件だけ保持
  const merged = [...added, ...existing]
    .sort((a, b) => new Date(b.created_utc) - new Date(a.created_utc))
    .slice(0, KEEP);

  await writeFile(JOBS_PATH, JSON.stringify(merged, null, 2) + "\n");

  const meta = JSON.parse(await readFile(META_PATH, "utf8").catch(() => "{}"));
  meta.updated_at_jobs = now;
  meta.counts = { ...(meta.counts || {}), [`${COUNTRY}_jobs`]: merged.length };
  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + "\n");

  console.log(`added ${added.length}, total ${merged.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
