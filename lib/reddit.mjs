// Reddit 取得の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs）と
// 単体検証（scripts/check-reddit.mjs）の両方から使う。
//
// script タイプアプリの password grant を使う。以下に注意:
// - 認証に使う Reddit アカウントは、その script アプリの developer に入っていること。
// - アカウントに 2要素認証(2FA)がある場合、password は `パスワード:6桁コード` の形にする。
// - Google/Apple 等の SSO のみで作った（パスワード未設定の）アカウントは password grant 不可。
// - 非商用・低頻度なら無料枠で足りるが、着手前に現行の規約・レート制限を要確認。

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

/** script アプリの password grant でアクセストークンを取得。 */
export async function redditToken() {
  requireEnv([
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USERNAME",
    "REDDIT_PASSWORD",
    "REDDIT_USER_AGENT",
  ]);

  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "password",
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  });

  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT,
    },
    body,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 401) {
      hint =
        "\nヒント: client_id/secret かユーザー名/パスワードが誤っている可能性。" +
        "2FA 有効なら password を `パスワード:6桁コード` にする。" +
        "SSO のみのアカウントは password grant 不可。";
    } else if (r.status === 429) {
      hint = "\nヒント: レート制限。User-Agent を具体的な文字列にし、頻度を下げる。";
    }
    throw new Error(`reddit auth ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
  const json = await r.json();
  if (!json.access_token) {
    throw new Error(`reddit auth: access_token が返らなかった: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

/**
 * サブレディットの top を取得し、要約に必要な生データだけ返す（本文 body は意図的に捨てる）。
 * @param {string} token アクセストークン
 * @param {{subreddit: string, limit?: number, t?: string}} opts
 */
export async function fetchTop(token, { subreddit, limit = 25, t = "week" }) {
  const url = `https://oauth.reddit.com/r/${subreddit}/top?t=${t}&limit=${limit}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT,
    },
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`reddit fetch ${r.status}\n${detail.slice(0, 300)}`);
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
