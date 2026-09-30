// Independent verification of flows-shop-02 (search relevance for "<part> + car" queries).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/flows-shop";
mkdirSync(OUT, { recursive: true });

const QUERIES = [
  { q: "pločice golf 7", part: /plo[čc]ic/i },
  { q: "kočione pločice golf 7", part: /plo[čc]ic/i },
  { q: "kočioni disk golf 7", part: /disk/i },
  { q: "amortizer golf 7", part: /amortizer/i },
  { q: "golf 7", part: null },
  { q: "disk", part: /disk/i },
  { q: "plocice golf", part: /plo[čc]ic/i },
  { q: "pločice", part: /plo[čc]ic/i },
  { q: "disk golf", part: /disk/i },
  { q: "filter ulja golf 7", part: /filter ulja|uljni filter/i },
  { q: "akumulator golf 7", part: /akumulator/i },
];

const engine = process.argv[2] ?? "chromium";
const width = Number(process.argv[3] ?? 390);
const browser = await launch(engine);
const report = { engine, width, base: BASE, at: new Date().toISOString(), queries: [] };
let i = 0;
for (const { q, part } of QUERIES) {
  const context = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `v-fs02-${i}`, engine });
  const page = await context.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle", timeout: 90_000 });
  const data = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')].map((c) => ({
      name: c.querySelector("a[data-card-link]")?.textContent?.trim() ?? "",
      slug: c.getAttribute("data-product-slug"),
    }));
    const chips = [...document.querySelectorAll('nav[aria-label="Kategorije"] a')].map((a) => a.textContent.trim());
    const h1 = document.querySelector("h1")?.textContent?.trim();
    const count = document.querySelector("h1 + p")?.textContent?.trim();
    const groupHeadings = [...document.querySelectorAll("h2")].map((h) => h.textContent.trim()).slice(0, 6);
    return { cards, chips, h1, count, groupHeadings };
  });
  const firstPartIdx = part ? data.cards.findIndex((c) => part.test(c.name)) : null;
  const partCount = part ? data.cards.filter((c) => part.test(c.name)).length : null;
  report.queries.push({
    q,
    total: data.cards.length,
    count: data.count,
    chips: data.chips,
    groupHeadings: data.groupHeadings,
    firstNamedPartPosition: firstPartIdx === null ? null : firstPartIdx + 1,
    namedPartCount: partCount,
    first10: data.cards.slice(0, 10).map((c) => c.name),
    errors: [...log.console, ...log.pageErrors],
  });
  if (i < 4 || q === "disk") {
    const slug = q.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
    const cardsTop = await page.locator('[data-testid="product-card"]').first().boundingBox();
    if (cardsTop) await page.evaluate((y) => window.scrollTo(0, y - 80), cardsTop.y);
    await page.waitForTimeout(1200);
    await shot(page, `verify/flows-shop/flows-shop-02-reproduce-${engine}-${width}-${slug}`);
  }
  await context.close();
  i++;
}
await browser.close();
writeFileSync(`${OUT}/flows-shop-02-reproduce-${engine}-${width}.json`, JSON.stringify(report, null, 2));
for (const r of report.queries)
  console.log(
    `${r.q} | total ${r.total} | first named part @${r.firstNamedPartPosition} (${r.namedPartCount}) | chips ${JSON.stringify(r.chips)}\n   ${r.first10.slice(0, 8).join(" / ")}`,
  );
