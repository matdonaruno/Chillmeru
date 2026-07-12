// data/<country>/voices.json の読み書き・マージの共通ロジック。
// scripts/fetch-voices.mjs（Reddit自動取得）と scripts/process-inbox.mjs（手動投入）の
// 両方から使う。挙動を揃えておくことで、どちらの経路で追加された声も同じルールで並ぶ。

import { readFile, writeFile } from "node:fs/promises";

const META_PATH = "data/meta.json";

export function voicesPath(country) {
  return `data/${country}/voices.json`;
}

export async function readVoices(country) {
  return JSON.parse(await readFile(voicesPath(country), "utf8").catch(() => "[]"));
}

/** 新着(added)を既存(existing)にマージし、新しい順に最新keep件だけ残す。 */
export function mergeVoices(existing, added, keep) {
  return [...added, ...existing]
    .sort((a, b) => b.created_utc - a.created_utc)
    .slice(0, keep);
}

/** voices.json と meta.json を書き出す。呼び出し時刻(ISO8601)を返す。 */
export async function writeVoicesAndMeta(country, merged) {
  await writeFile(voicesPath(country), JSON.stringify(merged, null, 2) + "\n");

  const now = new Date().toISOString();
  const meta = JSON.parse(await readFile(META_PATH, "utf8").catch(() => "{}"));
  meta.updated_at = now;
  meta.counts = { ...(meta.counts || {}), [country]: merged.length };
  await writeFile(META_PATH, JSON.stringify(meta, null, 2) + "\n");

  return now;
}
