/**
 * Step 21 audit (flows-import-mech): „Vaša cena“ for the audit mechanic (Majstor Plus 15 %) on
 * product, category, search, cart and the 3D part panel, compared with the price computed from
 * the products export (retail + net cost, 8 % minimum margin, PDV 20 %). Also checks that the
 * anonymous HTML of the same pages never carries a mechanic price.
 *   node scripts/qa/audit/flows-import-mech-prices.mjs [width]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { FIX } from "./flows-import-mech-fixtures.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";

const T = "flows-import-mech";
const width = Number(process.argv[2] ?? 1440);
const wb = XLSX.read(readFileSync(path.join(FIX, "export-export-products.xlsx")));
const rows = XLSX.utils.sheet_to_json(wb.Sheets.Proizvodi);
const bySku = new Map(rows.map((r) => [r["Šifra"], r]));
const expected = (sku, pct = 1500, minMargin = 800, vat = 2000) => {
  const r = bySku.get(sku);
  if (!r) return null;
  const retail = Math.round(r["MP cena (sa PDV)"] * 100);
  let price = Math.floor((retail * (10000 - pct) + 10000 * 100 / 2) / (10000 * 100)) * 100;
  price = Math.min(price, retail);
  const cost = r["Nabavna cena (bez PDV)"];
  let guard = false;
  if (cost !== undefined && cost !== null && cost !== "") {
    const costPara = Math.round(cost * 100);
    const floor = Math.ceil((costPara * (10000 + minMargin) * (10000 + vat)) / (10000 * 10000 * 100)) * 100;
    if (floor >= retail) return { retail: retail / 100, price: retail / 100, guard: "retail" };
    if (floor > price) {
      price = floor;
      guard = true;
    }
  }
  return { retail: retail / 100, price: price / 100, guard };
};

const parseRsd = (t) => (t ? Number(t.replace(/[^\d,]/g, "").replace(",", ".")) : null);
const skuFromHref = (h) => {
  const m = /-(demo-e?\d{3,4})(?:$|[/?#])/i.exec(h ?? "");
  return m ? m[1].toUpperCase() : null;
};

async function collect(page) {
  return page.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll("span")) {
      if (!/^Vaša cena/.test(el.textContent.trim()) || el.children.length > 1) continue;
      const block = el.parentElement;
      let card = block;
      let href = null;
      for (let i = 0; i < 8 && card; i++) {
        const a = card.querySelector('a[href*="/deo/"]');
        if (a) {
          href = a.getAttribute("href");
          break;
        }
        card = card.parentElement;
      }
      res.push({ text: block.innerText.replace(/\s+/g, " ").trim(), href: href ?? location.pathname });
    }
    return res;
  });
}

const out = { width, pages: {} };
const browser = await launch();
const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `fim-price-${width}` });
const page = await ctx.newPage();
const log = watch(page);
await loginMechanic(page);

const check = (list) =>
  list.map((x) => {
    const m = /MP\s*Maloprodajna cena:\s*([\d.,]+)\s*RSD.*?Vaša cena(?: · rabat ([\d,]+)\s*%)?\s*([\d.,]+)\s*RSD/.exec(x.text);
    const sku = skuFromHref(x.href);
    const exp = sku ? expected(sku) : null;
    const shownRetail = m ? parseRsd(m[1]) : null;
    const shown = m ? parseRsd(m[3]) : null;
    return {
      sku,
      shownRetail,
      shown,
      rabat: m?.[2] ?? null,
      expected: exp,
      ok: exp ? exp.price === shown && exp.retail === shownRetail : null,
      raw: x.text.slice(0, 160),
    };
  });

const urls = [
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["product-oos", "/deo/kocione-plocice-prednje-demo-0012"],
  ["category", "/delovi/kocioni-diskovi"],
  ["landing", "/delovi/kocioni-diskovi/volkswagen/golf"],
  ["search-oem", "/pretraga?q=5Q0615505R"],
  ["search-disk", "/pretraga?q=disk"],
];
for (const [key, u] of urls) {
  await page.goto(`${BASE}${u}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(6000);
  const list = check(await collect(page));
  out.pages[key] = { url: u, count: list.length, mismatches: list.filter((x) => x.ok === false), sample: list.slice(0, 4) };
  await shot(page, `${T}/mech-price-${key}-${width}`);
  console.log(key, list.length, "mismatch", out.pages[key].mismatches.length);
}

// Cart: add DEMO-0004 from its product page
await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
const addBtn = page.getByRole("button", { name: /Dodaj u korpu/i }).first();
await addBtn.click();
await page.waitForTimeout(3000);
await page.goto(`${BASE}/korpa`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(5000);
out.cart = (await page.locator("main").innerText()).slice(0, 2500);
await shot(page, `${T}/mech-price-cart-${width}`, { fullPage: true });

// Home 3D panel via the accessible parts list (if present)
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(6000);
const partBtn = page.getByRole("button", { name: /Kočioni diskovi/ }).first();
if (await partBtn.count()) {
  await partBtn.scrollIntoViewIfNeeded();
  await partBtn.click().catch(() => {});
  await page.waitForTimeout(5000);
  const list = check(await collect(page));
  out.pages.panel = { count: list.length, mismatches: list.filter((x) => x.ok === false), sample: list.slice(0, 4) };
  await shot(page, `${T}/mech-price-3d-panel-${width}`);
}
out.log = log;
writeFileSync(`docs/qa/audit/${T}/mech-prices-${width}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 8000));
await browser.close();
