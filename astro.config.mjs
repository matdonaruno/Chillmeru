import { defineConfig } from "astro/config";

// 静的サイト（SSG）。data/*.json をビルド時に読み込んで HTML を吐くだけ。
// Netlify の無料枠にそのまま載る。出力は dist/。
export default defineConfig({
  // 独自ドメイン取得前は Netlify のサブドメイン運用（README 参照）
  site: "https://chillmeru.netlify.app",
});
