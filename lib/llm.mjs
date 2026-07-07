// LLM要約の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs）と
// 単体検証（scripts/check-llm.mjs）の両方から使う。
//
// Gemini の構造化出力（responseSchema）でJSONを直接強制する。
// "-latest" 系エイリアスは環境によって404になる報告があるため、固定バージョンを指定する。

import { TOPICS, RESONANCES } from "./taxonomy.mjs";
import { requireEnv } from "./reddit.mjs";

const LLM_MODEL = "gemini-3.5-flash"; // 安価・高速

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

  const out = await callLLM(prompt);

  // スキーマのenumで縛っていても念のため安全側に倒す
  if (!TOPICS.includes(out.topic)) out.topic = "culture";
  if (out.resonance && !RESONANCES.includes(out.resonance)) out.resonance = null;
  return out;
}

/** プロンプトを投げてJSONオブジェクトを受け取る。 */
export async function callLLM(prompt) {
  requireEnv(["LLM_API_KEY"]);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${process.env.LLM_API_KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            title_ja: { type: "STRING" },
            summary_ja: { type: "STRING" },
            topic: { type: "STRING", enum: TOPICS },
            resonance: { type: "STRING", enum: RESONANCES, nullable: true },
          },
          required: ["title_ja", "summary_ja", "topic"],
        },
      },
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 400) hint = "\nヒント: LLM_API_KEY が無効、またはリクエスト形式の問題。";
    else if (r.status === 403) hint = "\nヒント: APIキーの権限、または請求先未設定の可能性。";
    else if (r.status === 429) hint = "\nヒント: レート制限/無料枠超過。";
    throw new Error(`llm ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
  const json = await r.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`llm: 応答にテキストがない: ${JSON.stringify(json).slice(0, 300)}`);
  return JSON.parse(text);
}
