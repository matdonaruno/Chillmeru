// LLM要約の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs, scripts/fetch-jobs.mjs）と
// 単体検証（scripts/check-llm.mjs）の両方から使う。
//
// Gemini の構造化出力（responseSchema）でJSONを直接強制する。
// "-latest" 系エイリアスは環境によって404になる報告があるため、固定バージョンを指定する。

import { TOPICS, RESONANCES } from "./taxonomy.mjs";
import { requireEnv } from "./reddit.mjs";

const LLM_MODEL = "gemini-3.5-flash"; // 安価・高速

const VOICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title_ja: { type: "STRING" },
    summary_ja: { type: "STRING" },
    topic: { type: "STRING", enum: TOPICS },
    resonance: { type: "STRING", enum: RESONANCES, nullable: true },
  },
  required: ["title_ja", "summary_ja", "topic"],
};

const JOB_SCHEMA = {
  type: "OBJECT",
  properties: {
    title_ja: { type: "STRING" },
    summary_ja: { type: "STRING" },
  },
  required: ["title_ja", "summary_ja"],
};

/** 投稿1件を日本語要約する。post = { raw_title, raw_selftext } */
export async function summarizePost(post) {
  const prompt = `あなたは臨床検査技師向けメディアの編集者です。以下の海外の投稿を日本語で紹介します。
原文を転載せず、必ず自分の言葉で要約してください。

制約:
- title_ja: 20字前後の日本語見出し
- summary_ja: 2〜3文の日本語要約（原文の言い回しを写さない）
- topic: 投稿の主題を最もよく表すもの
- resonance: 共感の種類。当てはまらなければ null

投稿タイトル: ${post.raw_title}
投稿本文（要約の材料。転載しない）: ${(post.raw_selftext || "").slice(0, 1500)}`;

  const out = await callLLM(prompt, VOICE_SCHEMA);

  // スキーマのenumで縛っていても念のため安全側に倒す
  if (!TOPICS.includes(out.topic)) out.topic = "culture";
  if (out.resonance && !RESONANCES.includes(out.resonance)) out.resonance = null;
  return out;
}

/** 求人1件を日本語要約する。job = { raw_title, raw_description } */
export async function summarizeJob(job) {
  const prompt = `あなたは臨床検査技師向けメディアの編集者です。以下の海外の求人情報を日本語で紹介します。
原文を転載せず、必ず自分の言葉で要約してください。

制約:
- title_ja: 20字前後の日本語見出し（職種名の意訳）
- summary_ja: 1〜2文の日本語要約（求められる経験・勤務形態など、興味を引く要点のみ。原文の言い回しを写さない）

求人タイトル: ${job.raw_title}
求人概要（要約の材料。転載しない）: ${(job.raw_description || "").slice(0, 1200)}`;

  return callLLM(prompt, JOB_SCHEMA);
}

// 一時的なエラー（レート制限・サーバー過負荷）だけリトライする。
// 400/401/403のような「直しても変わらないエラー」はリトライしない。
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000]; // 1回目失敗→1s待って2回目、2回目失敗→3s待って3回目

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** プロンプトを投げてJSONオブジェクトを受け取る。一時的なエラーは自動リトライする。 */
export async function callLLM(prompt, schema = VOICE_SCHEMA) {
  requireEnv(["LLM_API_KEY"]);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${process.env.LLM_API_KEY}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });

    if (r.ok) {
      const json = await r.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`llm: 応答にテキストがない: ${JSON.stringify(json).slice(0, 300)}`);
      return JSON.parse(text);
    }

    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 400) hint = "\nヒント: LLM_API_KEY が無効、またはリクエスト形式の問題。";
    else if (r.status === 403) hint = "\nヒント: APIキーの権限、または請求先未設定の可能性。";
    else if (r.status === 429) hint = "\nヒント: レート制限/無料枠超過。";

    if (RETRYABLE_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS) {
      console.warn(`  ⚠ llm ${r.status}（一時的エラー）。リトライ ${attempt}/${MAX_ATTEMPTS - 1}`);
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
      continue;
    }
    throw new Error(`llm ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
}
