// verify track (perf-bundle-01): cost of the zod/RHF chunk on the cart -> checkout tap.
// 390 px, network throttled to Lighthouse "slow 4G" (150 ms RTT, 1.6 Mbps down, 750 Kbps up), CPU unthrottled
// (CPU timing on the shared machine is noise). Cold = chunk not cached; warm = the chunk URL was fetched into
// the HTTP cache on /korpa before the tap (everything else identical). Measures click -> URL is /porudzbina and its h1 "Porudžbina" is
// visible (the footer also has a "Kontakt" heading, so that is not used). 3 runs each, alternating.
//   node scripts/qa/audit/verify-perf-bundle-01-nav.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "./kit.mjs";

const CHUNK_URL = BASE + "/_next/static/chunks/1uyyf-z7kpx1w.js";
const browser = await launch("chromium");
const rows = [];

async function once(mode, run) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb01-nav-${mode}-${run}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  await page.getByRole("button", { name: /dodaj u korpu/i }).first().click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/korpa", { waitUntil: "load" });
  await page.waitForTimeout(2500);
  if (mode === "warm") {
    await page.evaluate(async (u) => {
      await (await fetch(u)).text();
    }, CHUNK_URL);
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  let chunkFromCache = null;
  cdp.on("Network.requestServedFromCache", () => {});
  cdp.on("Network.responseReceived", (e) => {
    if (e.response.url.includes("1uyyf-z7kpx1w")) chunkFromCache = e.response.fromDiskCache || e.response.fromMemoryCache || false;
  });
  const link = page.locator('a[href="/porudzbina"]').filter({ visible: true }).first();
  const t0 = Date.now();
  await link.click();
  await page.waitForURL("**/porudzbina", { timeout: 30000 });
  await page.getByRole("heading", { level: 1, name: "Porudžbina" }).waitFor({ state: "visible", timeout: 30000 });
  const ms = Date.now() - t0;
  rows.push({ mode, run, ms, chunkFromCache });
  await ctx.close();
}

for (let run = 1; run <= 3; run++) {
  await once("cold", run);
  await once("warm", run);
}
await browser.close();
const lines = ["verify perf-bundle-01 - /korpa -> tap checkout -> URL /porudzbina + h1 visible, 390 px, slow 4G (150 ms RTT, 1.6 Mbps), CPU 1x, :3100"];
for (const r of rows) lines.push(`${r.mode} run ${r.run}: ${r.ms} ms (chunk from cache: ${r.chunkFromCache})`);
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const c = med(rows.filter((r) => r.mode === "cold").map((r) => r.ms));
const w = med(rows.filter((r) => r.mode === "warm").map((r) => r.ms));
lines.push(`median cold ${c} ms, warm ${w} ms, difference ${c - w} ms`);
const out = lines.join("\n");
console.log(out);
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-nav.txt", out + "\n");
