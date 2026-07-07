// 一時診断スクリプト。GitHub ActionsのIPからRedditへの複数経路を実測する。
// 用が済んだら削除する（本体コードではない）。
const UA = process.env.REDDIT_USER_AGENT || "chillmeru/0.1 diag (by u/testuser)";
const SUB = "medlabprofessionals";

const targets = [
  { name: "www.reddit.com .json", url: `https://www.reddit.com/r/${SUB}/top.json?t=week&limit=3`, headers: { "User-Agent": UA } },
  { name: "old.reddit.com .json", url: `https://old.reddit.com/r/${SUB}/top.json?t=week&limit=3`, headers: { "User-Agent": UA } },
  { name: "www.reddit.com .rss", url: `https://www.reddit.com/r/${SUB}/top.rss?t=week&limit=3`, headers: { "User-Agent": UA } },
  { name: "old.reddit.com .rss", url: `https://old.reddit.com/r/${SUB}/top/.rss?t=week&limit=3`, headers: { "User-Agent": UA } },
  { name: "www.reddit.com .json + Accept", url: `https://www.reddit.com/r/${SUB}/top.json?t=week&limit=3`, headers: { "User-Agent": UA, Accept: "application/json" } },
];

for (const t of targets) {
  try {
    const r = await fetch(t.url, { headers: t.headers });
    const text = await r.text();
    const looksBlocked = /network security|blocked/i.test(text.slice(0, 500));
    console.log(`\n=== ${t.name} ===`);
    console.log(`status: ${r.status} ${r.ok ? "OK" : ""}`);
    console.log(`looks blocked by network security: ${looksBlocked}`);
    console.log(`body head: ${text.slice(0, 150).replace(/\n/g, " ")}`);
  } catch (e) {
    console.log(`\n=== ${t.name} ===`);
    console.log(`threw: ${e.message}`);
  }
}
