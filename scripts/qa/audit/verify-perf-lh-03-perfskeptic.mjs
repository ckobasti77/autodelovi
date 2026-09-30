// Step 21 audit — skeptic verification of perf-lh-03 (layout only, no timing).
// For every /vozila/[marka]/[model]/[generacija] page in the sitemap: load once (fonts loaded),
// then for each width swap the font variables to next/font's own generated fallback faces
// ("Martian Mono Fallback" = Arial @ size-adjust 157 %, "displaySemibold Fallback") and back,
// and record the layout-shift entry the swap back produces (what the real font swap produces at
// scroll 0) plus the geometry of the engine nav and the categories section.
//
//   node scripts/qa/audit/verify-perf-lh-03-perfskeptic.mjs [--only golf-7]
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext } from "./kit.mjs";

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const FAST = !!process.env.FAST;
const MOBILE = FAST ? [360, 390, 412, 430] : [360, 375, 390, 393, 412, 414, 430];
const DESKTOP = FAST ? [1350, 1440] : [768, 1024, 1280, 1350, 1440, 1920];
const ALL_MODES = {
  mono: 'html{--nf-mono:"Martian Mono Fallback" !important}',
  d600: 'html{--nf-display-600:"displaySemibold Fallback", Arial, sans-serif !important}',
  both: 'html{--nf-mono:"Martian Mono Fallback" !important;--nf-display-600:"displaySemibold Fallback", Arial, sans-serif !important}',
};
const MODES = FAST ? { mono: ALL_MODES.mono, both: ALL_MODES.both, d600: ALL_MODES.d600 } : ALL_MODES;

const sm = await (await fetch(`${BASE}/sitemaps/vozila.xml`)).text();
let paths = [...sm.matchAll(/<loc>[^<]*?(\/vozila\/[^/<]+\/[^/<]+\/[^/<]+)<\/loc>/g)].map((m) => m[1]);
if (only) paths = paths.filter((p) => p.includes(only));

const browser = await chromium.launch();
const out = [];
try {
  for (const group of [
    { widths: MOBILE, mobile: true, height: 823 },
    { widths: DESKTOP, mobile: false, height: 940 },
  ]) {
    const context = await newContext(browser, {
      width: group.widths[0],
      height: group.height,
      mobile: group.mobile,
      tag: "perfskeptic-lh03",
    });
    const page = await context.newPage();
    for (const path of paths) {
      await page.setViewportSize({ width: group.widths[0], height: group.height });
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => ({
        engines: document.querySelectorAll('nav[aria-label="Motor"] li').length,
        codes: [...document.querySelectorAll('nav[aria-label="Motor"] .type-code-s')].map((e) => e.textContent),
        vin: document.querySelector("main p .type-code")?.textContent ?? null,
        monoLoaded: [...document.fonts].some((f) => f.family === "Martian Mono" && f.status === "loaded"),
      }));
      for (const width of group.widths) {
        await page.setViewportSize({ width, height: group.height });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        const row = { path, width, height: group.height, ...info };
        for (const [mode, css] of Object.entries(MODES)) {
          row[mode] = await page.evaluate(async (css) => {
            const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const geo = () => {
              const nav = document.querySelector('nav[aria-label="Motor"]');
              const cats = document.getElementById("cats-title")?.closest("section");
              const h1 = document.querySelector("main h1");
              const p = h1?.parentElement?.querySelector("p");
              const y = (e) => (e ? Math.round(e.getBoundingClientRect().top + scrollY) : null);
              const h = (e) => (e ? Math.round(e.getBoundingClientRect().height) : null);
              return { navH: h(nav), catsTop: y(cats), h1H: h(h1), pH: h(p), vw: document.documentElement.clientWidth };
            };
            const style = document.createElement("style");
            style.textContent = css;
            document.head.append(style);
            await raf();
            await new Promise((r) => setTimeout(r, 60));
            const fallback = geo();
            const entries = [];
            const po = new PerformanceObserver((l) => {
              for (const e of l.getEntries()) entries.push(e);
            });
            po.observe({ type: "layout-shift" });
            style.remove();
            await raf();
            await new Promise((r) => setTimeout(r, 120));
            await raf();
            po.disconnect();
            const loaded = geo();
            return {
              fallback,
              loaded,
              dCats: fallback.catsTop != null ? fallback.catsTop - loaded.catsTop : null,
              cls: +entries.reduce((t, e) => t + e.value, 0).toFixed(4),
              top: entries
                .flatMap((e) => e.sources ?? [])
                .slice(0, 3)
                .map((s) => `${s.node?.nodeName?.toLowerCase() ?? "?"}.${String(s.node?.className ?? "").split(" ")[0]} ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`),
            };
          }, css);
        }
        out.push(row);
        console.log(
          `${path} w${width} eng${info.engines} | mono cls ${row.mono.cls} dCats ${row.mono.dCats} nav ${row.mono.fallback.navH}->${row.mono.loaded.navH} | d600 cls ${row.d600.cls} h1 ${row.d600.fallback.h1H}->${row.d600.loaded.h1H} | both cls ${row.both.cls} dCats ${row.both.dCats}`,
        );
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  `docs/qa/audit/verify/perf-lh/perf-lh-03-perfskeptic-sweep${only ? `-${only}` : FAST ? "-all" : ""}.json`,
  JSON.stringify({ base: BASE, note: "font-swap emulation via next/font fallback faces; scroll 0; no throttling", rows: out }, null, 1),
);
