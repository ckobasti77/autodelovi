// motion-3d: text reveal timing — hard load vs client-side navigation (clicking links), screencast
// frames for flash detection, and how long the new page's heading/intro stay invisible.
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, watch, revealCheck } from "./kit.mjs";

const DIR = "docs/qa/audit/motion-3d";
mkdirSync(DIR, { recursive: true });
const vpArg = process.argv[2] ?? "390";
const VP = vpArg === "1440" ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const browser = await launch();
const ctx = await newContext(browser, { ...VP, tag: `m3d-nav-${vpArg}` });
const page = await ctx.newPage();
const log = watch(page);
const cdp = await ctx.newCDPSession(page);
const out = [];

// In-page sampler: every frame, the first heading in <main> and the first paragraph after it —
// is the text painted? (element opacity × word opacity when split, state attribute).
await ctx.addInitScript(() => {
  window.__rv = { t0: performance.now(), rows: [] };
  window.__rvSample = (label) => {
    const start = performance.now();
    const rows = [];
    let lastKey = "";
    const tick = () => {
      const h = document.querySelector("main h1");
      const vis = (el) => {
        if (!el) return "none";
        const cs = getComputedStyle(el);
        const words = el.querySelectorAll(".reveal-word");
        if (words.length) {
          const shown = [...words].filter((w) => parseFloat(getComputedStyle(w).opacity) > 0.5).length;
          return `split ${shown}/${words.length}`;
        }
        return `op=${parseFloat(cs.opacity).toFixed(2)} st=${el.getAttribute("data-reveal-state") ?? "-"}`;
      };
      const key = `${h?.textContent?.trim().slice(0, 30)}|${vis(h)}`;
      if (key !== lastKey) {
        rows.push({ t: Math.round(performance.now() - start), key });
        lastKey = key;
      }
      if (performance.now() - start < 4000) requestAnimationFrame(tick);
      else window.__rv.rows.push({ label, rows });
    };
    requestAnimationFrame(tick);
  };
});

async function clientNav(fromUrl, linkSelector, label) {
  await page.goto(`${BASE}${fromUrl}`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2500);
  const link = page.locator(linkSelector).first();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const href = await link.getAttribute("href");
  // Screencast during the navigation.
  const frames = [];
  const onFrame = async (f) => {
    frames.push({ ts: f.metadata.timestamp, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  };
  cdp.on("Page.screencastFrame", onFrame);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
  await page.evaluate((l) => window.__rvSample(l), label);
  const tClick = Date.now();
  await link.click();
  await page.waitForURL((u) => u.pathname + u.search === href || u.href.endsWith(href), { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(4200);
  await cdp.send("Page.stopScreencast");
  cdp.off("Page.screencastFrame", onFrame);
  const trace = await page.evaluate((l) => window.__rv.rows.find((r) => r.label === l), label);
  // Save up to 8 frames spread over the capture.
  const t0 = frames[0]?.ts ?? 0;
  const pick = [0.05, 0.15, 0.3, 0.5, 0.8, 1.2, 2, 3.5];
  const saved = [];
  for (const s of pick) {
    const f = frames.find((fr) => fr.ts - t0 >= s) ?? null;
    if (!f) continue;
    const file = `${DIR}/nav-${vpArg}-${label}-${String(Math.round(s * 1000)).padStart(4, "0")}ms.webp`;
    await sharp(Buffer.from(f.data, "base64")).resize({ width: Math.min(VP.width, 720) }).webp({ quality: 60 }).toFile(file);
    saved.push(file);
  }
  const rc = await revealCheck(page);
  const row = { label, from: fromUrl, href, landed: page.url().replace(BASE, ""), clickToUrlMs: Date.now() - tClick, frames: frames.length, trace: trace?.rows, saved, afterNav: rc };
  out.push(row);
  console.log(label, JSON.stringify({ href, landed: row.landed, frames: frames.length, trace: trace?.rows?.slice(0, 12), afterNav: rc }));
}

await clientNav("/", 'main a[href="/delovi/kocioni-diskovi"], main a[href^="/delovi/"]', "home-to-category");
await clientNav("/delovi/kocioni-diskovi", 'main a[href^="/deo/"]', "category-to-product");
await clientNav("/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 'main nav a[href="/delovi/kocioni-diskovi"], main a[href="/delovi/kocioni-diskovi"]', "product-to-category");
await clientNav("/vozila", 'main a[href="/vozila/volkswagen"]', "vozila-to-brand");
await clientNav("/delovi", 'header a[href="/za-majstore"]', "header-to-za-majstore");

// Hard load sampler (for comparison): h1 visibility from navigation start.
for (const url of ["/delovi/kocioni-diskovi", "/za-majstore", "/kontakt"]) {
  await page.goto("about:blank");
  await page.goto(`${BASE}${url}`, { waitUntil: "commit", timeout: 90_000 });
  await page.evaluate(() => window.__rvSample("hard"));
  await page.waitForTimeout(4500);
  const trace = await page.evaluate(() => window.__rv.rows.find((r) => r.label === "hard"));
  out.push({ label: `hard ${url}`, trace: trace?.rows });
  console.log("hard", url, JSON.stringify(trace?.rows?.slice(0, 10)));
}
out.push({ log });
writeFileSync(`${DIR}/reveal-nav-${vpArg}.json`, JSON.stringify(out, null, 2));
await browser.close();
