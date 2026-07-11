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

/**
 * 求人1件（Adzuna API）。個別求人への恒久リンクのみ表示し、
 * 求人数・平均給与などの集計は表示しない（Adzuna利用規約: 集計の継続表示は書面許可が必要）。
 */
export interface Job {
  /** dedupeキー。AdzunaのJob id */
  id: string;
  /** 元求人への恒久リンク（redirect_url）。必ず原典にトラフィックを返す */
  url: string;
  /** 日本語の見出し（職種名の意訳） */
  title_ja: string;
  /** 業務内容の説明（1〜2文）。Adzunaの抜粋(description)をもとにした意訳、転載ではない */
  content_ja: string;
  /** 必要資格・経験、待遇面の一言（1文程度） */
  qualification_ja: string;
  /** 求人企業名（Adzunaレスポンスそのまま。個人情報ではなく公開求人情報） */
  company: string;
  /** 勤務地表示名 */
  location: string;
  /** 提示給与レンジ（USD、年収）。不明な場合は null */
  salary_min: number | null;
  salary_max: number | null;
  /** 求人掲載時刻（ISO8601） */
  created_utc: string;
  /** こちらが取得・要約した時刻（ISO8601） */
  fetched_at: string;
}

export interface Meta {
  updated_at: string;
  counts: Record<string, number>; // 例: { us: 12 }
}
