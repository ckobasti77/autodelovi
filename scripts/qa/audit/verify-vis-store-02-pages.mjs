/** verify vis-store-02: live captures of category renders on hub, /delovi, home, category and product pages. */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const P = "verify/vis-store/vis-store-02-reproduce";
const out = {};
const browser = await launch("chromium");

async function imgInfo(page, sel) {
  return page.$$eval(sel, (imgs) =>
    imgs.map((i) => {
      const r = i.getBoundingClientRect();
      return { src: (i.currentSrc || i.src).replace(location.origin, "").slice(0, 90), natural: `${i.naturalWidth}x${i.naturalHeight}`, box: `${Math.round(r.width)}x${Math.round(r.height)}`, x: Math.round(r.x), y: Math.round(r.y + scrollY) };
    }),
  );
}

async function run(width, height, dpr, fn) {
  const ctx = await newContext(browser, { width, height, deviceScaleFactor: dpr, tag: `v02-${width}` });
  const page = await ctx.newPage();
  try { await fn(page); } catch (e) { out[`err-${width}-${dpr}`] = String(e); console.error(e); }
  await ctx.close();
}

// 1) system hub /delovi/kocnice at 1440
await run(1440, 900, 1, async (page) => {
  await page.goto(`${BASE}/delovi/kocnice`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const tiles = page.locator('a:has(img[src*="images%2Fparts"]), a:has(img[src*="images/parts"])');
  out.hubTiles = await tiles.count();
  const first = tiles.first();
  await first.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const grid = first.locator("xpath=..");
  await shot(page, `${P}-hub-1440-tiles`, { locator: grid });
  out.hubImgs = await imgInfo(page, 'img[src*="parts"]');
});

// 2) home categories section at 1440 and 390
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await run(w, h, 1, async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const hd = page.getByRole("heading", { name: /Najtraženije kategorije/i }).first();
    out[`homeHeading-${w}`] = await hd.count();
    await hd.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.waitForTimeout(1500);
    await shot(page, `${P}-home-${w}-categories`);
    out[`homeImgs-${w}`] = (await imgInfo(page, 'img[src*="parts"]')).slice(0, 8);
  });
}

// 3) /delovi at 1440
await run(1440, 900, 1, async (page) => {
  await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  const img = page.locator('img[src*="kocione-plocice"]').first();
  await img.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await page.waitForTimeout(1200);
  await shot(page, `${P}-delovi-1440-brakes`);
});

// 4) product page out of stock (brake pads) at 1440 DPR1, 390 DPR2; and in-stock disc for comparison
for (const [w, h, dpr] of [[1440, 900, 1], [1440, 900, 2], [390, 844, 2]]) {
  await run(w, h, dpr, async (page) => {
    await page.goto(`${BASE}/deo/kocione-plocice-prednje-demo-0012`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    out[`pdpImgs-${w}-dpr${dpr}`] = (await imgInfo(page, 'img[src*="parts"]')).slice(0, 3);
    if (dpr === 1 || w === 390) await shot(page, `${P}-pdp-plocice-${w}-dpr${dpr}`);
  });
}
await run(1440, 900, 1, async (page) => {
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, `${P}-pdp-disk-1440-dpr1`);
});
await run(1440, 900, 1, async (page) => {
  await page.goto(`${BASE}/deo/set-zupcastog-kaisa-sa-vodenom-pumpom-1-9-tdi-demo-e007`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  out.pdpE007 = (await imgInfo(page, 'img[src*="parts"]')).slice(0, 2);
  await shot(page, `${P}-pdp-e007-1440-dpr1`);
});

// 5) category listing /delovi/kocione-plocice product cards at 1440 and 390
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await run(w, h, 1, async (page) => {
    await page.goto(`${BASE}/delovi/kocione-plocice`, { waitUntil: "networkidle" });
    await scrollThrough(page);
    const img = page.locator('img[src*="kocione-plocice"]').first();
    await img.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.waitForTimeout(1200);
    await shot(page, `${P}-cat-plocice-${w}`);
  });
}

writeFileSync("docs/qa/audit/verify/vis-store/vis-store-02-reproduce-pages.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
