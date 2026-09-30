/**
 * Independent verifier for copy-20 (404 title/labels, delivery table payment list). Read-only.
 *   W=1440 node scripts/qa/audit/verify-copy-20.mjs → docs/qa/audit/verify/copy/copy-20-reproduce-*.json/.webp
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const width = Number(process.env.W ?? 1440);
const height = width < 1024 ? 844 : 900;
const res = { width, titles: {} };
const b = await launch();
const ctx = await newContext(b, { width, height, tag: `verify-copy-20-${width}` });
const page = await ctx.newPage();
const log = watch(page);

const TITLED = [
  "/ovo-ne-postoji",
  "/deo/ovaj-deo-ne-postoji-demo-9999",
  "/delovi/nepostojeca-kategorija",
  "/",
  "/delovi",
  "/delovi/kocioni-diskovi",
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/kontakt",
  "/o-nama",
  "/dostava-i-placanje",
  "/korpa",
  "/prijava",
  "/pretraga?q=disk",
  "/vozila/volkswagen/golf",
];
for (const u of TITLED) {
  const r = await page.goto(`${BASE}${u}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  res.titles[u] = { status: r?.status(), title: await page.title() };
}

// 404 chips vs taxonomy labels (category pages H1).
await page.goto(`${BASE}/ovo-ne-postoji`, { waitUntil: "networkidle", timeout: 60_000 });
await scrollThrough(page);
res.notFoundChips = await page.evaluate(() =>
  [...document.querySelectorAll("nav[aria-labelledby='nf-popular'] ul li a")].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") })),
);
const nav = page.locator("nav[aria-labelledby='nf-popular']");
res.notFoundShot = await shot(page, `verify/copy/copy-20-reproduce-${width}-404-chips`, { locator: nav });
res.categoryH1 = {};
for (const c of res.notFoundChips.filter((c) => c.href.startsWith("/delovi/"))) {
  await page.goto(`${BASE}${c.href}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  res.categoryH1[c.href] = {
    h1: await page.locator("h1").first().textContent().then((t) => t.trim().replace(/\s+/g, " ")).catch(() => null),
    title: await page.title(),
  };
}

// Delivery table.
await page.goto(`${BASE}/dostava-i-placanje`, { waitUntil: "networkidle", timeout: 60_000 });
await scrollThrough(page);
res.delivery = await page.evaluate(() => {
  const t = document.querySelector("table");
  if (!t) return null;
  const head = [...t.querySelectorAll("thead th")].map((th) => th.textContent.trim());
  const rows = [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
  const after = [...document.querySelectorAll("main li, main p")]
    .map((e) => e.textContent.trim())
    .filter((s) => /Odloženo plaćanje|odložen/i.test(s))
    .slice(0, 5);
  return { head, rows, deferredExplainedElsewhere: after };
});
const table = page.locator("main table").first();
await table.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
res.tableShot = await shot(page, `verify/copy/copy-20-reproduce-${width}-dostava-table`, { locator: table });
// Also a viewport shot showing the text right under the table (the deferred explanation).
const box = await table.boundingBox();
if (box) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, (await page.evaluate(() => window.scrollY)) + box.y - 80));
  await page.waitForTimeout(1200);
  res.tableViewShot = await shot(page, `verify/copy/copy-20-reproduce-${width}-dostava-viewport`);
}
res.consoleErrors = log.console.slice(0, 5);
writeFileSync(`${OUT}/copy-20-reproduce-${width}.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await b.close();
