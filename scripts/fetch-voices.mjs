// 日次パイプライン本体。ビルド不要でActionsから `node scripts/fetch-voices.mjs` で動く。
// 流れ: Reddit取得 → 既出idを除外 → 新着だけLLM要約 → マージして最新N件を書き出し → Telegramにドラフト通知
//
// 必要な環境変数（GitHub Secrets）:
//   REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USERNAME / REDDIT_PASSWORD / REDDIT_USER_AGENT
//   LLM_API_KEY            （安価モデル。Gemini Flash / Gemma / Bedrock 等）
//   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
//
// ※ RedditのAPIは非商用・低頻度なら無料枠で足りるが、着手前に現行の規約・レート制限を要確認。
// ※ 広告運用に振ると商用扱いになり前提が変わる。MVPは非商用で通す。

import { readFile, writeFile } from "node:fs/promises";
import { TOPICS, RESONANCES } from "../lib/taxonomy.mjs";

const COUNTRY = "us";
const SUBREDDIT = "medlabprofessionals";
const KEEP = 15;            // フロント表示・保持する最新件数
const FETCH_LIMIT = 25;     // 1回に見に行く投稿数
const VOICES_PATH = `data/${COUNTRY}/voices.json`;
const META_PATH = "data/meta.json";

// ---- Reddit（script アプリの password grant）----
async function redditToken() {
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
  if (!r.ok) throw new Error(`reddit auth ${r.status}`);
  return (await r.json()).access_token;
}

async function fetchTop(token) {
  const url = `https://oauth.reddit.com/r/${SUBREDDIT}/top?t=week&limit=${FETCH_LIMIT}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": process.env.REDDIT_USER_AGENT },
  });
  if (!r.ok) throw new Error(`reddit fetch ${r.status}`);
  const json = await r.json();
  // 必要な生データだけ取り出す（本文bodyは意図的に捨てる）
  return json.data.children.map((c) => ({
    id: `reddit_${c.data.name}`,      // name = t3_xxxxx
    url: `https://www.reddit.com${c.data.permalink}`,
    raw_title: c.data.title,
    raw_selftext: c.data.selftext || "",
    score: c.data.score,
    num_comments: c.data.num_comments,
    created_utc: Math.floor(c.data.created_utc),
  }));
}

// ---- LLM 要約（JSONのみ返させる）----
async function summarize(post) {
  const prompt = `あなたは臨床検査技師向けメディアの編集者です。以下の海外の投稿を日本語で紹介します。
原文を転載せず、必ず自分の言葉で要約してください。出力はJSONのみ（前置き・コードフェンス禁止）。

制約:
- title_ja: 20字前後の日本語見出し
- summary_ja: 2〜3文の日本語要約（原文の言い回しを写さない）
- topic: 次のいずれか一つ ${JSON.stringify(TOPICS)}
- resonance: 共感の種類。当てはまれば ${JSON.stringify(RESONANCES)} のどれか、なければ null

投稿タイトル: ${post.raw_title}
投稿本文（要約の材料。転載しない）: ${post.raw_selftext.slice(0, 1500)}

出力形式: {"title_ja": "...", "summary_ja": "...", "topic": "...", "resonance": "..." または null}`;

  // TODO: ここを実際の安価モデルの呼び出しに差し替える（Gemini Flash / Gemma / Bedrock 等）。
  // 下は「JSON文字列を返す」ことだけ守れば何でもよいという前提のプレースホルダ。
  const text = await callLLM(prompt);
  const clean = text.replace(/```json|```/g, "").trim();
  const out = JSON.parse(clean);

  // タクソノミ外の値が来たら安全側に倒す
  if (!TOPICS.includes(out.topic)) out.topic = "culture";
  if (out.resonance && !RESONANCES.includes(out.resonance)) out.resonance = null;
  return out;
}

async function callLLM(prompt) {
  // 例: Gemini generateContent。プロバイダに合わせて差し替え可。
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.LLM_API_KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) throw new Error(`llm ${r.status}`);
  const json = await r.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

// ---- Telegram ドラフト通知 ----
async function notifyTelegram(voice) {
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(draftTweet(voice))}`;
  const msg =
    `🧪 今日のドラフト\n\n${draftTweet(voice)}\n\n` +
    `元投稿: ${voice.url}\n\n▶ Xで開く: ${intent}\n（画像は手で添付して最終チェックのうえ投稿）`;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      disable_web_page_preview: false,
    }),
  });
}

function draftTweet(v) {
  return `【海外の検査技師のいま】\n${v.title_ja}\n\n${v.summary_ja}\n\n#臨床検査技師 #Chillmeru`;
}

// ---- メイン ----
async function main() {
  const existing = JSON.parse(await readFile(VOICES_PATH, "utf8").catch(() => "[]"));
  const seen = new Set(existing.map((v) => v.id));

  const token = await redditToken();
  const posts = await fetchTop(token);
  const fresh = posts.filter((p) => !seen.has(p.id));

  const now = new Date().toISOString();
  const added = [];
  for (const p of fresh) {
    const s = await summarize(p);
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

  // 新着を前に、スコア/新しさで並べて最新N件だけ保持
  const merged = [...added, ...existing]
    .sort((a, b) => b.created_utc - a.created_utc)
    .slice(0, KEEP);

  await writeFile(VOICES_PATH, JSON.stringify(merged, null, 2) + "\n");

  const meta = JSON.parse(await readFile(META_PATH, "utf8").catch(() => "{}"));
  meta.updated_at = now;
  meta.counts = { ...(meta.counts || {}), [COUNTRY]: merged.length };
  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + "\n");

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
