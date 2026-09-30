// verify perf-lh-07 (independent verifier): what a slow phone sees between first paint and the
// text-reveal failsafe. 412 × 823, 4× CPU, Lighthouse slow 4G applied via CDP, consent pre-answered.
// Captures the first viewport at ~3.6 s (after FCP, before the 3.5 s failsafe fires relative to the
// boot script) and lists the copy in the first viewport whose computed opacity is 0, then again
// after the failsafe and after TextRevealGlobal starts.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/verify-perf-lh-07-shots.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext } from "./kit.mjs";

const PATH = process.env.P ?? "/delovi/kocioni-diskovi";
const browser = await chromium.launch();
const out = { base: BASE, path: PATH, samples: [] };
try {
  const context = await newContext(browser, { width: 412, height: 823, tag: "vperflh-07" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 562.5,
    downloadThroughput: (1638.4 * 1024 * 0.9) / 8,
    uploadThroughput: (750 * 1024 * 0.9) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto(`${BASE}${PATH}`, { waitUntil: "commit" });
  const sample = async (label) => {
    const s = await page.evaluate(() => {
      const vh = innerHeight;
      const hidden = [...document.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd,span,a,label,figcaption")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh && r.width > 0 && e.textContent.trim() && getComputedStyle(e).opacity === "0" && !(e.parentElement && getComputedStyle(e.parentElement).opacity === "0");
        })
        .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 50)}`);
      return {
        now: Math.round(performance.now()),
        fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0),
        failsafe: document.documentElement.classList.contains("tr-failsafe"),
        running: document.querySelectorAll('[data-reveal-state="running"]').length,
        hiddenInViewport: hidden,
      };
    });
    out.samples.push({ label, wallMs: Date.now() - t0, ...s });
    console.log(label, JSON.stringify(s));
  };
  await page.waitForTimeout(3300);
  await sample("before-failsafe");
  await page.screenshot({ path: "docs/qa/audit/verify/perf-lh/perf-lh-07-category-412-before-failsafe.png" });
  await page.waitForFunction(() => document.documentElement.classList.contains("tr-failsafe"), null, { timeout: 20000 });
  await sample("failsafe-fired");
  await page.waitForFunction(() => document.querySelector('[data-reveal-state="running"]'), null, { timeout: 20000, polling: 16 }).catch(() => {});
  await sample("reveal-running");
  await page.screenshot({ path: "docs/qa/audit/verify/perf-lh/perf-lh-07-category-412-rehidden.png" });
  await context.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/perf-lh/perf-lh-07-shots.json", JSON.stringify(out, null, 1));
