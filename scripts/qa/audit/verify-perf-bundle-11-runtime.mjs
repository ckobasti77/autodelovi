// Verifier (perf-bundle-11, perf-bundle-10): on the home page, start the 3D (scroll > 40 px) at a
// phone and a desktop size and record which 3D assets are fetched, with their encoding and wire size.
//   node scripts/qa/audit/verify-perf-bundle-11-runtime.mjs
import { appendFileSync, mkdirSync } from "node:fs";

import { BASE, launch, newContext } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/perf-bundle";
mkdirSync(OUT, { recursive: true });
const browser = await launch("chromium");
const lines = ["", `runtime (${new Date().toISOString()}):`];
for (const cfg of [
  { width: 390, height: 844, dpr: 2, tag: "phone" },
  { width: 1440, height: 900, dpr: 1, tag: "desktop" },
]) {
  const ctx = await newContext(browser, { width: cfg.width, height: cfg.height, deviceScaleFactor: cfg.dpr, tag: "verify-pb11" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => {
    if (/\/models\//.test(e.response.url)) reqs.set(e.requestId, { url: e.response.url.replace(BASE, ""), enc: e.response.headers["content-encoding"] ?? e.response.headers["Content-Encoding"] ?? "(none)", type: e.response.mimeType });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.wire = e.encodedDataLength;
  });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.mouse.wheel(0, 200);
  await page.evaluate(() => window.scrollBy(0, 120));
  // Wait for the canvas or up to 45 s (shared machine, SwiftShader).
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => /car(-lite)?\.glb/.test(e.name) && e.responseEnd > 0), null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const tier = await page.evaluate(() => document.querySelector("[data-tier]")?.getAttribute("data-tier") ?? document.documentElement.dataset.tier ?? "?");
  lines.push(`${cfg.tag} ${cfg.width}x${cfg.height}@${cfg.dpr} tier=${tier}`);
  for (const r of reqs.values()) lines.push(`   ${r.url} type=${r.type} encoding=${r.enc} wire=${r.wire ?? "?"} B`);
  await ctx.close();
}
await browser.close();
console.log(lines.join("\n"));
appendFileSync(`${OUT}/perf-bundle-10-11-reproduce.txt`, lines.join("\n") + "\n");
