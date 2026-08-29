// LLM要約の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs, scripts/fetch-jobs.mjs）と
// 単体検証（scripts/check-llm.mjs）の両方から使う。
//
// GLM（智譜AI/Zhipu AI）の chat completions API を使う。2026-07-11にGeminiから切替
// （Geminiのクォータ超過で daily-jobs が動かなくなったため）。
// response_format: json_object で「有効なJSONであること」は強制されるが、Geminiの
// responseSchemaと違いフィールド構造・enum値までは強制されない。期待する形は
// プロンプト内に明記し、受け取り側でも軽く検証する（TOPICS/RESONANCESのチェック等）。

import { TOPICS, RESONANCES } from "./taxonomy.mjs";
import { requireEnv } from "./reddit.mjs";

// 使うモデル。先頭から順に試し、混雑（429 code 1305）なら次のモデルへ回す。
// 混雑はモデル単位で起きるため、別モデルに振れば通ることがある。
// どちらもbigmodel.cnの無料モデル（2026-08時点、docs.bigmodel.cnのモデル一覧で確認）。
// GLM_MODEL 環境変数を渡すと、そのモデル1つだけを使う（候補の実地検証用。
// `gh workflow run check-llm.yml -f model=<id>` から使う）。
const DEFAULT_GLM_MODELS = ["glm-4.7-flash", "glm-4-flash-250414"];
const GLM_MODELS = process.env.GLM_MODEL ? [process.env.GLM_MODEL] : DEFAULT_GLM_MODELS;
const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/** 投稿1件を日本語要約する。post = { raw_title, raw_selftext } */
export async function summarizePost(post) {
  const prompt = `あなたは臨床検査技師向けメディアの編集者です。以下の海外の投稿を日本語で紹介します。
原文を転載せず、必ず自分の言葉で要約してください。

制約:
- title_ja: 20字前後の日本語見出し
- summary_ja: 2〜3文の日本語要約（原文の言い回しを写さない）。
  「〜という投稿」「〜を描いた投稿」「〜な一件」「〜という体験談」のように
  投稿を外側から説明するフレーズは使わない。出来事や状況、発言をそのまま書く。
- topic: 次のいずれか1つだけを入れる: ${TOPICS.join(", ")}
- resonance: 次のいずれか1つだけを入れる。当てはまらなければ null: ${RESONANCES.join(", ")}

投稿タイトル: ${post.raw_title}
投稿本文（要約の材料。転載しない）: ${(post.raw_selftext || "").slice(0, 1500)}

出力は次のキーだけを持つJSONオブジェクト1つのみ。説明文やコードブロック記法は付けない:
{"title_ja": "...", "summary_ja": "...", "topic": "...", "resonance": "..." または null}`;

  const out = await callLLM(prompt);

  // response_formatはJSONとして妥当なことしか保証しないため、値そのものは必ず検証する
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
- content_ja: 1〜2文。実際にどんな検査・業務を扱うか、どんな職場環境か
  （人員体制・シフトの特徴・裁量の大きさなど）が具体的に伝わるように書く。
- qualification_ja: 1文程度。必要な資格・経験と、あれば待遇面の一言
  （夜勤手当・リモート研修など）を添える。「経験2年以上歓迎」のような
  条件の羅列だけで終わらせず、読んで惹かれる書き方にする。

求人タイトル: ${job.raw_title}
求人概要（要約の材料。転載しない）: ${(job.raw_description || "").slice(0, 1200)}

出力は次のキーだけを持つJSONオブジェクト1つのみ。説明文やコードブロック記法は付けない:
{"title_ja": "...", "content_ja": "...", "qualification_ja": "..."}`;

  return callLLM(prompt);
}

// 一時的なエラー（レート制限・サーバー過負荷）だけリトライする。
// 400/401/403のような「直しても変わらないエラー」はリトライしない。
//
// GLMの429は多くが code 1305（该模型当前访问量过大 = そのモデルが混雑中）で、
// 数秒待った程度では明けない。無料枠のflashモデルはこれが日常的に起きるため、
// 待ち時間を秒単位から分単位のオーダーに伸ばしてある（合計で最大110秒待つ）。
// あわせて試行ごとにGLM_MODELSを順繰りに切り替え、混んでいないモデルに当たれば
// 早く抜けられるようにしている。
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** プロンプトを投げてJSONオブジェクトを受け取る。一時的なエラーは自動リトライする。 */
export async function callLLM(prompt) {
  requireEnv(["LLM_API_KEY"]);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const model = GLM_MODELS[(attempt - 1) % GLM_MODELS.length];
    const r = await fetch(GLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (r.ok) {
      const json = await r.json();
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error(`llm: 応答にテキストがない: ${JSON.stringify(json).slice(0, 300)}`);
      return JSON.parse(text);
    }

    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 400) hint = "\nヒント: LLM_API_KEY が無効、またはリクエスト形式の問題。";
    else if (r.status === 401 || r.status === 403) hint = "\nヒント: APIキーが無効、または権限不足。";
    else if (r.status === 429) hint = "\nヒント: レート制限/無料枠超過。";

    if (RETRYABLE_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS) {
      console.warn(`  ⚠ llm ${r.status}（一時的エラー、model=${model}）。リトライ ${attempt}/${MAX_ATTEMPTS - 1}`);
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
      continue;
    }
    throw new Error(`llm ${r.status} (model=${model})${hint}\n${detail.slice(0, 300)}`);
  }
}
