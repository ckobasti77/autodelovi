// verify track (perf-bundle-08): throttled 390 (latency 150 ms, 1.6 Mbps, like Lighthouse mobile)
// — every LCP entry (time, element, size) vs when Archivo Expanded 600 finished; plus a frame 2.5 s
// after first paint with the 600 file held back, to show the fallback face once the reveal is done.
//   node scripts/qa/audit/verify-perf-bundle-lcpfont.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { launch, newContext, BASE } from "./kit.mjs";

const browser = await launch();
const log = [];
const throttle = async (ctx, page) => {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  return cdp;
};
for (const [name, route] of [["landing", "/ponuda/kocione-plocice-golf"], ["category", "/delovi/kocioni-diskovi"]]) {
  for (let run = 1; run <= 3; run++) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb08-lcp-${run}` });
    await ctx.addInitScript(() => {
      window.__lcp = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const el = e.element;
          window.__lcp.push(`${Math.round(e.startTime)} ms size ${e.size} ${el ? el.tagName.toLowerCase() + ' "' + (el.textContent || "").trim().slice(0, 30) + '"' : "(removed)"}`);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const page = await ctx.newPage();
    await throttle(ctx, page);
    await page.goto(BASE + route, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => ({
      fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime),
      f600: Math.round(performance.getEntriesByType("resource").find((e) => e.name.includes("archivo_expanded_600"))?.responseEnd ?? -1),
      lcp: window.__lcp,
    }));
    log.push(`${name} run ${run}: FCP ${r.fcp} ms, Expanded 600 responseEnd ${r.f600} ms, LCP entries: ${r.lcp.join(" ; ")}`);
    await ctx.close();
  }
  // Fallback frame after the reveal finished (600 file held back 6 s).
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb08-hold-${name}` });
  const page = await ctx.newPage();
  await page.route(/archivo_expanded_600/, async (rt) => { await new Promise((res) => setTimeout(res, 6000)); await rt.continue(); });
  const cdp = await throttle(ctx, page);
  await page.goto(BASE + route, { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("main h1")?.getBoundingClientRect().height > 0, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const loaded = await page.evaluate(() => document.fonts.check("600 16px displaySemibold"));
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 390, height: 520, scale: 1 } });
  await sharp(Buffer.from(data, "base64")).webp({ quality: 70 }).toFile(`docs/qa/audit/verify/perf-bundle/perf-bundle-08-reproduce-${name}-fallback.webp`);
  log.push(`${name}: fallback frame 2.5 s after h1 first appeared, Expanded 600 loaded=${loaded}`);
  await ctx.close();
}
await browser.close();
console.log(log.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-08-reproduce-lcp.txt", log.join("\n") + "\n");
