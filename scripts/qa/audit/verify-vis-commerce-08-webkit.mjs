import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const out = {};
for (const engine of ["webkit", "firefox"]) {
  const b = await launch(engine);
  const ctx = await newContext(b, { width: 360, height: 780, tag: "vv08w", engine });
  const page = await ctx.newPage();
  for (const route of ["/dostava-i-placanje", "/kolacici"]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const h = document.querySelector("main h1"); h.setAttribute("tabindex", "-1"); h.focus(); });
    let reached = false; const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => { const a = document.activeElement; return { t: a?.tagName, scroller: !!a?.querySelector?.(":scope > table"), txt: (a?.textContent || "").trim().slice(0, 20) }; });
      seen.push(`${r.t}:${r.txt}`);
      if (r.scroller) { reached = true; break; }
    }
    out[`${engine}${route}`] = { reached, firstStops: seen.slice(0, 6) };
  }
  await b.close();
}
writeFileSync("docs/qa/audit/verify/vis-commerce/vis-commerce-08-reproduce-keyboard.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
