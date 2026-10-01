/**
 * Independent re-verification of A11Y-02 (package cart-mechanic-overlays, step 22).
 * Focus return after closing trigger-less overlays, keyboard only. The opener element is tagged
 * with data-vfy="opener" before opening, so "after" proves identity, not just a similar label.
 *
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-a11y02.mjs [chromium|firefox|webkit] [reduce]
 *
 * Output: docs/qa/fix/cart-mechanic-overlays/verify/a11y02-<engine>[-reduce].json (+ screenshots).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "chromium";
const reduce = process.argv[3] === "reduce";
const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
const SHOT = "../fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const results = [];

const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { desc: "BODY", opener: false, fv: false };
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    let fv = false;
    try {
      fv = el.matches(":focus-visible");
    } catch {}
    return {
      desc: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${el.getAttribute("data-testid") || ""}] "${label}"`,
      opener: el.getAttribute("data-vfy") === "opener",
      fv,
    };
  });
const mark = (loc) => loc.evaluate((el) => el.setAttribute("data-vfy", "opener"));

async function finish(page, rec, shotName) {
  await page.waitForTimeout(1100);
  const a = await act(page);
  rec.after = a.desc;
  rec.sameElement = a.opener;
  rec.focusVisible = a.fv;
  rec.dialogsOpen = await page.locator("[role=dialog]:visible").count();
  rec.openerStillConnected = await page.evaluate(() => !!document.querySelector('[data-vfy="opener"]'));
  if (shotName) rec.shot = await shot(page, `${SHOT}/${shotName}`);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  rec.afterNextTab = (await act(page)).desc;
  results.push(rec);
  console.log(JSON.stringify(rec));
}

async function fresh(browser, w, h, url) {
  const ctx = await newContext(browser, {
    width: w,
    height: h,
    tag: `vfy02${w}`,
    engine,
    reducedMotion: reduce ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const browser = await launch(engine);
const sizes = engine === "chromium" ? [[1440, 900], [390, 844]] : [[1440, 900]];
const tagSuffix = `${engine}${reduce ? "-reduce" : ""}`;

try {
  for (const [w, h] of sizes) {
    // 1. Vehicle picker on / — every visible trigger, Escape and „Zatvori“.
    for (const idx of [0, 1]) {
      for (const how of ["Escape", "Zatvori"]) {
        const { ctx, page } = await fresh(browser, w, h, "/");
        try {
          const trigs = page.locator("[data-testid=vehicle-picker-trigger]:visible");
          if (idx >= (await trigs.count())) {
            results.push({ engine, w, overlay: "vehicle-picker", idx, how, skipped: "no such visible trigger" });
            continue;
          }
          await trigs.nth(idx).focus();
          await mark(trigs.nth(idx));
          const rec = { engine, reduce, w, overlay: "vehicle-picker", route: "/", opener: `trigger#${idx}`, before: (await act(page)).desc, how };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
          rec.afterOpen = (await act(page)).desc;
          if (how === "Escape") await page.keyboard.press("Escape");
          else {
            await page.locator("[role=dialog]").last().getByRole("button", { name: "Zatvori" }).focus();
            await page.keyboard.press("Enter");
          }
          await finish(page, rec, idx === 0 && how === "Escape" ? `a11y02-vehicle-${tagSuffix}-${w}` : null);
        } catch (e) {
          results.push({ engine, w, overlay: "vehicle-picker", idx, how, error: String(e).slice(0, 300) });
        } finally {
          await ctx.close();
        }
      }
    }

    // 2. Vehicle picker — complete a choice by keyboard; the chip re-renders with the vehicle.
    {
      const { ctx, page } = await fresh(browser, w, h, "/");
      try {
        const trig = page.locator("[data-testid=vehicle-picker-trigger]:visible").first();
        await trig.focus();
        await mark(trig);
        const rec = { engine, reduce, w, overlay: "vehicle-picker", route: "/", opener: "trigger#0", before: (await act(page)).desc, how: "choose vehicle" };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2000);
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
        await finish(page, rec, `a11y02-vehicle-chosen-${tagSuffix}-${w}`);
        rec.chipNow = await page.locator("[data-testid=vehicle-picker-trigger]:visible").first().innerText().catch(() => "?");
      } catch (e) {
        results.push({ engine, w, overlay: "vehicle-picker-choose", error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 3. Vehicle picker from the product page and the category page controls in <main>.
    for (const url of [PRODUCT, "/delovi/kocioni-diskovi"]) {
      const { ctx, page } = await fresh(browser, w, h, url);
      try {
        const btn = page.locator("main").getByRole("button", { name: /vozilo/i }).first();
        if (await btn.count()) {
          await btn.focus();
          await mark(btn);
          const rec = { engine, reduce, w, overlay: "vehicle-picker", route: url, opener: "main button /vozilo/", before: (await act(page)).desc, how: "Escape" };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
          rec.afterOpen = (await act(page)).desc;
          await page.keyboard.press("Escape");
          await finish(page, rec, null);
        } else results.push({ engine, w, overlay: "vehicle-picker", url, skipped: "no main /vozilo/ button" });
      } catch (e) {
        results.push({ engine, w, overlay: "vehicle-picker", url, error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 4. Cart drawer on the product page: add by keyboard, then open from the header cart.
    for (const how of ["Escape", "Nastavi kupovinu"]) {
      const { ctx, page } = await fresh(browser, w, h, PRODUCT);
      try {
        const add = page.getByTestId("product-add-to-cart").first();
        await add.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2500);
        const drawerAfterAdd = await page.getByTestId("cart-drawer").isVisible().catch(() => false);
        const afterAdd = (await act(page)).desc;
        if (drawerAfterAdd) {
          await page.keyboard.press("Escape");
          await page.waitForTimeout(1000);
        }
        const cart = page.locator("[data-testid=cart-button]:visible").first();
        await cart.focus();
        await mark(cart);
        const rec = { engine, reduce, w, overlay: "cart-drawer", route: PRODUCT, opener: "header cart", drawerAfterAdd, afterAdd, before: (await act(page)).desc, how };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(2200);
        rec.afterOpen = (await act(page)).desc;
        rec.url = page.url().replace(BASE, "");
        if (how === "Escape") await page.keyboard.press("Escape");
        else {
          await page.getByTestId("cart-drawer").getByRole("button", { name: "Nastavi kupovinu" }).focus();
          await page.keyboard.press("Enter");
        }
        await finish(page, rec, how === "Escape" ? `a11y02-cart-${tagSuffix}-${w}` : null);
      } catch (e) {
        results.push({ engine, w, overlay: "cart-drawer", how, error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 4b. Cart drawer opened by the add-to-cart toast action (< 1024 only): fallback path.
    if (w < 1024) {
      const { ctx, page } = await fresh(browser, w, h, PRODUCT);
      try {
        const add = page.getByTestId("product-add-to-cart").first();
        await add.focus();
        await mark(add);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        const action = page.getByRole("button", { name: "Pogledaj korpu" }).first();
        if (await action.count()) {
          await action.focus();
          const rec = { engine, reduce, w, overlay: "cart-drawer", route: PRODUCT, opener: "toast action „Pogledaj korpu“ (add-to-cart tagged)", before: (await act(page)).desc, how: "Escape" };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2200);
          rec.afterOpen = (await act(page)).desc;
          await page.keyboard.press("Escape");
          await finish(page, rec, null);
        } else results.push({ engine, w, overlay: "cart-drawer-toast", skipped: "no toast action" });
      } catch (e) {
        results.push({ engine, w, overlay: "cart-drawer-toast", error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 5. Header search on the category page: open, type „disk“, Escape (twice if the listbox eats one).
    {
      const { ctx, page } = await fresh(browser, w, h, "/delovi/kocioni-diskovi");
      try {
        const trig =
          w >= 1280
            ? page.getByTestId("header-search-trigger")
            : page.locator("header").getByRole("button", { name: "Pretraga delova" });
        await trig.first().focus();
        await mark(trig.first());
        const rec = { engine, reduce, w, overlay: "header-search", route: "/delovi/kocioni-diskovi", opener: "header search", before: (await act(page)).desc, how: "type disk + Escape" };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1800);
        rec.afterOpen = (await act(page)).desc;
        await page.keyboard.type("disk", { delay: 60 });
        await page.waitForTimeout(1500);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);
        rec.escapes = 1;
        if (await page.locator("[role=dialog]:visible").count()) {
          await page.keyboard.press("Escape");
          rec.escapes = 2;
        }
        await finish(page, rec, `a11y02-search-${tagSuffix}-${w}`);
      } catch (e) {
        results.push({ engine, w, overlay: "header-search", error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 6. Parts list (home hero) — motion-3d-02.
    {
      const { ctx, page } = await fresh(browser, w, h, "/");
      try {
        const pl = page.getByTestId("parts-list-trigger").first();
        if (await pl.count()) {
          await pl.focus();
          await mark(pl);
          const rec = { engine, reduce, w, overlay: "parts-list", route: "/", opener: "Lista delova", before: (await act(page)).desc, how: "Escape" };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
          rec.afterOpen = (await act(page)).desc;
          await page.keyboard.press("Escape");
          await finish(page, rec, null);
        } else results.push({ engine, w, overlay: "parts-list", skipped: "no trigger" });
      } catch (e) {
        results.push({ engine, w, overlay: "parts-list", error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }

    // 7. Controls (< 1024): mobile menu (now also trigger-less, lazy panel) and the filter sheet (Radix Trigger).
    if (w < 1024) {
      for (const which of ["mobile-menu", "filters"]) {
        const { ctx, page } = await fresh(browser, w, h, "/delovi/kocioni-diskovi");
        try {
          const btn =
            which === "mobile-menu"
              ? page.getByTestId("mobile-menu-trigger")
              : page.locator("main").getByRole("button", { name: /^Filteri/ }).first();
          await btn.focus();
          await mark(btn);
          const rec = { engine, reduce, w, overlay: `${which} (control)`, route: "/delovi/kocioni-diskovi", before: (await act(page)).desc, how: "Escape" };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(1800);
          rec.afterOpen = (await act(page)).desc;
          await page.keyboard.press("Escape");
          await finish(page, rec, null);
        } catch (e) {
          results.push({ engine, w, overlay: which, error: String(e).slice(0, 300) });
        } finally {
          await ctx.close();
        }
      }
    }

    // 8. Real Tab walk to the header chip (1440 only), like the audit skeptic.
    if (w >= 1024) {
      const { ctx, page } = await fresh(browser, w, h, "/");
      try {
        let hit = false;
        let tabs = 0;
        for (; tabs < 25; tabs++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(80);
          hit = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "vehicle-picker-trigger");
          if (hit) break;
        }
        if (hit) {
          await page.evaluate(() => document.activeElement.setAttribute("data-vfy", "opener"));
          const rec = { engine, reduce, w, overlay: "vehicle-picker", route: "/", opener: `Tab walk (${tabs + 1} tabs)`, before: (await act(page)).desc, how: "Escape" };
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
          await page.keyboard.press("Escape");
          await finish(page, rec, `a11y02-tabwalk-${tagSuffix}-${w}`);
        } else results.push({ engine, w, overlay: "tab-walk", skipped: "chip not reached in 25 tabs" });
      } catch (e) {
        results.push({ engine, w, overlay: "tab-walk", error: String(e).slice(0, 300) });
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
}

const file = `${OUT}/a11y02-${tagSuffix}.json`;
writeFileSync(file, JSON.stringify(results, null, 1));
const cases = results.filter((r) => r.after !== undefined);
console.log(
  `SUMMARY ${tagSuffix}: cases ${cases.length}, BODY ${cases.filter((r) => r.after === "BODY").length}, sameElement ${cases.filter((r) => r.sameElement).length}, errors ${results.filter((r) => r.error).length}, skipped ${results.filter((r) => r.skipped).length} -> ${file}`,
);
