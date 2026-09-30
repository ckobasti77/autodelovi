// Independent verification (vis-store-03 stage labels, vis-store-06 tablet product order).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const out = { stage: [], product: [] };
const browser = await launch("chromium");
try {
  // vis-store-03
  for (const [w, h, dpr] of [[1280, 800, 1], [1280, 800, 2], [1366, 768, 1], [1366, 800, 1], [1400, 900, 1], [1440, 900, 1], [1536, 864, 1], [1920, 1080, 1]]) {
    const ctx = await newContext(browser, { width: w, height: h, deviceScaleFactor: dpr, tag: "vfy-vs03" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const data = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label] ol.grid');
      if (!nav) return null;
      return [...nav.querySelectorAll("li")].map((li) => {
        const lbl = li.querySelector("span.truncate");
        const cs = lbl ? getComputedStyle(lbl) : null;
        return {
          num: li.querySelector("span.type-numeral-s")?.textContent,
          label: lbl?.textContent,
          display: cs?.display,
          fontSize: cs?.fontSize,
          scrollW: lbl?.scrollWidth,
          clientW: lbl?.clientWidth,
          clipped: lbl ? lbl.scrollWidth > lbl.clientWidth : null,
          liW: Math.round(li.getBoundingClientRect().width),
        };
      });
    });
    const clipped = (data ?? []).filter((d) => d.clipped && d.display !== "none").map((d) => `${d.num} ${d.label} ${d.scrollW}>${d.clientW}`);
    out.stage.push({ w, h, dpr, clipped, items: data });
    if (dpr === 1 && (w === 1280 || w === 1366 || w === 1440)) {
      const strip = page.locator('nav[aria-label] ol.grid').first();
      const box = await strip.boundingBox();
      if (box) await shot(page, `verify/vis-store/vis-store-03-reproduce-${w}`, { clip: { x: Math.max(0, box.x - 8), y: box.y - 8, width: Math.min(w - box.x + 8, box.width + 16), height: box.height + 16 } });
    }
    await ctx.close();
  }

  // vis-store-06
  const slug = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
  for (const [w, h] of [[360, 780], [390, 844], [480, 900], [600, 960], [768, 1024], [820, 1180], [1000, 800], [1024, 768]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "vfy-vs06" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
      const fig = document.querySelector("figure.corner-ticks");
      const btn = [...document.querySelectorAll("#buy-box button")].find((b) => /Dodaj u korpu/.test(b.textContent));
      return {
        h1Top: top(document.querySelector("h1")),
        h1Left: document.querySelector("h1") ? Math.round(document.querySelector("h1").getBoundingClientRect().left) : null,
        drawingTop: fig && fig.offsetParent ? top(fig) : 0,
        drawingH: fig && fig.offsetParent ? Math.round(fig.getBoundingClientRect().height) : 0,
        buyBoxTop: top(document.querySelector("#buy-box")),
        buyButtonTop: top(btn),
        priceText: document.querySelector("#buy-box")?.textContent?.match(/[\d.]+\s?RSD/)?.[0] ?? null,
        vh: innerHeight,
      };
    });
    out.product.push({ w, h, ...m });
    if ([768, 820, 600].includes(w)) await shot(page, `verify/vis-store/vis-store-06-reproduce-${w}-top`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-03-06-reproduce.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ stage: out.stage.map((s) => ({ w: s.w, h: s.h, dpr: s.dpr, clipped: s.clipped, liW: s.items?.[0]?.liW, disp: s.items?.[1]?.display })), product: out.product }, null, 1));
