// seo-content-email (step 22, PERF-02): does the late code font (Martian Mono, not preloaded,
// display: swap) still move the vehicle pages? Each page is measured with the web font loaded
// and again with every code span forced onto „Martian Mono Fallback“ — the metrics of the first
// paint, before the swap. Equal offsets = no font-swap layout shift. (Blocking the font files
// does not work against the dev server, whose font URLs differ from a production build.)
//
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/seo-content-email-cls-mono.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, shot } from "../audit/kit.mjs";

const PAGES = [
  { path: "/vozila/volkswagen/golf/golf-7", probe: "#cats-title" },
  { path: "/vozila/skoda/octavia", probe: "#model-landings-title" },
];
const FALLBACK_CSS =
  '[class*="type-code"]{font-family:"Martian Mono Fallback" !important}';
const OUT = "docs/qa/fix/seo-content-email";
mkdirSync(OUT, { recursive: true });
const rows = [];
const browser = await chromium.launch();
try {
  for (const { path, probe } of PAGES) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      const measure = () =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          const nav = document.querySelector('nav[aria-label="Motor"]');
          return {
            probeTop: el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null,
            navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
            docHeight: document.documentElement.scrollHeight,
          };
        }, probe);
      const loaded = await measure();
      if (path.includes("golf-7") && width === 390) {
        await shot(page, `../fix/seo-content-email/engines-golf7-390`, {
          clip: { x: 0, y: 0, width, height: Math.min(1200, (loaded.probeTop ?? 900) + 80) },
        });
      }
      await page.addStyleTag({ content: FALLBACK_CSS });
      const fallback = await measure();
      const row = {
        path,
        width,
        loaded,
        fallback,
        probeDelta: (loaded.probeTop ?? 0) - (fallback.probeTop ?? 0),
        navDelta: (loaded.navHeight ?? 0) - (fallback.navHeight ?? 0),
      };
      rows.push(row);
      console.log(JSON.stringify(row));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/cls-mono.json`, JSON.stringify({ base: BASE, rows }, null, 1));
