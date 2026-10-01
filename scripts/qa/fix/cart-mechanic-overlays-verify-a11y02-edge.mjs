/**
 * A11Y-02 re-verification, edge paths (package cart-mechanic-overlays, step 22):
 *  - completing a vehicle choice from each opener (header chip 1440/1024, hero field, product
 *    fitment badge) — the dialog's main purpose;
 *  - the cart drawer opened from the add-to-cart toast action (390), with a focusin trace;
 *  - vehicle picker opened from the non-modal 3D part panel (1440).
 *
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-a11y02-edge.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
const SHOT = "../fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const results = [];

const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${el.getAttribute("data-testid") || ""}] "${label}"${el.getAttribute("data-vfy") === "opener" ? " (OPENER)" : ""}`;
  });

const traceFocus = (page) =>
  page.evaluate(() => {
    window.__ft = [];
    const t0 = performance.now();
    const d = (el) =>
      !el || el === document.body
        ? "BODY"
        : `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}]"${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24)}"`;
    document.addEventListener("focusin", (e) => window.__ft.push(`${Math.round(performance.now() - t0)} in ${d(e.target)}`), true);
    document.addEventListener("focusout", (e) => window.__ft.push(`${Math.round(performance.now() - t0)} out ${d(e.target)} -> ${d(e.relatedTarget)}`), true);
  });

async function fresh(browser, w, h, url) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vfy02e${w}` });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function chooseGolf(page) {
  const dlg = page.locator("[role=dialog]").last();
  const kb = async (loc) => {
    await loc.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
  };
  await kb(dlg.getByRole("button", { name: /Volkswagen/i }).first());
  await kb(dlg.getByRole("button", { name: /^Golf/ }).first());
  await kb(dlg.locator("button").filter({ hasText: /Golf 7|VII|Mk7/i }).first());
  await kb(dlg.getByRole("button", { name: "Ne znam motor" }));
  await page.waitForTimeout(1200);
}

const browser = await launch();
try {
  // 1. Complete a choice from each opener.
  const openers = [
    { w: 1440, h: 900, url: "/", name: "header chip", loc: (p) => p.locator("header [data-testid=vehicle-picker-trigger]:visible").first() },
    { w: 1024, h: 768, url: "/", name: "header chip", loc: (p) => p.locator("header [data-testid=vehicle-picker-trigger]:visible").first() },
    { w: 1440, h: 900, url: "/", name: "hero field", loc: (p) => p.locator("main [data-testid=vehicle-picker-trigger]:visible").first() },
    { w: 1440, h: 900, url: PRODUCT, name: "product fitment badge", loc: (p) => p.locator("main").getByRole("button", { name: /vozilo/i }).first() },
    { w: 390, h: 844, url: PRODUCT, name: "product fitment badge", loc: (p) => p.locator("main").getByRole("button", { name: /vozilo/i }).first() },
  ];
  for (const o of openers) {
    const { ctx, page } = await fresh(browser, o.w, o.h, o.url);
    try {
      const btn = o.loc(page);
      if (!(await btn.count())) {
        results.push({ case: "choose", ...o, loc: undefined, skipped: "opener not visible" });
        continue;
      }
      await btn.focus();
      await btn.evaluate((el) => el.setAttribute("data-vfy", "opener"));
      const rec = { case: "choose vehicle", w: o.w, route: o.url, opener: o.name, before: await act(page) };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      await chooseGolf(page);
      rec.after = await act(page);
      rec.openerStillConnected = await page.evaluate(() => !!document.querySelector('[data-vfy="opener"]'));
      rec.shot = await shot(page, `${SHOT}/a11y02-edge-choose-${o.name.replace(/\s+/g, "-")}-${o.w}`);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      rec.afterNextTab = await act(page);
      results.push(rec);
      console.log(JSON.stringify(rec));
    } catch (e) {
      results.push({ case: "choose", w: o.w, opener: o.name, error: String(e).slice(0, 300) });
    } finally {
      await ctx.close();
    }
  }

  // 2. Toast action → cart drawer at 390, with a focus trace.
  {
    const { ctx, page } = await fresh(browser, 390, 844, PRODUCT);
    try {
      const add = page.getByTestId("product-add-to-cart").first();
      await add.focus();
      await add.evaluate((el) => el.setAttribute("data-vfy", "opener"));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      await traceFocus(page);
      const action = page.getByRole("button", { name: "Pogledaj korpu" }).first();
      await action.focus();
      const rec = { case: "toast → drawer", w: 390, before: await act(page) };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2200);
      rec.afterOpen = await act(page);
      rec.toastButtonConnected = await page.getByRole("button", { name: "Pogledaj korpu" }).count();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1200);
      rec.after = await act(page);
      rec.trace = await page.evaluate(() => window.__ft);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      rec.afterNextTab = await act(page);
      results.push(rec);
      console.log(JSON.stringify(rec, null, 1));
    } catch (e) {
      results.push({ case: "toast", error: String(e).slice(0, 300) });
    } finally {
      await ctx.close();
    }
  }

  // 3. Vehicle picker from the non-modal part panel (1440): open a part from „Lista delova“.
  {
    const { ctx, page } = await fresh(browser, 1440, 900, "/?deo=kocioni-diskovi");
    try {
      await page.waitForTimeout(2500);
      const panel = page.getByTestId("part-panel");
      const visible = await panel.isVisible().catch(() => false);
      const btn = panel.getByRole("button", { name: /vozilo/i }).first();
      if (visible && (await btn.count())) {
        await btn.focus();
        await btn.evaluate((el) => el.setAttribute("data-vfy", "opener"));
        const rec = { case: "picker from part panel", w: 1440, before: await act(page) };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
        rec.afterOpen = await act(page);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1200);
        rec.after = await act(page);
        rec.panelStillOpen = await panel.isVisible().catch(() => false);
        results.push(rec);
        console.log(JSON.stringify(rec));
      } else results.push({ case: "picker from part panel", skipped: `panel visible ${visible}` });
    } catch (e) {
      results.push({ case: "part panel", error: String(e).slice(0, 300) });
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/a11y02-edge.json`, JSON.stringify(results, null, 1));
console.log("written", `${OUT}/a11y02-edge.json`);
