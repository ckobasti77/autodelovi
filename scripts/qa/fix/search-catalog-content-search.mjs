// FLOW-01/03/04/06 re-verification: search ranking, vehicle narrowing, hasMore, long query.
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-search.mjs
import fs from "node:fs";

import { BASE, launch, newContext, overflowX, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/search-catalog-content";
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, queries: [], vehicle: null, long: null };

const browser = await launch();
try {
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const cards = () =>
    page.$$eval("[data-testid='product-card'] a[data-card-link]", (els) =>
      els.map((e) => e.textContent.trim()).slice(0, 8),
    );
  for (const q of [
    "pločice golf 7",
    "kočioni disk golf 7",
    "amortizer golf 7",
    "golf 7",
    "disk",
    "<b>disk</b>",
    "pločice golf vii",
    "a",
  ]) {
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
    report.queries.push({
      q,
      count: await page.textContent("[data-testid='search-count']").catch(() => null),
      vehicle: await page.textContent("[data-testid='search-vehicle']").catch(() => null),
      chips: await page.$$eval("nav[aria-label='Suzite po kategoriji'] li, nav[aria-label='Kategorija'] li", (els) => els.map((e) => e.textContent.trim())),
      first8: await cards(),
    });
  }
  await shot(page, "../fix/search-catalog-content/search-plocice-golf7-390", {});

  // FLOW-03: selected vehicle in the store → narrowed results with „Prikaži sve“.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() =>
    localStorage.setItem(
      "sk.vehicle.v1",
      JSON.stringify({
        state: {
          vehicle: {
            brand: { slug: "volkswagen", name: "Volkswagen" },
            model: { slug: "golf", name: "Golf" },
            generation: { slug: "golf-7", name: "Golf VII", yearFrom: 2012, yearTo: 2020 },
            engine: null,
          },
        },
        version: 1,
      }),
    ),
  );
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("kočioni disk")}`, {
    waitUntil: "networkidle",
  });
  await page.waitForURL(/vozilo=/, { timeout: 10000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle");
  report.vehicle = {
    url: page.url(),
    count: await page.textContent("[data-testid='search-count']").catch(() => null),
    line: await page.textContent("[data-testid='search-vehicle']").catch(() => null),
    first8: await cards(),
  };
  await shot(page, "../fix/search-catalog-content/search-selected-vehicle-390", {});
  await page.getByRole("link", { name: "Prikaži sve" }).click();
  await page.waitForURL(/vozilo=sva/);
  await page.waitForLoadState("networkidle");
  report.vehicle.all = {
    url: page.url(),
    count: await page.textContent("[data-testid='search-count']").catch(() => null),
    back: await page
      .getByRole("link", { name: /Samo za/ })
      .first()
      .textContent()
      .catch(() => null),
  };
  await page.evaluate(() => localStorage.removeItem("sk.vehicle.v1"));

  // FLOW-06: long token query does not widen the document.
  report.long = {};
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const q of ["5Q0615505R".repeat(4), "x".repeat(120)]) {
      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
      report.long[`${width}:${q.length}`] = await overflowX(page);
    }
  }
  await shot(page, "../fix/search-catalog-content/search-long-390", {});
  await ctx.close();
} finally {
  await browser.close();
}
fs.writeFileSync(`${OUT}/search.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
