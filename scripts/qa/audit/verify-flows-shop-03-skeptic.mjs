// Skeptic verification of flows-shop-03 (search ignores the selected vehicle, SF-13).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, watch, shot, scrollThrough } from "./kit.mjs";

const OUT = "verify/flows-shop";
const Q = "kočioni disk";
const res = { base: BASE, q: Q };

async function selectGolf7(page) {
  const trig = page.locator('[data-testid="vehicle-picker-trigger"]:visible').first();
  await trig.click();
  await page.getByRole("button", { name: "Volkswagen", exact: true }).click();
  await page.getByRole("button", { name: /^Golf\b/ }).first().click();
  await page.getByRole("button", { name: /Golf VII/ }).first().click();
  await page.getByRole("button", { name: /Ne znam motor/ }).click();
  await page.waitForTimeout(800);
  return page.evaluate(() => localStorage.getItem("sk.vehicle.v1"));
}

async function readResults(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const meta = [...main.querySelectorAll("p")].find((p) => /artik/.test(p.textContent))?.textContent.trim() ?? null;
    const h1 = main.querySelector("h1")?.textContent.trim() ?? null;
    const links = [...main.querySelectorAll('a[href^="/deo/"]')].map((a) => a.getAttribute("href"));
    const slugs = [...new Set(links)];
    const text = main.innerText;
    return {
      h1,
      meta,
      slugs,
      fitLines: (text.match(/Odgovara za/g) ?? []).length,
      mentionsGolf: /Golf/i.test(text),
      mentionsVehicleToggle: /samo za|prikaži sve|za moje vozilo|za vaše vozilo/i.test(text),
    };
  });
}

const browser = await launch("chromium");
try {
  // A. With vehicle selected through the real header picker, search from the header.
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v03s" });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  res.stored = await selectGolf7(page);
  res.chip = await page.locator('[data-testid="vehicle-picker-trigger"]:visible').first().innerText().catch(() => null);

  // Header search: icon button opens the dialog with the SearchBox (GET /pretraga).
  const opener = page.getByRole("button", { name: /Pretra|Broj dela/i }).first();
  let usedHeader = false;
  if (await opener.isVisible().catch(() => false)) {
    await opener.click();
    const input = page.getByRole("combobox", { name: "Broj dela ili naziv" }).or(page.getByLabel("Broj dela ili naziv")).first();
    await input.fill(Q);
    await input.press("Enter");
    usedHeader = true;
  } else {
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(Q)}`);
  }
  await page.waitForURL(/\/pretraga\?/, { timeout: 20000 });
  await page.locator("h1", { hasText: "Rezultati" }).first().waitFor({ timeout: 20000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  res.searchDialogStillOpen = await page.getByRole("dialog").isVisible().catch(() => false);
  if (res.searchDialogStillOpen) await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  res.usedHeader = usedHeader;
  res.searchUrl = page.url();
  res.withVehicle = await readResults(page);
  res.withVehicle.chipAfterNav = await page.locator('[data-testid="vehicle-picker-trigger"]:visible').first().innerText().catch(() => null);
  await shot(page, `${OUT}/flows-shop-03-skeptic-search-golf7-390`);
  await scrollThrough(page);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(600);
  await shot(page, `${OUT}/flows-shop-03-skeptic-search-golf7-scrolled-390`);

  // B. Each result's product page with Golf VII selected: FitmentBadge verdict.
  res.fitByProduct = [];
  for (const slug of res.withVehicle.slugs) {
    await page.goto(`${BASE}${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const verdict = await page.evaluate(() => {
      const t = document.querySelector("main")?.innerText ?? "";
      const m = t.match(/(Ne odgovara za [^\n]+|Odgovara za [^\n]+|Univerzalni deo[^\n]*)/);
      return m ? m[1].slice(0, 120) : null;
    });
    res.fitByProduct.push({ slug, verdict });
  }

  // C. Category page with the vehicle selected (does the catalog narrow automatically?).
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  res.categoryWithVehicle = await page.evaluate(() => {
    const t = document.querySelector("main")?.innerText ?? "";
    const m = t.match(/(\d+)\s+artik\w+/);
    return { count: m ? m[0] : null, fitLines: (t.match(/Odgovara za/g) ?? []).length, golf: /Golf VII/.test(t) };
  });
  await shot(page, `${OUT}/flows-shop-03-skeptic-category-golf7-390`);
  await page.getByRole("button", { name: /Filteri/ }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  res.categoryOnlyForMyCarButton = await page
    .getByRole("button", { name: /Samo za/ })
    .first()
    .innerText()
    .catch(() => null);
  await shot(page, `${OUT}/flows-shop-03-skeptic-category-filters-golf7-390`);
  res.logA = log;
  await ctx.close();

  // D. Same search without a vehicle.
  const ctx2 = await newContext(browser, { width: 390, height: 844, tag: "v03s-novehicle" });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/pretraga?q=${encodeURIComponent(Q)}`, { waitUntil: "networkidle" });
  res.withoutVehicle = await readResults(p2);

  // E. Landing for the vehicle.
  await p2.goto(`${BASE}/delovi/kocioni-diskovi/volkswagen/golf`, { waitUntil: "networkidle" });
  res.landingGolf = await p2.evaluate(() => {
    const t = document.querySelector("main")?.innerText ?? "";
    const m = t.match(/(\d+)\s+artik\w+/);
    return { h1: document.querySelector("h1")?.textContent.trim(), count: m ? m[0] : null };
  });
  await ctx2.close();
} finally {
  await browser.close();
}

mkdirSync(path.resolve("docs/qa/audit", OUT), { recursive: true });
writeFileSync(path.resolve("docs/qa/audit", OUT, "flows-shop-03-skeptic.json"), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
