/**
 * A11Y-02 (cross-p1, step 22): focus return on opener paths the earlier runs skipped.
 * Keyboard only. For each case: focus the opener, Enter, then close (Escape) or complete a
 * vehicle choice, and record activeElement, whether it is the opener, and the next Tab.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cross-p1-a11y02-paths.mjs [filter]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/cross-p1";
mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] ?? "";
const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const results = [];

const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${el.getAttribute("data-testid") || ""}] "${label}"${el.getAttribute("data-vfy") === "opener" ? " (OPENER)" : ""} fv=${el.matches(":focus-visible")}`;
  });

async function chooseGolf(page) {
  const dlg = page.locator("[role=dialog]").last();
  const kb = async (loc) => {
    await loc.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
  };
  await kb(dlg.getByRole("button", { name: /Volkswagen/i }).first());
  await kb(dlg.getByRole("button", { name: /^Golf/ }).first());
  await kb(dlg.locator("button").filter({ hasText: /Golf 7|VII|Mk7/i }).first());
  await kb(dlg.getByRole("button", { name: "Ne znam motor" }));
  await page.waitForTimeout(1500);
}

const cases = [
  { id: "hero-field-390-esc", w: 390, h: 844, url: "/", opener: (p) => p.locator("main [data-testid=vehicle-picker-trigger]:visible, main button:visible").filter({ hasText: /vozil/i }).first(), how: "esc" },
  { id: "hero-field-390-choose", w: 390, h: 844, url: "/", opener: (p) => p.locator("main [data-testid=vehicle-picker-trigger]:visible, main button:visible").filter({ hasText: /vozil/i }).first(), how: "choose" },
  { id: "catalog-btn-1440-esc", w: 1440, h: 900, url: "/delovi/kocioni-diskovi", opener: (p) => p.locator("main").getByRole("button", { name: "Izaberite vozilo", exact: true }).first(), how: "esc" },
  { id: "catalog-btn-1440-choose", w: 1440, h: 900, url: "/delovi/kocioni-diskovi", opener: (p) => p.locator("main").getByRole("button", { name: "Izaberite vozilo", exact: true }).first(), how: "choose" },
  { id: "catalog-btn-390-esc", w: 390, h: 844, url: "/delovi/kocioni-diskovi", pre: "filters", opener: (p) => p.locator("main").getByRole("button", { name: "Izaberite vozilo", exact: true }).first(), how: "esc" },
  { id: "catalog-btn-390-choose", w: 390, h: 844, url: "/delovi/kocioni-diskovi", pre: "filters", opener: (p) => p.locator("main").getByRole("button", { name: "Izaberite vozilo", exact: true }).first(), how: "choose" },
  { id: "header-chip-1440-close-btn", w: 1440, h: 900, url: "/delovi/kocioni-diskovi", opener: (p) => p.locator("header [data-testid=vehicle-picker-trigger]:visible").first(), how: "zatvori" },
  { id: "search-1440-suggestion", w: 1440, h: 900, url: "/delovi/kocioni-diskovi", opener: (p) => p.locator("[data-testid=header-search-trigger]:visible").first(), how: "suggest" },
  { id: "search-390-submit", w: 390, h: 844, url: "/delovi/kocioni-diskovi", opener: (p) => p.getByRole("button", { name: "Pretraga delova" }).first(), how: "submit" },
  { id: "checkout-edit-cart-1440", w: 1440, h: 900, url: "/porudzbina", cart: true, opener: (p) => p.locator("main").getByRole("button", { name: /korp/i }).first(), how: "esc" },
  { id: "cart-drawer-checkout-link-1440", w: 1440, h: 900, url: PRODUCT, cart: true, opener: (p) => p.locator("header [data-testid=cart-button]:visible").first(), how: "drawer-link" },
];

const browser = await launch();
try {
  for (const c of cases) {
    if (filter && !c.id.includes(filter)) continue;
    const ctx = await newContext(browser, { width: c.w, height: c.h, tag: `cp1-${c.id}` });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    try {
      if (c.cart) {
        await page.goto(BASE + PRODUCT, { waitUntil: "load", timeout: 180000 });
        await page.waitForTimeout(2000);
        await page.getByTestId("product-add-to-cart").first().click();
        await page.waitForTimeout(2000);
      }
      await page.goto(BASE + c.url, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2500);
      if (c.pre === "filters") {
        await page.getByRole("button", { name: /^Filteri/ }).first().focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
      }
      const btn = c.pre === "filters" ? page.locator("[role=dialog]").last().getByRole("button", { name: "Izaberite vozilo", exact: true }).first() : c.opener(page);
      if (!(await btn.count())) {
        results.push({ id: c.id, skipped: "opener not found" });
        console.log(c.id, "SKIPPED");
        continue;
      }
      await btn.scrollIntoViewIfNeeded();
      await btn.focus();
      await btn.evaluate((el) => el.setAttribute("data-vfy", "opener"));
      const rec = { id: c.id, before: await act(page) };
      if (process.env.TRACE) await page.evaluate(() => { window.__ft = []; const t0 = performance.now(); const d = (el) => !el || el === document.body ? "BODY" : el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + "[" + (el.getAttribute("aria-label") || el.textContent || "").replace(/s+/g, " ").trim().slice(0, 24) + "]"; document.addEventListener("focusin", (e) => window.__ft.push(Math.round(performance.now() - t0) + " in " + d(e.target)), true); new MutationObserver(() => {}).observe(document.body, { childList: true, subtree: true }); });
      const y0 = await page.evaluate(() => scrollY);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      rec.afterOpen = await act(page);
      if (c.how === "esc") {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
        
      } else if (c.how === "zatvori") {
        await page.locator("[role=dialog]").last().getByRole("button", { name: "Zatvori" }).first().focus();
        await page.keyboard.press("Enter");
      } else if (c.how === "choose") {
        await chooseGolf(page);
      } else if (c.how === "suggest" || c.how === "submit") {
        await page.keyboard.type("disk", { delay: 60 });
        await page.waitForTimeout(1800);
        if (c.how === "suggest") await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3500);
      } else if (c.how === "drawer-link") {
        const link = page.locator("[role=dialog]").last().getByRole("link").filter({ hasText: /porud/i }).first();
        await link.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(3500);
      }
      await page.waitForTimeout(1200);
      rec.url = page.url().replace(BASE, "");
      rec.dialogsOpen = await page.locator("[role=dialog]:visible").count();
      rec.dialogNames = await page.locator("[role=dialog]:visible").evaluateAll((d) => d.map((x) => x.getAttribute("aria-label") || x.querySelector("h2")?.textContent || "?"));
      rec.after = await act(page);
      rec.scrollDelta = (await page.evaluate(() => scrollY)) - y0;
      rec.openerStillConnected = await page.evaluate(() => !!document.querySelector('[data-vfy="opener"]'));
      await page.keyboard.press("Tab");
      await page.waitForTimeout(250);
      rec.afterNextTab = await act(page);
      rec.errors = errors;
      if (process.env.TRACE) rec.trace = await page.evaluate(() => window.__ft);
      results.push(rec);
      console.log(JSON.stringify(rec));
    } catch (e) {
      results.push({ id: c.id, error: String(e).slice(0, 300) });
      console.log(c.id, "ERROR", String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${OUT}/a11y02-paths${filter ? "-" + filter : ""}.json`, JSON.stringify(results, null, 1));
}
