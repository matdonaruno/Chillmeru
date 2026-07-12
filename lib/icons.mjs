// ミニマルなラインアイコンの共通データ（インラインSVG、依存なし）。
// name は lib/taxonomy.mjs の TOPIC_ICONS / RESONANCE_ICONS が持つ値と一致させる。
// ビルド時（src/components/Icon.astro）とクライアント側（src/scripts/feed.client.mjs）
// の両方から同じデータを参照する。

export const ICON_PATHS = {
  // topic
  clock: `<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>`,
  banknote: `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>`,
  "trending-up": `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  "check-circle": `<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  // resonance
  smile: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`,
  waves: `<path d="M2 7q3 -3 6 0 t6 0 6 0"/><path d="M2 12q3 -3 6 0 t6 0 6 0"/><path d="M2 17q3 -3 6 0 t6 0 6 0"/>`,
  // brand
  flask: `<path d="M9 3h6"/><path d="M10 3v6.5L5.4 17a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M8.5 15h7"/>`,
  // actions
  "arrow-up": `<line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/>`,
  message: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  external: `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  share: `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>`,
};

/** アイコン名からSVG文字列を組み立てる（クライアント側のカード生成で使う）。 */
export function iconSvg(name, { size = "1em", stroke = 2, className = "" } = {}) {
  const inner = ICON_PATHS[name] ?? "";
  const classAttr = className ? ` class="${className}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${classAttr} aria-hidden="true">${inner}</svg>`;
}
