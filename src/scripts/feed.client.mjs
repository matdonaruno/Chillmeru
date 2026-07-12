// フィードのランタイムfetch＋描画。
// 「現場の声」「求人」はGitHub Actionsが data/*.json を更新するたびに変わるが、
// Netlifyの再デプロイ（1回15クレジット、他サイトと共有の月300クレジット枠を圧迫）は
// コード変更時だけにしたいので、ビルド時 import ではなくブラウザで直接 main ブランチの
// data/*.json を取得して描画する。netlify.toml の ignore ルールと対になっている
// （data/ だけの変更ならNetlifyはビルドをスキップする）。
import {
  TOPICS,
  TOPIC_LABELS,
  RESONANCE_LABELS,
  TOPIC_ICONS,
  RESONANCE_ICONS,
} from "../../lib/taxonomy.mjs";
import { iconSvg } from "../../lib/icons.mjs";

const DATA_BASE = "https://raw.githubusercontent.com/matdonaruno/Chillmeru/main";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function relativeTime(ms) {
  const diffMs = ms - Date.now();
  const rtf = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const absSec = Math.abs(diffMs) / 1000;
  for (const [unit, sec] of units) {
    if (absSec >= sec) return rtf.format(Math.round(diffMs / 1000 / sec), unit);
  }
  return rtf.format(Math.round(diffMs / 1000 / 60), "minute");
}

// http(s)以外のスキーム（javascript: 等）をhrefに渡さないための最低限のガード。
// 不正なら投げる → 呼び出し側(renderVoices/renderJobs)のper-item try/catchでそのカードだけスキップする。
function assertSafeUrl(url) {
  const { protocol } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`unsafe url scheme: ${protocol}`);
  }
  return url;
}

function formatSalary(min, max) {
  const fmt = (n) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} 〜 ${fmt(max)} /年`;
  if (min) return `${fmt(min)}〜 /年`;
  if (max) return `〜${fmt(max)} /年`;
  return null;
}

// 日本語要約だけだと「海外の声」という新鮮さが薄れるので、プラットフォーム＋国旗の
// ピルで発信元を視覚的に示す。国名ラベルは主要国のみ和名、それ以外はISOコードのまま。
const COUNTRY_LABELS = {
  us: "アメリカ",
  ng: "ナイジェリア",
  uk: "イギリス",
  gb: "イギリス",
  ca: "カナダ",
  au: "オーストラリア",
  in: "インド",
  ph: "フィリピン",
  za: "南アフリカ",
};

function flagEmoji(countryCode) {
  const cc = countryCode?.toUpperCase();
  if (!cc || cc.length !== 2) return "🌐";
  const points = [...cc].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}

function platformLabel(url) {
  if (/reddit\.com/i.test(url)) return "Reddit";
  if (/(?:x|twitter)\.com/i.test(url)) return "X";
  return new URL(url).hostname.replace(/^www\./, "");
}

function sourceLabel(url) {
  const redditMatch = url.match(/reddit\.com\/(r\/[^/]+)/i);
  if (redditMatch) return redditMatch[1];
  const xMatch = url.match(/(?:x|twitter)\.com\/([^/]+)\/status/i);
  if (xMatch) return `@${xMatch[1]}`;
  return new URL(url).hostname.replace(/^www\./, "");
}

function voiceCardHtml(voice) {
  assertSafeUrl(voice.url);
  const topicLabel = TOPIC_LABELS[voice.topic] ?? voice.topic;
  const topicIcon = TOPIC_ICONS[voice.topic];
  const resonanceLabel = voice.resonance ? RESONANCE_LABELS[voice.resonance] : null;
  const resonanceIcon = voice.resonance ? RESONANCE_ICONS[voice.resonance] : null;
  const source = sourceLabel(voice.url);
  const platform = platformLabel(voice.url);
  const countryLabel = COUNTRY_LABELS[voice.origin_country] ?? voice.origin_country?.toUpperCase() ?? "";
  const flag = flagEmoji(voice.origin_country);
  const when = relativeTime(voice.created_utc * 1000);

  return `<article class="post" data-topic="${escapeHtml(voice.topic)}" data-resonance="${escapeHtml(voice.resonance ?? "")}">
    <div class="meta">
      <span class="origin-pill" title="${escapeHtml(countryLabel)} · ${escapeHtml(platform)}">${flag} ${escapeHtml(platform)}</span>
      <span class="dot">·</span>
      <span class="source">${escapeHtml(source)}</span>
      <span class="dot">·</span>
      <span class="time">${escapeHtml(when)}</span>
      <span class="topic-tag topic-${escapeHtml(voice.topic)}">${iconSvg(topicIcon, { className: "tag-icon" })}${escapeHtml(topicLabel)}</span>
    </div>
    <h2 class="title">${escapeHtml(voice.title_ja)}</h2>
    <p class="summary">${escapeHtml(voice.summary_ja)}</p>
    ${resonanceLabel ? `<div class="resonance resonance-${escapeHtml(voice.resonance)}">${iconSvg(resonanceIcon, { className: "r-icon" })}${escapeHtml(resonanceLabel)}</div>` : ""}
    <div class="actions">
      <span class="stat" title="スコア">${iconSvg("arrow-up")} ${voice.score.toLocaleString()}</span>
      <span class="stat" title="コメント数">${iconSvg("message")} ${voice.num_comments.toLocaleString()}</span>
      <a class="source-link" href="${escapeHtml(voice.url)}" target="_blank" rel="noopener noreferrer">元投稿を読む${iconSvg("external")}</a>
    </div>
  </article>`;
}

function jobCardHtml(job) {
  assertSafeUrl(job.url);
  const salary = formatSalary(job.salary_min, job.salary_max);
  const when = relativeTime(new Date(job.created_utc).getTime());

  return `<article class="post job-post">
    <div class="meta">
      <span class="source">${escapeHtml(job.company)}</span>
      <span class="dot">·</span>
      <span class="time">${escapeHtml(job.location)}</span>
      <span class="dot">·</span>
      <span class="time">${escapeHtml(when)}</span>
    </div>
    <h2 class="title">${escapeHtml(job.title_ja)}</h2>
    <dl class="job-spec">
      <div class="spec-row"><dt>内容</dt><dd>${escapeHtml(job.content_ja)}</dd></div>
      ${salary ? `<div class="spec-row"><dt>報酬</dt><dd>${iconSvg("banknote", { className: "spec-icon" })} ${escapeHtml(salary)}</dd></div>` : ""}
      <div class="spec-row"><dt>資格</dt><dd>${escapeHtml(job.qualification_ja)}</dd></div>
    </dl>
    <div class="actions">
      <a class="source-link" href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer">求人を見る${iconSvg("external")}</a>
    </div>
  </article>`;
}

// 1件でもデータが壊れていて例外を投げると.map()全体が落ちてフィード全体が
// 「読み込み失敗」になってしまうため、カード単位でcatchしてその1件だけ落とす。
function renderCards(items, toHtml, label) {
  return items.flatMap((item) => {
    try {
      return [toHtml(item)];
    } catch (err) {
      console.warn(`[Chillmeru] 不正な${label}データをスキップ:`, item?.id, err);
      return [];
    }
  });
}

function renderVoices(container, voices) {
  const cards = renderCards(voices, voiceCardHtml, "voice");
  container.innerHTML = cards.length === 0
    ? `<p class="empty">まだ声がありません。日次パイプラインが動くと、ここに並びます。</p>`
    : `<main class="feed">${cards.join("")}</main>`;
}

function renderJobs(container, jobs) {
  const cards = renderCards(jobs, jobCardHtml, "job");
  container.innerHTML = cards.length === 0
    ? `<p class="empty">まだ求人がありません。日次パイプラインが動くと、ここに並びます。</p>`
    : `<main class="feed">${cards.join("")}</main>`;
}

function renderFilters(nav, usedTopics) {
  const chips = usedTopics.map((t) => `<button class="chip" data-filter="${escapeHtml(t)}" type="button">${iconSvg(TOPIC_ICONS[t], { className: "chip-icon" })}${escapeHtml(TOPIC_LABELS[t])}</button>`);
  nav.insertAdjacentHTML("beforeend", chips.join(""));
}

// トピックチップは非同期で挿入されるので、静的な要素にだけリスナーを付ける
// querySelectorAll方式ではなく、コンテナへのイベント委譲にしておく。
function wireFilters() {
  document.getElementById("voice-filters")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#voice-filters .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
    const filter = chip.dataset.filter;
    document.querySelectorAll("#view-voices .post").forEach((post) => {
      post.style.display = filter === "all" || post.dataset.topic === filter ? "" : "none";
    });
  });
}

export async function initFeed() {
  wireFilters();

  const voicesContainer = document.getElementById("voices-container");
  const jobsContainer = document.getElementById("jobs-container");
  const voiceFilters = document.getElementById("voice-filters");
  const updatedBadge = document.getElementById("updated-badge");

  try {
    const [voices, jobs, meta] = await Promise.all(
      ["data/us/voices.json", "data/us/jobs.json", "data/meta.json"].map((path) =>
        fetch(`${DATA_BASE}/${path}`, { cache: "no-store" }).then((res) => {
          if (!res.ok) throw new Error(`fetch failed: ${path} (${res.status})`);
          return res.json();
        })
      )
    );

    const items = [...voices].sort((a, b) => b.created_utc - a.created_utc);
    const jobItems = [...jobs].sort((a, b) => new Date(b.created_utc) - new Date(a.created_utc));
    const usedTopics = TOPICS.filter((t) => items.some((v) => v.topic === t));

    if (voiceFilters) renderFilters(voiceFilters, usedTopics);
    if (voicesContainer) renderVoices(voicesContainer, items);
    if (jobsContainer) renderJobs(jobsContainer, jobItems);

    if (updatedBadge && meta?.updated_at) {
      const updated = new Date(meta.updated_at).toLocaleDateString("ja-JP", { month: "long", day: "numeric" });
      updatedBadge.textContent = `${updated} 更新`;
      updatedBadge.hidden = false;
    }
  } catch (err) {
    console.error("[Chillmeru] データの取得に失敗しました", err);
    const message = `<p class="empty">データの読み込みに失敗しました。しばらくしてから再読み込みしてください。</p>`;
    if (voicesContainer) voicesContainer.innerHTML = message;
    if (jobsContainer) jobsContainer.innerHTML = message;
  }
}
