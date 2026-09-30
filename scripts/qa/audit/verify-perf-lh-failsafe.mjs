// perf-lh (step 21 audit): on a slow phone (4× CPU + Lighthouse "slow 4G" network via CDP), does
// the text-reveal failsafe (html.tr-failsafe after 3.5 s) fire BEFORE TextRevealGlobal starts,
// and does TextRevealGlobal then re-hide (split + opacity 0) copy that the failsafe already showed?
// Records: FCP, time tr-failsafe was added, time of the first .reveal-word span, how many copy
// elements were split after the failsafe, and hydration end (first data-reveal-state attribute).
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-failsafe.mjs [rounds]
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext, shot } from "./kit.mjs";

const ROUNDS = Number(process.argv[2] ?? 2);
const PATHS = ["/", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/delovi/kocioni-diskovi/volkswagen/golf"];
const browser = await chromium.launch();
const rows = [];
try {
  for (const p of PATHS) {
    for (let round = 1; round <= ROUNDS; round++) {
      const context = await newContext(browser, { width: 412, height: 823, tag: "perflh-fs" });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const t = (window.__fs = { failsafeAt: null, firstWordAt: null, firstStateAt: null, splitAfterFailsafe: 0, splitBefore: 0, dcl: null, lcp: [] });
        // Every LCP candidate the browser reports (consent cookie is pre-set → no banner).
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) {
            const el = e.element;
            t.lcp.push({
              at: Math.round(e.startTime),
              size: e.size,
              el: el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.className).split(" ").slice(0, 2).join(".")} “${(el.textContent ?? "").trim().slice(0, 50)}”` : "(removed)",
            });
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // Observers are attached at DOMContentLoaded (the parser's <html> exists by then; the
        // failsafe fires 3.5 s after the head boot script and hydration comes later still).
        const start = () => {
          t.dcl = Math.round(performance.now());
          const html = document.documentElement;
          if (html.classList.contains("tr-failsafe")) t.failsafeAt = t.dcl;
          new MutationObserver(() => {
            if (t.failsafeAt == null && html.classList.contains("tr-failsafe")) t.failsafeAt = Math.round(performance.now());
          }).observe(html, { attributes: true, attributeFilter: ["class"] });
          new MutationObserver((muts) => {
            for (const m of muts) {
              if (m.type === "attributes" && m.attributeName === "data-reveal-state") {
                if (t.firstStateAt == null) t.firstStateAt = Math.round(performance.now());
                const el = m.target;
                if (el.getAttribute("data-reveal-state") === "running") {
                  if (t.failsafeAt != null) t.splitAfterFailsafe++;
                  else t.splitBefore++;
                }
              }
              for (const n of m.addedNodes ?? []) {
                if (t.firstWordAt == null && n instanceof Element && n.classList?.contains("reveal-word")) t.firstWordAt = Math.round(performance.now());
              }
            }
          }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-reveal-state"] });
        };
        document.addEventListener("DOMContentLoaded", start, { once: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      // Lighthouse mobile "slow 4G" (applied): 150 ms RTT × 3.75, 1.6 Mbps × 0.9.
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 562.5,
        downloadThroughput: (1638.4 * 1024 * 0.9) / 8,
        uploadThroughput: (750 * 1024 * 0.9) / 8,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(6000);
      const r = await page.evaluate(() => ({
        ...window.__fs,
        fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
        failsafeNow: document.documentElement.classList.contains("tr-failsafe"),
        done: document.querySelectorAll('[data-reveal-state="done"]').length,
      }));
      const row = { path: p, round, ...r };
      rows.push(row);
      console.log(JSON.stringify(row));
      if (round === 1 && p === "/delovi/kocioni-diskovi") await shot(page, "verify/perf-lh/perf-lh-07-category-412-after-load");
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/perf-lh/perf-lh-07-failsafe.json", JSON.stringify({ base: BASE, cpu: 4, network: "slow 4G applied (562.5 ms RTT, 1.47 Mbps)", rows }, null, 1));
