/**
 * flows-shop: search robustness — OEM variants, cross numbers, diacritics, Cyrillic, typos,
 * zero results → inquiry CTA. Reads the rendered /pretraga page at 390 px.
 */
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { saveJson } from "./flows-shop-lib.mjs";

const stamp = Date.now().toString(36);
const queries = [
  // OEM variants of 5Q0 615 505 R (DEMO-0004)
  "5Q0615505R",
  "5q0615505r",
  "5Q0 615 505 R",
  "5Q0.615.505.R",
  "5Q0-615-505-R",
  "5Q0/615/505/R",
  "  5q0 615 505r  ",
  "5Q0 615 505",
  "5Q0615",
  // cross number of DEMO-0004
  "OX 408D",
  "ox408d",
  "OX-408-D",
  // names
  "kocioni disk",
  "kočioni disk",
  "KOČIONI DISK",
  "disk kočioni",
  "кочиони диск",
  "кочиони",
  "kocini disk",
  "kočoni disk",
  "diskovi",
  "pločice golf 7",
  "plocice",
  "abs senzor",
  "ležaj točka",
  "lezaj tocka",
  "amortizer golf",
  // zero results
  `zzqx${stamp}`,
  "03L253016T",
  "turbina",
  // edge
  "<b>disk</b>",
  "a",
  "%",
];

const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-search" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(120_000);
const log = watch(page);
const out = [];
for (const q of queries) {
  const url = `${BASE}/pretraga?q=${encodeURIComponent(q)}`;
  const r = { q };
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded" });
    r.status = resp?.status();
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(800);
    r.h1 = (await page.locator("h1").first().innerText()).replace(/\s+/g, " ");
    r.meta = (await page.locator("h1 + p").first().innerText().catch(() => "")).replace(/\s+/g, " ");
    r.groups = await page.locator("section h2").allInnerTexts();
    r.first = (await page.getByTestId("product-card").evaluateAll((els) => els.slice(0, 4).map((e) => e.querySelector("h3,h2,a")?.textContent?.trim()))) ?? [];
    r.cards = await page.getByTestId("product-card").count();
    r.cta = await page.getByRole("link", { name: /Pošaljite upit/ }).first().getAttribute("href").catch(() => null);
    r.catChips = await page.locator('nav[aria-label="Kategorije"] a').allInnerTexts().catch(() => []);
  } catch (e) {
    r.error = String(e).slice(0, 300);
  }
  out.push(r);
  console.log(JSON.stringify([r.q, r.cards, r.groups?.join("/"), r.h1?.slice(0, 50), r.error ?? ""]));
}
// Evidence shots
for (const [q, name] of [
  ["кочиони диск", "search-cyrillic-390"],
  ["kocini disk", "search-typo-390"],
  [`zzqx${stamp}`, "search-zero-390"],
  ["5Q0/615/505/R", "search-oem-slash-390"],
]) {
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor();
  await page.waitForTimeout(1500);
  await shot(page, `flows-shop/${name}`);
}
saveJson("search-results", { stamp, results: out, log });
await ctx.close();
await browser.close();
