/** vis-store: product page on phones — gallery caption vs render, buy row geometry, sticky buy bar. */
import { BASE, launch, newContext, shot } from "./kit.mjs";
const slug = process.argv[2] ?? "kocioni-disk-prednji-276-24-mm-demo-0004";
const tag = process.argv[3] ?? "pin";
const browser = await launch();
for (const [w, h] of [[360, 780], [390, 844], [1440, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, deviceScaleFactor: 2, tag: `vis-store-pm-${w}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2000);
  const fig = page.locator("main figure, main [class*=aspect]").first();
  const geo = await page.evaluate(() => {
    const cap = [...document.querySelectorAll("main *")].find((e) => e.children.length === 0 && /Ilustracija kategorije/.test(e.textContent));
    const capBox = cap?.closest("figcaption, p, span, div")?.getBoundingClientRect();
    const img = document.querySelector("main img");
    const ib = img?.getBoundingClientRect();
    const btns = [...document.querySelectorAll("main button")].filter((b) => /Dodaj u korpu|Poruči|Obavesti/.test(b.textContent));
    const add = btns[0]?.getBoundingClientRect();
    const plus = [...document.querySelectorAll("main button")].find((b) => /Povećaj|plus|\+/i.test(b.getAttribute("aria-label") ?? ""))?.getBoundingClientRect();
    const qty = document.querySelector('main input[type="number"], main input[inputmode="numeric"]')?.getBoundingClientRect();
    return {
      caption: capBox && { top: Math.round(capBox.top), bottom: Math.round(capBox.bottom), left: Math.round(capBox.left), right: Math.round(capBox.right), h: Math.round(capBox.height) },
      image: ib && { top: Math.round(ib.top), bottom: Math.round(ib.bottom), h: Math.round(ib.height), w: Math.round(ib.width) },
      addBtn: add && { top: Math.round(add.top), bottom: Math.round(add.bottom), h: Math.round(add.height) },
      qty: qty && { top: Math.round(qty.top), bottom: Math.round(qty.bottom), h: Math.round(qty.height) },
      plus: plus && { h: Math.round(plus.height), w: Math.round(plus.width) },
    };
  });
  console.log(w, JSON.stringify(geo));
  if (w < 1000) {
    await shot(page, `vis-store/${tag}/gallery-caption-${w}-dpr2`, { clip: { x: 0, y: 120, width: w, height: 300 } });
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(1500);
    const fixed = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const cs = getComputedStyle(e); return (cs.position === "fixed" || cs.position === "sticky") && e.getBoundingClientRect().height > 30 && e.getBoundingClientRect().top > innerHeight / 2; }).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)} ${Math.round(e.getBoundingClientRect().top)} ${e.textContent.trim().slice(0, 40)}`));
    console.log(w, "bottom fixed/sticky after scroll:", fixed);
    await shot(page, `vis-store/${tag}/scrolled-1600-${w}`);
  } else {
    await shot(page, `vis-store/${tag}/buyrow-1440-dpr2`, { clip: { x: 830, y: 450, width: 580, height: 260 } });
  }
  await ctx.close();
}
await browser.close();
