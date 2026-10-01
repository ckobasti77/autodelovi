/**
 * Independent verification of a11y-store-02: focus return after closing the vehicle picker,
 * cart drawer and header search (plus controls: mobile menu). Keyboard only.
 * Step 22 close: unmodified audit reproduction, evidence redirected to docs/qa/fix/close/a11y02.
 *   AUDIT_BASE=http://localhost:3100 node scripts/qa/fix/close-a11y02-repro.mjs [chromium|firefox]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "chromium";
const OUT = "docs/qa/fix/close/a11y02";
mkdirSync(OUT, { recursive: true });
const results = [];
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}[${el.getAttribute("data-testid") || ""}] "${label}"`;
  });

async function afterClose(page, rec, shotName) {
  await page.waitForTimeout(1000);
  rec.afterClose = await act(page);
  rec.dialogsOpen = await page.locator("[role=dialog]:visible").count();
  if (shotName) rec.shot = await shot(page, shotName);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(250);
  rec.afterNextTab = await act(page);
  results.push(rec);
  console.log(JSON.stringify(rec));
}

async function fresh(browser, w, h, url) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `ver02${w}`, engine });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

const browser = await launch(engine);
const sizes = engine === "chromium" ? [[1440, 900], [390, 844]] : [[1440, 900]];

for (const [w, h] of sizes) {
  // 1. Vehicle picker on / — every visible trigger, Escape and „Zatvori“.
  for (const idx of [0, 1]) {
    for (const how of ["Escape", "Zatvori"]) {
      const { ctx, page } = await fresh(browser, w, h, "/");
      try {
        const trigs = page.locator("[data-testid=vehicle-picker-trigger]:visible");
        if (idx >= (await trigs.count())) { await ctx.close(); continue; }
        await trigs.nth(idx).focus();
        const rec = { engine, w, overlay: "vehicle-picker", route: "/", opener: `trigger#${idx}`, before: await act(page), how };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1800);
        rec.afterOpen = await act(page);
        if (how === "Escape") await page.keyboard.press("Escape");
        else {
          await page.locator("[role=dialog]").last().getByRole("button", { name: "Zatvori" }).focus();
          await page.keyboard.press("Enter");
        }
        await afterClose(page, rec, idx === 0 && how === "Escape" ? `verify/a11y-store/a11y-store-02-reproduce-vehicle-${engine}-${w}` : null);
      } catch (e) { results.push({ engine, w, overlay: "vehicle-picker", idx, how, error: String(e).slice(0, 200) }); }
      await ctx.close();
    }
  }

  // 2. Vehicle picker — complete a choice (brand → model → generation → „Ne znam motor“) by keyboard.
  {
    const { ctx, page } = await fresh(browser, w, h, "/");
    try {
      const trig = page.locator("[data-testid=vehicle-picker-trigger]:visible").first();
      await trig.focus();
      const rec = { engine, w, overlay: "vehicle-picker", route: "/", opener: "trigger#0", before: await act(page), how: "choose vehicle" };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1800);
      const dlg = page.locator("[role=dialog]").last();
      const clickKb = async (loc) => { await loc.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1500); };
      await clickKb(dlg.getByRole("button", { name: /Volkswagen/i }).first());
      await clickKb(dlg.getByRole("button", { name: /^Golf/ }).first());
      await clickKb(dlg.locator("button").filter({ hasText: /Golf 7|VII|Mk7/i }).first());
      await clickKb(dlg.getByRole("button", { name: "Ne znam motor" }));
      await afterClose(page, rec, null);
      rec.chipNow = await page.locator("[data-testid=vehicle-picker-trigger]:visible").first().innerText().catch(() => "?");
    } catch (e) { results.push({ engine, w, overlay: "vehicle-picker-choose", error: String(e).slice(0, 300) }); }
    await ctx.close();
  }

  // 3. Vehicle picker from the product page fitment badge and the category page control.
  for (const url of ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/delovi/kocioni-diskovi"]) {
    const { ctx, page } = await fresh(browser, w, h, url);
    try {
      const btn = page.locator("main").getByRole("button", { name: /vozilo/i }).first();
      if (await btn.count()) {
        await btn.focus();
        const rec = { engine, w, overlay: "vehicle-picker", route: url, opener: "main button /vozilo/", before: await act(page), how: "Escape" };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1800);
        rec.afterOpen = await act(page);
        await page.keyboard.press("Escape");
        await afterClose(page, rec, null);
      }
    } catch (e) { results.push({ engine, w, overlay: "vehicle-picker", url, error: String(e).slice(0, 200) }); }
    await ctx.close();
  }

  // 4. Cart drawer on the product page: add to cart, open from the header control, Escape / „Nastavi kupovinu“.
  for (const how of ["Escape", "Nastavi kupovinu"]) {
    const { ctx, page } = await fresh(browser, w, h, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004");
    try {
      await page.getByTestId("product-add-to-cart").first().focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2500);
      const cart = page.locator("[data-testid=cart-button]:visible").first();
      await cart.focus();
      const rec = { engine, w, overlay: "cart-drawer", route: "/deo/…-0004", opener: "header cart", before: await act(page), how };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      rec.afterOpen = await act(page);
      rec.url = page.url().replace(BASE, "");
      if (how === "Escape") await page.keyboard.press("Escape");
      else {
        await page.getByTestId("cart-drawer").getByRole("button", { name: "Nastavi kupovinu" }).focus();
        await page.keyboard.press("Enter");
      }
      await afterClose(page, rec, how === "Escape" ? `verify/a11y-store/a11y-store-02-reproduce-cart-${engine}-${w}` : null);
    } catch (e) { results.push({ engine, w, overlay: "cart-drawer", how, error: String(e).slice(0, 200) }); }
    await ctx.close();
  }

  // 5. Header search on the category page: open, type „disk“, Escape (twice if the listbox eats the first).
  {
    const { ctx, page } = await fresh(browser, w, h, "/delovi/kocioni-diskovi");
    try {
      const trig = w >= 1280
        ? page.getByTestId("header-search-trigger")
        : page.locator("header").getByRole("button", { name: "Pretraga delova" });
      await trig.focus();
      const rec = { engine, w, overlay: "header-search", route: "/delovi/kocioni-diskovi", opener: "header search", before: await act(page), how: "type disk + Escape" };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      rec.afterOpen = await act(page);
      await page.keyboard.type("disk", { delay: 60 });
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      rec.escapes = 1;
      if (await page.locator("[role=dialog]:visible").count()) { await page.keyboard.press("Escape"); rec.escapes = 2; }
      await afterClose(page, rec, `verify/a11y-store/a11y-store-02-reproduce-search-${engine}-${w}`);
    } catch (e) { results.push({ engine, w, overlay: "header-search", error: String(e).slice(0, 200) }); }
    await ctx.close();
  }

  // 6. Control: mobile menu (< 1024) returns focus correctly.
  if (w < 1024) {
    const { ctx, page } = await fresh(browser, w, h, "/delovi/kocioni-diskovi");
    try {
      await page.getByTestId("mobile-menu-trigger").focus();
      const rec = { engine, w, overlay: "mobile-menu (control)", route: "/delovi/kocioni-diskovi", before: await act(page), how: "Escape" };
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      rec.afterOpen = await act(page);
      await page.keyboard.press("Escape");
      await afterClose(page, rec, null);
    } catch (e) { results.push({ engine, w, overlay: "mobile-menu", error: String(e).slice(0, 200) }); }
    await ctx.close();
  }
}

writeFileSync(`${OUT}/a11y-store-02-reproduce-${engine}.json`, JSON.stringify(results, null, 1));
await browser.close();
