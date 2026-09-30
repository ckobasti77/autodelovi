/** vis-store: type-scale audit — sub-13 px sentence text (DS 4.4 minimum sizes) and tabular numerals on prices. */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough } from "./kit.mjs";
const browser = await launch();
const out = {};
for (const [w, h, url] of [[390, 844, "/"], [390, 844, "/delovi/kocioni-diskovi"], [390, 844, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"], [1440, 900, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"], [1440, 900, "/"], [1440, 900, "/vozila/volkswagen/golf/golf-7"]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vis-store-type-${w}-${Date.now()}` });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1200);
  await scrollThrough(page, { stepMs: 50 });
  const r = await page.evaluate(() => {
    const small = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.data.trim();
      if (t.length < 12 || !/\s/.test(t)) continue;
      const el = n.parentElement;
      if (!el || el.closest("[aria-hidden=true], script, style, noscript, [hidden]")) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (fs >= 13) continue;
      if (cs.textTransform === "uppercase" || /Mono/i.test(cs.fontFamily)) continue;
      const key = `${fs}px ${cs.fontWeight} ${cs.color} :: ${t.slice(0, 70)}`;
      small.set(key, (small.get(key) ?? 0) + 1);
    }
    const prices = [...document.querySelectorAll("[data-price], [class*=numeral]")].slice(0, 5).map((e) => `${e.textContent.trim().slice(0, 20)} ${getComputedStyle(e).fontVariantNumeric}`);
    return { small: [...small.entries()].slice(0, 25), prices };
  });
  out[`${url}@${w}`] = r;
  console.log(url, w, JSON.stringify(r, null, 0).slice(0, 2500));
  await ctx.close();
}
writeFileSync("docs/qa/audit/vis-store/v3-type.json", JSON.stringify(out, null, 1));
await browser.close();
