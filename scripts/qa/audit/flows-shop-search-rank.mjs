/** flows-shop: where the named part lands when the query also names the car (part + model). */
import { BASE, launch, newContext, shot } from "./kit.mjs";
import { saveJson } from "./flows-shop-lib.mjs";
const qs = ["pločice golf 7", "plocice golf", "kočioni disk golf 7", "amortizer golf 7", "abs senzor golf", "pločice passat", "kocione plocice octavia", "disk audi a3"];
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-search-rank" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(120_000);
const out = [];
for (const q of qs) {
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(800);
  const names = await page.getByTestId("product-card").evaluateAll((els) => els.map((e) => e.querySelector("h3,h2,a")?.textContent?.trim() ?? ""));
  const word = q.split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().slice(0, 5);
  const pos = names.map((n, i) => (n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(word) ? i + 1 : 0)).filter(Boolean);
  out.push({ q, total: names.length, first6: names.slice(0, 6), positionsOfNamedPart: pos });
  console.log(JSON.stringify({ q, total: names.length, first: names.slice(0, 4), pos: pos.slice(0, 10) }));
  if (q === "pločice golf 7" || q === "kočioni disk golf 7") {
    await page.evaluate(() => window.scrollTo(0, (document.querySelector("h1")?.getBoundingClientRect().top ?? 0) + window.scrollY - 70));
    await page.waitForTimeout(1500);
    await shot(page, `flows-shop/search-rank-${q.replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "")}-390`);
  }
}
saveJson("search-rank", out);
await browser.close();
