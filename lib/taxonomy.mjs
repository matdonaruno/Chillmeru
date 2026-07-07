// 分類の唯一の正（single source of truth）。
// スクリプトもフロントもここを参照する。カテゴリを足す/減らすのはここだけ。

// topic = 「何の話か」（主題）
export const TOPICS = [
  "workload",       // 激務・人員不足・負荷
  "salary",         // 給与・待遇
  "career",         // キャリア・転職・進路
  "certification",  // 資格・認定（ASCP等）
  "culture",        // 職場文化・人間関係
];

// resonance = 「どう刺さるか」（共感の種類）。当てはまらなければ null。
export const RESONANCES = [
  "aruaru",    // あるある：知ってる人が頷く共通体験
  "moyamoya",  // もやもや：割り切れない・報われないという感情
];

// 表示ラベル（日本語）。フロントは文字列を直書きせずここを参照する。
// キーは上の TOPICS / RESONANCES の値と一致させること。
export const TOPIC_LABELS = {
  workload: "労働環境",
  salary: "給与・待遇",
  career: "キャリア",
  certification: "資格・認定",
  culture: "職場文化",
};

export const RESONANCE_LABELS = {
  aruaru: "あるある",
  moyamoya: "もやもや",
};
