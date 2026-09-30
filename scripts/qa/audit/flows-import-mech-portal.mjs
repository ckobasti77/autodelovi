/**
 * Step 21 audit (flows-import-mech): mechanics portal as the shared audit mechanic.
 * Quick order edge cases (exact / spaces / dots / ambiguous / not found / quantities / 55 lines),
 * add to cart, saved vehicles validation, favorites, price list XLSX, profile validation,
 * order history. Writes docs/qa/audit/flows-import-mech/portal.json.
 *   node scripts/qa/audit/flows-import-mech-portal.mjs [section,section]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { BASE, axe, launch, newContext, overflowX, shot, watch } from "./kit.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";
import { FIX } from "./flows-import-mech-fixtures.mjs";

const T = "flows-import-mech";
const only = (process.argv[2] ?? "").split(",").filter(Boolean);
const want = (s) => !only.length || only.includes(s);
const outFile = `docs/qa/audit/${T}/portal.json`;
let out = {};
try {
  out = JSON.parse(readFileSync(outFile, "utf8"));
} catch {}
const save = () => writeFileSync(outFile, JSON.stringify(out, null, 2));
const text = async (loc) => ((await loc.innerText().catch(() => "")) || "").replace(/\n{2,}/g, "\n").slice(0, 4000);

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fim-portal" });
const page = await ctx.newPage();
const log = watch(page);
await loginMechanic(page);

async function go(u, wait = 4000) {
  await page.goto(`${BASE}${u}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(wait);
}

if (want("overview")) {
  await go("/majstor", 5000);
  out.overview = await text(page.locator("main"));
  out.overviewAxe = await axe(page);
  await shot(page, `${T}/portal-overview-1440`);
  save();
}

async function quick(lines, tag) {
  await go("/majstor/brza-porudzbina", 5000);
  const input = page.getByTestId("mechanic-quick-order-input");
  await input.fill(lines.join("\n"));
  await page.waitForTimeout(600);
  const t0 = Date.now();
  await page.getByTestId("mechanic-quick-order-check").click();
  const rows = page.getByTestId("mechanic-quick-order-row");
  await rows.first().waitFor({ timeout: 60000 });
  // wait for skeletons to go
  for (let i = 0; i < 60; i++) {
    const pending = await page.locator('[aria-label="Rezultat provere"] .animate-pulse, [aria-label="Rezultat provere"] [data-skeleton]').count();
    if (!pending) break;
    await page.waitForTimeout(500);
  }
  const ms = Date.now() - t0;
  await page.waitForTimeout(1500);
  const n = await rows.count();
  const rowTexts = [];
  for (let i = 0; i < Math.min(n, 12); i++) rowTexts.push((await rows.nth(i).innerText()).replace(/\s+/g, " ").slice(0, 300));
  const region = await text(page.locator('[aria-label="Rezultat provere"]'));
  return { tag, lines: lines.length, rows: n, ms, rowTexts, region: region.slice(0, 2500) };
}

if (want("quick")) {
  const r = await quick(
    [
      "5Q0615505R 2",
      "5Q0 615 505 R 1",
      "5Q0.615.505.R x3",
      "038 121 662 1",
      "ZZ9999999 3",
      "036121959P;4",
      "036 121 959 P\t2",
      "5q0-615-505-r 0",
      "5Q0615505R 1500",
    ],
    "edge",
  );
  out.quickEdge = r;
  await shot(page, `${T}/portal-quick-edge-1440`, { fullPage: true });
  out.quickEdgeAxe = await axe(page);
  save();

  // 55 lines from the demo catalogue (OEM codes from the products export fixture)
  const wb = XLSX.read(readFileSync(path.join(FIX, "export-export-products.xlsx")));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Proizvodi);
  const codes = rows
    .map((x) => String(x["OEM brojevi"] ?? "").split(";")[0].trim())
    .filter(Boolean)
    .slice(0, 55);
  const big = await quick(codes.map((c, i) => `${c} ${(i % 3) + 1}`), "55");
  out.quick55 = { ...big, rowTexts: big.rowTexts.slice(0, 3) };
  out.quick55.statusCounts = await page.evaluate(() => {
    const t = document.querySelector('[aria-label="Rezultat provere"]')?.innerText ?? "";
    return {
      exact: (t.match(/Tačno/g) ?? []).length,
      ambiguous: (t.match(/Više opcija/gi) ?? []).length,
      notFound: (t.match(/Nije pronađen/gi) ?? []).length,
    };
  });
  await shot(page, `${T}/portal-quick-55-1440`);
  save();
}

if (want("quick390")) {
  const c2 = await newContext(browser, { width: 390, height: 844, tag: "fim-portal-390" });
  const p2 = await c2.newPage();
  await loginMechanic(p2, "/majstor");
  await p2.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load", timeout: 90000 });
  await p2.waitForTimeout(5000);
  await p2.getByTestId("mechanic-quick-order-input").fill(["5Q0615505R 2", "038 121 662 1", "ZZ9999999 3"].join("\n"));
  await p2.getByTestId("mechanic-quick-order-check").click();
  await p2.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
  await p2.waitForTimeout(4000);
  out.quick390 = { overflow: await overflowX(p2) };
  const res = p2.locator('[aria-label="Rezultat provere"]');
  await res.scrollIntoViewIfNeeded();
  await p2.waitForTimeout(800);
  await shot(p2, `${T}/portal-quick-390`);
  await shot(p2, `${T}/portal-quick-390-full`, { fullPage: true });
  save();
  await c2.close();
}

if (want("vehicles")) {
  await go("/majstor/vozila", 5000);
  out.vehiclesBefore = await text(page.locator("main"));
  const addBtn = page.getByRole("button", { name: /Dodaj vozilo|Novo vozilo|Dodaj/ }).first();
  await addBtn.click().catch(() => {});
  await page.waitForTimeout(1000);
  // empty submit
  await page.getByRole("button", { name: "Sačuvaj vozilo" }).click();
  await page.waitForTimeout(800);
  out.vehiclesEmptyErrors = await text(page.locator("form").first());
  // bad VIN
  await page.getByLabel("Broj šasije (VIN)").fill("WVWZZZ1KZ6W00001O");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Sačuvaj vozilo" }).click();
  await page.waitForTimeout(800);
  out.vehiclesBadVin = await text(page.locator("form").first());
  await shot(page, `${T}/portal-vehicles-errors-1440`);
  // valid
  await page.getByLabel("Broj šasije (VIN)").fill("WVWZZZAUZFW123456");
  await page.waitForTimeout(1500);
  out.vehiclesVinHelp = await text(page.locator("form").first());
  await page.getByLabel("Mušterija ili oznaka").fill(`Audit Petrović — Golf ${Date.now() % 10000}`);
  const brand = page.getByLabel("Marka");
  await brand.selectOption({ label: "Volkswagen" }).catch(async () => brand.selectOption({ index: 1 }));
  await page.waitForTimeout(500);
  await page.getByLabel("Model").selectOption({ label: "Golf" }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByLabel("Generacija").selectOption({ index: 1 }).catch(() => {});
  await page.getByLabel("Tablice").fill("kg 123-ač");
  await page.getByLabel("Napomena").fill("Menjani diskovi i pločice, proveriti ležaj točka");
  await page.getByRole("button", { name: "Sačuvaj vozilo" }).click();
  await page.waitForTimeout(3000);
  out.vehiclesAfter = await text(page.locator("main"));
  await shot(page, `${T}/portal-vehicles-saved-1440`);
  save();
}

if (want("favorites")) {
  await go("/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 6000);
  const fav = page.getByRole("button", { name: /omiljen/i }).first();
  out.favButton = { count: await page.getByRole("button", { name: /omiljen/i }).count(), label: await fav.getAttribute("aria-label").catch(() => null), pressed: await fav.getAttribute("aria-pressed").catch(() => null) };
  await go("/majstor/omiljeno", 5000);
  out.favorites = await text(page.locator("main"));
  await shot(page, `${T}/portal-favorites-1440`);
  save();
}

if (want("pricelist")) {
  await go("/majstor/cenovnik", 5000);
  out.priceListPage = await text(page.locator("main"));
  const boxes = page.getByRole("checkbox", { name: /Kočioni diskovi|Kočione pločice|Filter ulja/ });
  const bc = await boxes.count();
  for (let i = 0; i < bc; i++) await boxes.nth(i).click().catch(() => {});
  await page.waitForTimeout(500);
  const link = page.getByTestId("mechanic-price-list-download");
  const href = await link.getAttribute("href");
  out.priceListHref = href;
  await shot(page, `${T}/portal-pricelist-1440`);
  const resp = await page.request.get(`${BASE}${href}`);
  const headers = resp.headers();
  const body = await resp.body();
  const wb = XLSX.read(body);
  const sheets = {};
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true });
    sheets[name] = { rows: aoa.length, head: aoa.slice(0, 8), cols: wb.Sheets[name]["!cols"]?.length ?? 0, autofilter: wb.Sheets[name]["!autofilter"] ?? null, freeze: wb.Sheets[name]["!freeze"] ?? null };
  }
  out.priceList = { status: resp.status(), type: headers["content-type"], disposition: headers["content-disposition"], robots: headers["x-robots-tag"], bytes: body.length, sheets };
  save();
}

if (want("profile")) {
  await go("/majstor/profil", 5000);
  out.profile = await text(page.locator("main"));
  const phone = page.getByLabel("Telefon");
  const old = await phone.inputValue();
  await phone.fill("12");
  await page.getByRole("button", { name: /Sačuvaj/ }).first().click();
  await page.waitForTimeout(1200);
  out.profileBadPhone = await text(page.locator("main"));
  await shot(page, `${T}/portal-profile-error-1440`);
  await phone.fill(old);
  await page.getByRole("button", { name: /Sačuvaj/ }).first().click();
  await page.waitForTimeout(1500);
  out.profileRestored = old;
  save();
}

if (want("orders")) {
  await go("/majstor/porudzbine", 5000);
  out.orders = await text(page.locator("main"));
  await shot(page, `${T}/portal-orders-1440`);
  const first = page.locator('main a[href*="/majstor/porudzbine/"]').first();
  if (await first.count()) {
    await first.click();
    await page.waitForTimeout(5000);
    out.orderDetailUrl = page.url();
    out.orderDetail = await text(page.locator("main"));
    await shot(page, `${T}/portal-order-detail-1440`, { fullPage: true });
  }
  save();
}

out.log = log;
save();
console.log(JSON.stringify(out, null, 1).slice(0, 12000));
await browser.close();
