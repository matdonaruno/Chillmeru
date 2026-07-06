// Reddit 取得の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs）と
// 単体検証（scripts/check-reddit.mjs）の両方から使う。
//
// 認証なしの公開JSONエンドポイント（https://www.reddit.com/r/xxx/top.json）を使う。
// 2026年に Reddit が Responsible Builder Policy を導入し、script アプリの
// セルフサーブ新規作成が実質ブロックされたため、OAuth（password grant）は
// この非商用・低頻度のMVPには不採用。具体的な User-Agent を送ることだけが要件。
//
// - 非商用・低頻度なら無料枠で足りるが、着手前に現行の規約・レート制限を要確認。
// - 429（レート制限）が出たら実行頻度を下げる／User-Agentをより具体的にする。

/** 必須の環境変数が揃っているか検査し、欠けていれば分かりやすいエラーにする。 */
export function requireEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(
      `環境変数が未設定です: ${missing.join(", ")}\n` +
        `GitHub の Settings → Secrets and variables → Actions に登録してください。`
    );
  }
}

/**
 * サブレディットの top を公開JSONエンドポイントから取得し、要約に必要な生データ
 * だけ返す（本文 body は意図的に捨てる）。認証は不要だが User-Agent は必須。
 * @param {{subreddit: string, limit?: number, t?: string}} opts
 */
export async function fetchTop({ subreddit, limit = 25, t = "week" }) {
  requireEnv(["REDDIT_USER_AGENT"]);

  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${t}&limit=${limit}`;
  const r = await fetch(url, {
    headers: { "User-Agent": process.env.REDDIT_USER_AGENT },
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 429) {
      hint = "\nヒント: レート制限。User-Agent を具体的な文字列にし、頻度を下げる。";
    } else if (r.status === 403) {
      hint = "\nヒント: Reddit側でブロックされている可能性。User-Agent を見直す。";
    }
    throw new Error(`reddit fetch ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
  const json = await r.json();
  return json.data.children.map((c) => ({
    id: `reddit_${c.data.name}`, // name = t3_xxxxx
    url: `https://www.reddit.com${c.data.permalink}`,
    raw_title: c.data.title,
    raw_selftext: c.data.selftext || "",
    score: c.data.score,
    num_comments: c.data.num_comments,
    created_utc: Math.floor(c.data.created_utc),
  }));
}
