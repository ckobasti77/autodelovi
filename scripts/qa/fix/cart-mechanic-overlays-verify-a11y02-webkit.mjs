/**
 * A11Y-02 re-verification, mouse path in WebKit (Safari does not focus buttons/links on click,
 * so the hook's "active element" candidate is <body> and the module-level `lastOutside` decides).
 * Checks that closing the cart drawer does not jump the page to a stale, earlier-focused field.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-a11y02-webkit.mjs [webkit|chromium]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "webkit";
const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const results = [];
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const label = (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}] "${label}"`;
  });

const browser = await launch(engine);
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "vfy02wk", engine });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(3000);
    // Does a mouse click focus a button here?
    const anyBtn = page.locator("main button:visible").first();
    await anyBtn.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(500);
    const clickFocusesButton = await page.evaluate(() => document.activeElement?.tagName === "BUTTON");
    await page.keyboard.press("Escape").catch(() => {});
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(3000);

    // 1. Click into a text field near the top of the page (inputs do take focus on click).
    const field = page.locator("main input[type=text]:visible, main input[type=search]:visible, main input:not([type]):visible, main input[type=number]:visible").first();
    const hasField = (await field.count()) > 0;
    if (hasField) await field.click();
    await page.waitForTimeout(300);
    const fieldDesc = await act(page);
    // 2. Scroll far down; click an add-to-cart button on a card with the mouse.
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(800);
    const addBtns = page.locator("main button:visible").filter({ hasText: /U korpu/ });
    let added = false;
    for (let i = 0; i < (await addBtns.count()); i++) {
      const b = addBtns.nth(i);
      const box = await b.boundingBox();
      if (box && box.y > 120 && box.y < 800) {
        await b.click();
        added = true;
        break;
      }
    }
    await page.waitForTimeout(2000);
    if (await page.locator("[role=dialog]:visible").count()) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    }
    const yBefore = await page.evaluate(() => Math.round(window.scrollY));
    const activeBeforeOpen = await act(page);
    // 3. Click the header cart with the mouse, then close with „Zatvori“ (mouse).
    await page.locator("[data-testid=cart-button]:visible").first().click();
    await page.waitForTimeout(2000);
    const drawerOpen = await page.getByTestId("cart-drawer").isVisible().catch(() => false);
    await page.getByTestId("cart-drawer").getByRole("button", { name: "Zatvori" }).first().click();
    await page.waitForTimeout(1500);
    const rec = {
      engine,
      clickFocusesButton,
      hasField,
      fieldDesc,
      added,
      activeBeforeOpen,
      drawerOpen,
      yBefore,
      yAfter: await page.evaluate(() => Math.round(window.scrollY)),
      after: await act(page),
    };
    results.push(rec);
    console.log(JSON.stringify(rec));
  } catch (e) {
    results.push({ engine, error: String(e).slice(0, 300) });
    console.log("ERR", String(e).slice(0, 300));
  } finally {
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/a11y02-mouse-${engine}.json`, JSON.stringify(results, null, 1));
