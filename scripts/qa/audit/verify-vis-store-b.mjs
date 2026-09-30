// Independent verification vis-store-04: card width / columns / clamped names / chip overlap on rail grids.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const routes = ["/delovi/kocioni-diskovi", "/delovi/kocioni-diskovi/volkswagen", "/pretraga?q=disk", "/delovi/kocnice"];
const widths = [[1024, 768], [1280, 800], [1440, 900], [1536, 864], [1920, 1080], [2560, 1440]];
const out = [];
const browser = await launch("chromium");
try {
  for (const route of routes) {
    for (const [w, h] of widths) {
      if (route !== "/delovi/kocioni-diskovi" && ![1440, 1920, 2560].includes(w)) continue;
      const ctx = await newContext(browser, { width: w, height: h, tag: "vfy-vs04" });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("ul.grid > li article")];
        if (!cards.length) return { cards: 0 };
        const ul = cards[0].closest("ul");
        const cols = getComputedStyle(ul).gridTemplateColumns.split(" ").length;
        const rail = document.querySelector("aside, [data-testid*=filter]");
        const names = cards.map((a) => {
          const n = a.querySelector("h2, h3");
          const link = n?.querySelector("a") ?? n;
          const clampEl = [n, link].find((e) => e && getComputedStyle(e).webkitLineClamp !== "none") ?? n;
          return {
            text: n?.textContent?.trim(),
            clamped: clampEl ? clampEl.scrollHeight > clampEl.clientHeight + 1 : null,
          };
        });
        // chip vs render overlap on first card
        const overlaps = cards.slice(0, 12).map((a) => {
          const img = a.querySelector("img");
          const chip = [...a.querySelectorAll("span, div")].find((e) => /^(OEM kvalitet|Original VAG|Aftermarket)$/.test(e.textContent.trim()) && e.getBoundingClientRect().width > 0 && e.offsetParent);
          if (!img || !chip) return null;
          const r = img.getBoundingClientRect(), c = chip.getBoundingClientRect();
          return { imgW: Math.round(r.width), imgH: Math.round(r.height), chipBottom: Math.round(c.bottom - r.top), chipRight: Math.round(c.right - r.left) };
        });
        return {
          cards: cards.length,
          cols,
          cardW: Math.round(cards[0].getBoundingClientRect().width),
          gridW: Math.round(ul.getBoundingClientRect().width),
          railW: rail ? Math.round(rail.getBoundingClientRect().width) : null,
          clamped: names.filter((n) => n.clamped).map((n) => n.text),
          total: names.length,
          chip: overlaps[0],
        };
      });
      out.push({ route, w, h, ...m });
      if (route === "/delovi/kocioni-diskovi" && [1440, 1920, 2560].includes(w)) {
        const ul = page.locator("ul.grid:has(article)").first();
        await ul.scrollIntoViewIfNeeded();
        const box = await ul.boundingBox();
        await page.evaluate((y) => window.scrollTo(0, y - 120), box.y + (await page.evaluate(() => scrollY)));
        await page.waitForTimeout(800);
        const b2 = await ul.boundingBox();
        await shot(page, `verify/vis-store/vis-store-04-reproduce-${w}`, { clip: { x: b2.x - 8, y: Math.max(0, b2.y - 8), width: b2.width + 16, height: Math.min(h - Math.max(0, b2.y - 8), 560) } });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-04-reproduce.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
