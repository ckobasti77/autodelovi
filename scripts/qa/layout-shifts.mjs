/** Lists layout-shift sources for a URL (mobile 390): node scripts/qa/layout-shifts.mjs <url> */
import { chromium } from "@playwright/test";

const url = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
await page.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      window.__shifts.push({
        value: e.value,
        t: Math.round(e.startTime),
        sources: (e.sources ?? []).map((s) => {
          const n = s.node;
          return n ? `${n.nodeName}.${(n.className?.baseVal ?? n.className ?? "").toString().slice(0, 80)} ${JSON.stringify(s.previousRect)}→${JSON.stringify(s.currentRect)}` : "?";
        }),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => window.__shifts), null, 1));
await browser.close();
