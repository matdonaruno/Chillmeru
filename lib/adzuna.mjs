// Adzuna Jobs API の共通ロジック。本体パイプライン（scripts/fetch-jobs.mjs）と
// 単体検証（scripts/check-adzuna.mjs）の両方から使う。
//
// 登録: https://developer.adzuna.com/signup （メールのみ、即時発行）
// 認証: app_id / app_key をクエリパラメータで渡すだけ（OAuth不要）。
//
// 利用規約上の制約（developer.adzuna.com/docs/terms_of_service）:
// - 個別求人への恒久リンク（redirect_url）は表示してよい
// - 求人数・平均給与などの「集計」を継続的に表示するには書面の許可が必要。
//   → Chillmeruでは常に個別求人カードのみを表示し、集計・トレンド表示は行わない。
// - Adzunaへのアトリビューション（"Powered by Adzuna" 等のリンク）表示が必須。
//   → フロント側に必ず表示すること（README参照）。

import { requireEnv } from "./reddit.mjs";

/**
 * 求人を検索し、要約に必要な生データだけ返す。
 * @param {{what: string, country?: string, limit?: number}} opts
 *   what: 検索キーワード（例: "medical laboratory technologist"）
 *   country: Adzunaの国コード（例: "us"）
 */
export async function searchJobs({ what, country = "us", limit = 20 }) {
  requireEnv(["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]);

  const params = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    what,
    results_per_page: String(limit),
    sort_by: "date",
    "content-type": "application/json",
  });
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;

  const r = await fetch(url);
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 401) hint = "\nヒント: ADZUNA_APP_ID / ADZUNA_APP_KEY が無効。";
    else if (r.status === 429) hint = "\nヒント: レート制限。頻度を下げる。";
    throw new Error(`adzuna fetch ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
  const json = await r.json();
  return (json.results || []).map((j) => ({
    id: `adzuna_${j.id}`,
    url: j.redirect_url,
    raw_title: j.title,
    raw_description: j.description || "",
    company: j.company?.display_name || "",
    location: j.location?.display_name || "",
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    created_utc: j.created,
  }));
}
