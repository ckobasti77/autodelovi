// VIS-08 on a short landing: the rail sticks while the results column is in view and leaves
// with it (a sticky box cannot outlive its grid row).
import { writeFileSync } from "node:fs";
import { launch, newContext } from "../audit/kit.mjs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const browser = await launch("chromium");
const out = [];
try {
  const ctx = await newContext(browser, { width: 1280, height: 800, tag: "cpu-rail-landing" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/delovi/kocioni-diskovi/volkswagen/golf", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2000);
  for (const y of [0, 200, 400, 600, 900]) {
    await page.evaluate((v) => scrollTo(0, v), y);
    await page.waitForTimeout(300);
    out.push(
      await page.evaluate(() => {
        const a = document.querySelector('aside[aria-label="Filteri"]');
        const row = a.parentElement.getBoundingClientRect();
        const r = a.getBoundingClientRect();
        return { scrollY, railTop: Math.round(r.top), railH: Math.round(r.height), rowBottom: Math.round(row.bottom), rowH: Math.round(row.height), cards: document.querySelectorAll('[data-testid="product-card"]').length };
      }),
    );
  }
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/catalog-product-ui/vis08-landing-1280.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
