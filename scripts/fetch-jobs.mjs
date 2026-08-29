// 求人パイプライン本体。ビルド不要でActionsから `node scripts/fetch-jobs.mjs` で動く。
// 流れ: Adzuna検索 → 既出idを除外 → 新着だけLLM要約 → マージして最新N件を書き出し
//
// 必要な環境変数（GitHub Secrets）:
//   ADZUNA_APP_ID / ADZUNA_APP_KEY （https://developer.adzuna.com/signup で登録）
//   LLM_API_KEY                    （GLM/bigmodel.cn）
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
// 要約に使う時間の上限。超えた分は次回に回す。正常に完走した実行が11〜13分
// かかっているので、通常時には発動せず暴走時だけ効く値にしてある（最長の実績は17分）。
const SUMMARIZE_BUDGET_MS = 25 * 60 * 1000;
const JOBS_PATH = `data/${COUNTRY}/jobs.json`;
const META_PATH = "data/meta.json";

async function main() {
  const existing = JSON.parse(await readFile(JOBS_PATH, "utf8").catch(() => "[]"));
  const seen = new Set(existing.map((j) => j.id));

  const jobs = await searchJobs({ what: WHAT, country: COUNTRY, limit: FETCH_LIMIT });
  const fresh = jobs.filter((j) => !seen.has(j.id));

  const now = new Date().toISOString();
  const added = [];
  let deferred = 0; // 今回要約できず、次回に持ち越した件数

  // GLMの無料枠は混雑（429 code 1305）で個別のリクエストが落ちることがある。
  // 1件の失敗でそれまでの要約を全部捨てないよう、失敗分だけスキップする。
  // スキップした求人はjobs.jsonに入らない＝次回もseenに含まれないので、
  // 状態を持たなくても自動的に再挑戦される。
  const startedAt = Date.now();
  for (const [i, j] of fresh.entries()) {
    if (Date.now() - startedAt > SUMMARIZE_BUDGET_MS) {
      const rest = fresh.length - i;
      deferred += rest;
      console.warn(`  ⏱ 要約の時間上限（${SUMMARIZE_BUDGET_MS / 60000}分）に達した。残り${rest}件は次回に回す`);
      break;
    }

    let s;
    try {
      s = await summarizeJob(j);
    } catch (e) {
      deferred++;
      console.warn(`  ⚠ 要約に失敗（次回に回す） id=${j.id}: ${String(e.message).split("\n")[0]}`);
      continue;
    }

    added.push({
      id: j.id,
      url: j.url,
      title_ja: s.title_ja,
      content_ja: s.content_ja,
      qualification_ja: s.qualification_ja,
      company: j.company,
      location: j.location,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      created_utc: j.created_utc,
      fetched_at: now,
    });
  }

  // 新着があったのに1件も要約できなかったのはLLM側の障害。ここで落として気付けるようにする。
  // 新着0件（Adzunaに新しい求人がなかった）は正常なので、そのまま成功にする。
  if (fresh.length > 0 && added.length === 0) {
    throw new Error(`新着${fresh.length}件をいずれも要約できなかった（LLM側の障害の可能性）`);
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

  console.log(`added ${added.length}, deferred ${deferred}, total ${merged.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
