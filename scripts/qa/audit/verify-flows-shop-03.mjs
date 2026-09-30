/**
 * Independent verification of flows-shop-03 (SF-13): search results ignore the selected vehicle.
 * Selects the vehicle through the real picker UI (hero field at 390, header chip at 1440), searches
 * from the header, and compares with a fresh context without a vehicle and with the category
 * landing for the same vehicle. Evidence: docs/qa/audit/verify/flows-shop/flows-shop-03-reproduce.*
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";

const OUT = "verify/flows-shop";
mkdirSync(`docs/qa/audit/${OUT}`, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = {};

async function pickVehicle(page, width) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // Wait for hydration and click the visible picker trigger (hero field on mobile, header chip on desktop).
  const trigger = page.locator('[data-testid="vehicle-picker-trigger"]:visible').first();
  await trigger.waitFor({ timeout: 60_000 });
  await sleep(2500);
  await trigger.click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  await dlg.getByRole("button", { name: "Volkswagen", exact: true }).click();
  await dlg.getByRole("list", { name: "Modeli" }).getByRole("button", { name: /^Golf$/ }).first().click();
  const gens = dlg.getByRole("list", { name: "Generacije" });
  await gens.waitFor();
  const genNames = await gens.getByRole("button").allInnerTexts();
  await gens.getByRole("button", { name: /Golf (VII|7)\b/ }).first().click();
  await dlg.getByRole("list", { name: "Motori" }).getByRole("button", { name: "Ne znam motor" }).click();
  await sleep(800);
  const stored = await page.evaluate(() => localStorage.getItem("sk.vehicle.v1"));
  await shot(page, `${OUT}/flows-shop-03-reproduce-${width}-vehicle-chosen`);
  return { genNames: genNames.map((t) => t.replace(/\s+/g, " ").trim()), stored };
}

async function headerSearch(page, q) {
  const vis = page.locator('[data-testid="header-search-trigger"]:visible');
  if (await vis.count()) await vis.first().click();
  else await page.getByRole("button", { name: "Pretraga delova" }).first().click();
  const input = page.locator('[data-testid="header-search-input"] input, input[data-testid="header-search-input"]').first();
  await input.waitFor();
  await input.fill(q);
  await input.press("Enter");
  await page.waitForURL(/\/pretraga\?q=/, { timeout: 60_000 });
  await page.locator("h1").first().waitFor();
  await sleep(3500);
}

async function readSearch(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const text = main?.innerText ?? "";
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    return {
      url: location.pathname + location.search,
      h1: document.querySelector("h1")?.textContent?.trim(),
      meta: document.querySelector("h1 + p, h1 ~ p")?.textContent?.replace(/\s+/g, " ").trim(),
      cards: cards.length,
      cardNames: cards.map((c) => (c.querySelector("h2,h3,a")?.textContent ?? "").trim().slice(0, 70)),
      fitBadges: cards.filter((c) => /Odgovara za|Univerzalni deo/.test(c.innerText)).length,
      vehicleMention: /Golf VII|Golf 7|vaše vozilo|vaš auto|za vaš/i.test(text),
      chipInHeader: [...document.querySelectorAll('header [data-testid="vehicle-picker-trigger"]')].map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim()),
      toggle: [...document.querySelectorAll("main button, main a")].map((e) => e.textContent?.trim()).filter((t) => /samo za|prikaži sve|moje vozilo|moj auto/i.test(t ?? "")),
    };
  });
}

async function readListing(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor();
  await sleep(3500);
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    return {
      url: location.pathname + location.search,
      h1: document.querySelector("h1")?.textContent?.trim(),
      countText: (document.querySelector("main")?.innerText.match(/\d+\s+(artikal|artikla|artikala|proizvod\w*)/) ?? [])[0],
      cards: cards.length,
      cardNames: cards.map((c) => (c.querySelector("h2,h3,a")?.textContent ?? "").trim().slice(0, 70)),
      fitBadges: cards.filter((c) => /Odgovara za|Univerzalni deo/.test(c.innerText)).length,
    };
  });
}

const browser = await launch();
for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  const r = (result[w] = {});
  // A. with the vehicle chosen through the UI
  const ctx = await newContext(browser, { width: w, height: h, tag: `verify-fs03-${w}` });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(150_000);
  const log = watch(page);
  r.pick = await pickVehicle(page, w);
  for (const q of ["kočioni disk", "pločice"]) {
    await headerSearch(page, q);
    r[`withVehicle:${q}`] = await readSearch(page);
    if (q === "kočioni disk") await shot(page, `${OUT}/flows-shop-03-reproduce-${w}-search-with-vehicle`);
  }
  // Category page with the same stored vehicle (does the catalog apply it?)
  r.categoryWithVehicle = await readListing(page, "/delovi/kocioni-diskovi");
  await shot(page, `${OUT}/flows-shop-03-reproduce-${w}-category-with-vehicle`);
  r.landingGolf = await readListing(page, "/delovi/kocioni-diskovi/volkswagen/golf");
  r.log = log;
  await ctx.close();

  // B. fresh context, no vehicle
  const ctx2 = await newContext(browser, { width: w, height: h, tag: `verify-fs03-nov-${w}` });
  const p2 = await ctx2.newPage();
  p2.setDefaultTimeout(60_000);
  p2.setDefaultNavigationTimeout(150_000);
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  for (const q of ["kočioni disk", "pločice"]) {
    await headerSearch(p2, q);
    r[`noVehicle:${q}`] = await readSearch(p2);
    if (q === "kočioni disk") await shot(p2, `${OUT}/flows-shop-03-reproduce-${w}-search-no-vehicle`);
  }
  await ctx2.close();
  console.log(w, JSON.stringify(r, null, 1).slice(0, 5000));
}
writeFileSync(`docs/qa/audit/${OUT}/flows-shop-03-reproduce.json`, JSON.stringify(result, null, 1));
await browser.close();
