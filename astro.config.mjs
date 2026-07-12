import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

// 静的サイト（SSG）。ページ本体はビルド時に静的出力するが、data/*.json は
// ビルド時にimportせずクライアント側でGitHub mainから直接fetchする（Netlify再デプロイの節約、
// src/scripts/feed.client.mjs参照）。Netlify の無料枠にそのまま載る。出力は dist/。
export default defineConfig({
  // 独自ドメイン取得前は Netlify のサブドメイン運用（README 参照）
  site: "https://chillmeru.netlify.app",

  integrations: [sitemap()],
});