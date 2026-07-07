// Telegram通知の共通ロジック。本体パイプライン（scripts/fetch-voices.mjs）と
// 単体検証（scripts/check-telegram.mjs）の両方から使う。

import { requireEnv } from "./reddit.mjs";

/** ドラフト投稿文（X向け）を組み立てる。 */
export function draftTweet(v) {
  return `【海外の検査技師のいま】\n${v.title_ja}\n\n${v.summary_ja}\n\n#臨床検査技師 #Chillmeru`;
}

/** 1件の Voice を「今日のドラフト」としてTelegramに送る。 */
export async function notifyTelegram(voice) {
  requireEnv(["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);

  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(draftTweet(voice))}`;
  const msg =
    `🧪 今日のドラフト\n\n${draftTweet(voice)}\n\n` +
    `元投稿: ${voice.url}\n\n▶ Xで開く: ${intent}\n（画像は手で添付して最終チェックのうえ投稿）`;

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: msg,
      disable_web_page_preview: false,
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    let hint = "";
    if (r.status === 401) hint = "\nヒント: TELEGRAM_BOT_TOKEN が無効。";
    else if (r.status === 400) hint = "\nヒント: TELEGRAM_CHAT_ID が誤り、またはボットがそのchatに未参加。";
    throw new Error(`telegram ${r.status}${hint}\n${detail.slice(0, 300)}`);
  }
}
