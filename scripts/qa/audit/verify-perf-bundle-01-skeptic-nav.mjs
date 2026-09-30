// Verifier (skeptic) for perf-bundle-01: cart -> checkout client navigation on a throttled phone
// profile (Lighthouse "slow 4G": 150 ms RTT, 1.6 Mbps down; 4x CPU), 3 runs. Measures how long the
// zod/RHF chunk download takes after the click and when the checkout form's first field appears.
//   node scripts/qa/audit/verify-perf-bundle-01-skeptic-nav.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "./kit.mjs";

const CHUNK = "1uyyf-z7kpx1w.js";
const browser = await launch("chromium");
const rows = [];
for (let run = 1; run <= 3; run++) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `pb01-nav-${run}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  await page.getByRole("button", { name: /dodaj u korpu/i }).first().click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/korpa", { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const req = {};
  cdp.on("Network.requestWillBeSent", (e) => {
    if (e.request.url.includes(CHUNK)) req[e.requestId] = { start: e.timestamp };
  });
  cdp.on("Network.loadingFinished", (e) => {
    if (req[e.requestId]) {
      req[e.requestId].end = e.timestamp;
      req[e.requestId].bytes = e.encodedDataLength;
    }
  });
  const t0 = Date.now();
  await page.locator('a[href^="/porudzbina"]').first().click();
  await page.waitForURL(/\/porudzbina/, { timeout: 30000 });
  const tUrl = Date.now() - t0;
  await page.locator("form input:not([type=hidden]):visible").first().waitFor({ timeout: 30000 });
  const tForm = Date.now() - t0;
  const r = Object.values(req)[0];
  rows.push({
    run,
    urlChangeMs: tUrl,
    firstFieldVisibleMs: tForm,
    chunkDownloadMs: r?.end ? Math.round((r.end - r.start) * 1000) : null,
    chunkBytes: r?.bytes ?? null,
  });
  console.log(JSON.stringify(rows.at(-1)));
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-skeptic-nav.json", JSON.stringify(rows, null, 2));
