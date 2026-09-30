// verify perf-lh-02 (independent verifier): does the render-blocking CSS finish later because the
// preloaded fonts and card images share the slow-4G link? A/B at 412 × 823, 4× CPU, Lighthouse
// "slow 4G" applied via CDP (562.5 ms latency, 1.47 Mbps), consent pre-answered:
//   A = as shipped; B = preloaded woff2 + <link rel=preload as=image> requests aborted.
// Records the CSS responseEnd, FCP and LCP per run.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/verify-perf-lh-02-fonts.mjs [rounds]
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext } from "./kit.mjs";

const ROUNDS = Number(process.argv[2] ?? 3);
const PATHS = (process.env.PATHS ?? "/deo/kocioni-disk-prednji-276-24-mm-demo-0004,/delovi/kocioni-diskovi").split(",");
const browser = await chromium.launch();
const rows = [];
try {
  for (const p of PATHS) {
    for (let round = 1; round <= ROUNDS; round++) {
      for (const mode of ["A-shipped", "B-no-preloads"]) {
        const context = await newContext(browser, { width: 412, height: 823, tag: "vperflh-02" });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__lcp = 0;
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
        });
        let aborted = 0;
        if (mode.startsWith("B")) {
          await page.route(/\.woff2(\?.*)?$|\/_next\/image\?/, (r) => {
            aborted++;
            return r.abort();
          });
        }
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 562.5,
          downloadThroughput: (1638.4 * 1024 * 0.9) / 8,
          uploadThroughput: (750 * 1024 * 0.9) / 8,
        });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 120000 });
        await page.waitForTimeout(1500);
        const m = await page.evaluate(() => {
          const css = performance.getEntriesByType("resource").filter((e) => e.initiatorType === "link" && e.name.endsWith(".css"));
          const doc = performance.getEntriesByType("navigation")[0];
          return {
            docEnd: Math.round(doc.responseEnd),
            cssEnd: css.map((e) => Math.round(e.responseEnd)),
            fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
            lcp: window.__lcp,
          };
        });
        const row = { path: p, round, mode, aborted, ...m };
        rows.push(row);
        console.log(JSON.stringify(row));
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/perf-lh/perf-lh-02-fonts-ab.json", JSON.stringify({ base: BASE, cpu: 4, network: "slow 4G applied", rows }, null, 1));
