import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const browser = await launch("chromium");
const out = [];
const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-vis-store-13b" });
const page = await ctx.newPage();
for (const q of ["1k0-615-301-zz", "5Q0.615.505.X", "03L 115 562 Q", "brzina menjaca xyz", "zzqq pumpa"]) {
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
  out.push(await page.evaluate((qq) => {
    const main = document.querySelector("main") ?? document.body;
    return {
      q: qq,
      h1: main.querySelector("h1")?.textContent?.trim(),
      tried: [...main.querySelectorAll("p")].map((p) => p.textContent?.trim()).find((t) => /Tražili smo/.test(t ?? "")) ?? null,
      mono: [...main.querySelectorAll("p .type-code")].map((n) => n.textContent?.trim()),
      catChips: [...main.querySelectorAll("nav[aria-label='Kategorije'] a")].map((a) => a.textContent?.trim()),
    };
  }, q));
}
await browser.close();
writeFileSync("docs/qa/audit/verify/vis-store/vis-store-13-reproduce-variants.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
