import { TOPICS, RESONANCES } from "./taxonomy.mjs";

export type Topic = (typeof TOPICS)[number];
export type Resonance = (typeof RESONANCES)[number];

/** 「現場の声」1件。原文bodyは持たない（規約・著作権対策をスキーマに焼き込み）。 */
export interface Voice {
  /** dedupeキー。Redditのfullname（例: reddit_t3_abc123） */
  id: string;
  /** 元投稿への恒久リンク。必ず原典に敬意とトラフィックを返す */
  url: string;
  /** 日本語の見出し（要約の一行版） */
  title_ja: string;
  /** 日本語要約 2〜3文。サッと見れる製品意図 兼 変形的利用の安全マージン */
  summary_ja: string;
  /** 主題 */
  topic: Topic;
  /** 共感の種類。当てはまらなければ null */
  resonance: Resonance | null;
  /** 元投稿のスコア（新着並び・話題度の指標） */
  score: number;
  /** 元投稿のコメント数 */
  num_comments: number;
  /** 元投稿の作成時刻（UNIX秒） */
  created_utc: number;
  /** こちらが取得・要約した時刻（ISO8601）。新着バッジとBIPのdiffに使う */
  fetched_at: string;
}

export interface Meta {
  updated_at: string;
  counts: Record<string, number>; // 例: { us: 12 }
}
