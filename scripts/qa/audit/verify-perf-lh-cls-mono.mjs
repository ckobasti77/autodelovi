// perf-lh (step 21 audit): CLS on /vozila/volkswagen/golf/golf-7 — Lighthouse attributes the
// shift of „Delovi po kategorijama“ to the Martian Mono web font (not preloaded, display: swap).
// Measures the section's document offset and the engine-chip row height with the mono font
// blocked (fallback metrics, i.e. the first paint) vs. loaded, at 390 and 1440, and captures both.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-cls-mono.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext, shot } from "./kit.mjs";

const PATH = "/vozila/volkswagen/golf/golf-7";
const browser = await chromium.launch();
const rows = [];
try {
  for (const width of process.env.THROTTLE ? [412] : [390, 1440]) {
    for (const mono of ["blocked", "loaded"]) {
      const context = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: "perflh-cls" });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__ls = [];
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            window.__ls.push({
              at: Math.round(e.startTime),
              value: +e.value.toFixed(4),
              recent: e.hadRecentInput,
              sources: (e.sources ?? []).map((s) => ({
                node: s.node ? `${s.node.nodeName.toLowerCase()}${s.node.id ? `#${s.node.id}` : ""}.${String(s.node.className ?? "").split(" ").slice(0, 2).join(".")} “${(s.node.textContent ?? "").trim().slice(0, 30)}”` : "(gone)",
                prev: [Math.round(s.previousRect.y), Math.round(s.previousRect.height)],
                curr: [Math.round(s.currentRect.y), Math.round(s.currentRect.height)],
              })),
            });
          }
        }).observe({ type: "layout-shift", buffered: true });
        window.__fontsDone = null;
        document.fonts?.ready.then(() => (window.__fontsDone = Math.round(performance.now())));
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      if (process.env.THROTTLE) {
        // Lighthouse mobile "slow 4G", applied (fonts arrive after the first paint, as in Lighthouse).
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 562.5,
          downloadThroughput: (1638.4 * 1024 * 0.9) / 8,
          uploadThroughput: (750 * 1024 * 0.9) / 8,
        });
      }
      const fontUrls = [];
      page.on("request", (r) => {
        if (r.resourceType() === "font") fontUrls.push(r.url().replace(/^.*\/media\//, ""));
      });
      let blockedHits = 0;
      if (mono === "blocked") {
        // Every non-preloaded font file (Martian Mono + Archivo Expanded 600): the first paint's metrics.
        await page.route(/\/_next\/static\/media\/.*\.woff2(\?.*)?$/, (r) => {
          if (/-s\.p\./.test(r.request().url())) return r.continue();
          blockedHits++;
          return r.abort();
        });
      }
      await page.goto(`${BASE}${PATH}`, { waitUntil: "load", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(process.env.THROTTLE ? 5000 : 800);
      const m = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Motor"]');
        const cats = document.getElementById("cats-title");
        const monoLoaded = [...document.fonts].some((f) => /Martian/i.test(f.family) && f.status === "loaded");
        return {
          navHeight: nav ? Math.round(nav.getBoundingClientRect().height) : null,
          catsTop: cats ? Math.round(cats.getBoundingClientRect().top + window.scrollY) : null,
          monoLoaded,
          chips: nav ? nav.querySelectorAll("li").length : 0,
          cls: +window.__ls.filter((e) => !e.recent).reduce((t, e) => t + e.value, 0).toFixed(4),
          shifts: window.__ls,
          fontsDone: window.__fontsDone,
          fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
        };
      });
      const row = { width, mono, blockedHits, fontUrls, ...m };
      rows.push(row);
      console.log(JSON.stringify(row));
      await shot(page, `verify/perf-lh/perf-lh-03-cls-golf7-${width}-mono-${mono}`, { clip: { x: 0, y: 0, width, height: Math.min(1100, (m.catsTop ?? 900) + 120) } });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(
  `docs/qa/audit/verify/perf-lh/perf-lh-03-cls-golf7${process.env.THROTTLE ? "-slow4g" : ""}.json`,
  JSON.stringify({ base: BASE, path: PATH, throttled: !!process.env.THROTTLE, rows }, null, 1),
);
