// verify track (perf-bundle-08): throttled 390 load (the Expanded 600 file is additionally held
// back 4 s so the fallback frame can be screenshotted reliably) of the ads landing; screenshots the H1 while the
// non-preloaded Archivo Expanded 600 is still loading (fallback) and after it arrived.
//   node scripts/qa/audit/verify-perf-bundle-fout.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { launch, newContext, BASE, shot } from "./kit.mjs";

// CDP capture: page.screenshot() waits for web fonts, which would hide the fallback frame.
async function cdpShot(cdp, rel) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 390, height: 520, scale: 1 } });
  await sharp(Buffer.from(data, "base64")).webp({ quality: 70 }).toFile(`docs/qa/audit/${rel}.webp`);
}

const browser = await launch();
const log = [];
for (const [name, route] of [["landing", "/ponuda/kocione-plocice-golf"], ["category", "/delovi/kocioni-diskovi"]]) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb08-fout-${name}` });
  const page = await ctx.newPage();
  await page.route(/archivo_expanded_600/, async (r) => { await new Promise((res) => setTimeout(res, 4000)); await r.continue(); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await page.goto(BASE + route, { waitUntil: "commit", timeout: 120000 });
  // Poll until the h1 is painted and visible while its face is not loaded yet.
  let caught = null;
  for (let i = 0; i < 400; i++) {
    caught = await page.evaluate(() => {
      const h = document.querySelector("main h1");
      if (!h) return null;
      const r = h.getBoundingClientRect();
      if (r.height === 0 || getComputedStyle(h).visibility === "hidden") return null;
      const cs = getComputedStyle(h);
      const fam = cs.fontFamily.split(",")[0].trim();
      const loaded = document.fonts.check(`${cs.fontWeight} 16px ${fam}`);
      return { fam, weight: cs.fontWeight, loaded, t: Math.round(performance.now()), text: h.textContent.trim().slice(0, 50) };
    }).catch(() => null);
    if (caught) break;
    await page.waitForTimeout(25);
  }
  if (caught && !caught.loaded) await cdpShot(cdp, `verify/perf-bundle/perf-bundle-08-reproduce-${name}-fallback`);
  const still = await page.evaluate(() => { const h = document.querySelector("main h1"); const cs = getComputedStyle(h); return document.fonts.check(`${cs.fontWeight} 16px ${cs.fontFamily.split(",")[0].trim()}`); });
  log.push(`${name}: face loaded right after the fallback capture: ${still}`);
  log.push(`${name}: h1 first visible at ${caught?.t} ms (${caught?.text}) family=${caught?.fam} ${caught?.weight} faceLoaded=${caught?.loaded}`);
  await page.waitForLoadState("load", { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const h = document.querySelector("main h1");
    const cs = getComputedStyle(h);
    return { loaded: document.fonts.check(`${cs.fontWeight} 16px ${cs.fontFamily.split(",")[0].trim()}`), t: Math.round(performance.now()) };
  });
  await shot(page, `verify/perf-bundle/perf-bundle-08-reproduce-${name}-webfont`, { clip: { x: 0, y: 0, width: 390, height: 520 } });
  log.push(`${name}: after fonts.ready at ${after.t} ms faceLoaded=${after.loaded}`);
  await ctx.close();
}
await browser.close();
console.log(log.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-08-reproduce-fout.txt", log.join("\n") + "\n");
