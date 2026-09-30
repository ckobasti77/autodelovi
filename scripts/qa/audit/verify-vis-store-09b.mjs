import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch("chromium");
const out = [];
for (const [route, w, h, name] of [
  ["/delovi/kocioni-diskovi?marka=volkswagen&model=golf&generacija=golf-7", 360, 780, "catf-360"],
  ["/delovi/kocioni-diskovi?marka=volkswagen&model=golf&generacija=golf-7", 390, 844, "catf-390"],
  ["/delovi/kocioni-diskovi/volkswagen/golf", 390, 664, "landm-390x664"],
  ["/delovi/kocioni-diskovi", 390, 664, "cat-390x664"],
]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: "v-vs09b" });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const hdr = document.querySelector("main h1")?.closest("header");
    const ps = hdr ? [...hdr.querySelectorAll("p")] : [];
    const card = document.querySelector("main article");
    const leafs = card ? [...card.querySelectorAll("*")].filter((e) => e.children.length === 0 && /RSD/.test(e.textContent)) : [];
    const name = card?.querySelector("h3, h2, a");
    return {
      url: location.pathname + location.search,
      leadTexts: ps.map((p) => p.textContent.trim().slice(0, 140)),
      leadBottom: ps[0] ? Math.round(ps[0].getBoundingClientRect().bottom) : null,
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
      nameBottom: name ? Math.round(name.getBoundingClientRect().bottom) : null,
      priceBottom: leafs.length ? Math.round(Math.max(...leafs.map((e) => e.getBoundingClientRect().bottom))) : null,
      btnBottom: card?.querySelector("button") ? Math.round(card.querySelector("button").getBoundingClientRect().bottom) : null,
      vh: innerHeight,
    };
  });
  m.name = name;
  out.push(m);
  await shot(page, `verify/vis-store/vis-store-09-reproduce-${name}`);
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-09-reproduce-b.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
