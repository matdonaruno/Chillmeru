// Telegram通知の単体スモークテスト。Reddit も LLM も不要。
// サンプルのVoiceで「今日のドラフト」を実際に送信する（本物のメッセージが飛ぶので注意）。
//
// ローカル: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID を渡して `node scripts/check-telegram.mjs`
// GitHub:   Actions の "check-telegram" ワークフローを手動実行

import { notifyTelegram } from "../lib/telegram.mjs";

const SAMPLE_VOICE = {
  id: "reddit_t3_checktelegram",
  url: "https://www.reddit.com/r/medlabprofessionals/",
  title_ja: "【動作確認】これはテスト通知です",
  summary_ja: "check-telegram.mjs からのスモークテストです。Telegram連携が正しく動いていればこのメッセージが届きます。",
  score: 0,
  num_comments: 0,
};

async function main() {
  console.log("▶ Telegram通知チェック: サンプルのドラフトを送信します");
  await notifyTelegram(SAMPLE_VOICE);
  console.log("✅ 送信しました。Telegramに届いているか確認してください。");
}

main().catch((e) => {
  console.error("\n❌ Telegram通知チェック失敗:\n" + e.message);
  process.exit(1);
});
