/** vis-store: product-card names cut by the 2-line clamp, per width (card width, columns). */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, scrollThrough } from "./kit.mjs";
const browser = await launch();
const out = {};
for (const [w, h, url] of [[1024, 768, "/delovi/kocioni-diskovi"], [1280, 800, "/delovi/kocioni-diskovi"], [1440, 900, "/delovi/kocioni-diskovi"], [1920, 1080, "/delovi/kocioni-diskovi"], [2560, 1440, "/delovi/kocioni-diskovi"], [1920, 1080, "/pretraga?q=disk"]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vis-store-clamp-${w}-${Date.now()}` });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  await scrollThrough(page, { stepMs: 60 });
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    const clamped = [];
    for (const c of cards) for (const e of c.querySelectorAll("*")) {
      const cs = getComputedStyle(e);
      if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 2) clamped.push(e.textContent.trim());
    }
    let grid = cards[0]; while (grid && getComputedStyle(grid).display !== "grid") grid = grid.parentElement;
    return { cards: cards.length, cardWidth: cards[0] && Math.round(cards[0].getBoundingClientRect().width), cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : null, clamped };
  });
  out[`${url}@${w}`] = r;
  console.log(url, w, JSON.stringify(r));
  if (w === 2560) {
    const card = page.locator('[data-testid="product-card"]').first();
    await card.scrollIntoViewIfNeeded();
    const b = await card.boundingBox();
    await shot(page, "vis-store/v3/clamp-2560", { clip: { x: b.x - 10, y: b.y - 10, width: 1000, height: b.height + 20 } });
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/vis-store/v3-clamp.json", JSON.stringify(out, null, 1));
await browser.close();
