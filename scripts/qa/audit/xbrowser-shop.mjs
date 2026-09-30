/**
 * xbrowser — core storefront flow per engine × viewport:
 * header search (OEM) → search results → product → quantity control → add to cart →
 * category filter by vehicle (picker) → cart drawer → /korpa → checkout (guest, courier,
 * pouzeće) → submit → thank-you → testing:orderProbe.
 *   XB_ENGINES=webkit node scripts/qa/audit/xbrowser-shop.mjs
 */
import { BASE, convexRun, overflowX, shot, watch } from "./kit.mjs";
import { ENGINES, VIEWS, cspLog, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const PRODUCT = "kocioni-disk-prednji-276-24-mm-demo-0004";
const out = {};
const only = process.env.XB_VIEWS ? process.env.XB_VIEWS.split(",") : null;

async function step(r, name, fn) {
  const t = Date.now();
  try {
    const v = await fn();
    r.steps.push({ name, ok: true, ms: Date.now() - t, ...(v && typeof v === "object" ? v : v !== undefined ? { v } : {}) });
    return true;
  } catch (e) {
    r.steps.push({ name, ok: false, ms: Date.now() - t, error: String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400) });
    return false;
  }
}

for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const v of VIEWS) {
    if (only && !only.includes(v.tag)) continue;
    const key = `${engine}-${v.tag}`;
    const r = (out[key] = { steps: [] });
    const mobile = v.width < 1024;
    const context = await xctx(browser, engine, { width: v.width, height: v.height, tag: `shop${v.tag}` });
    const page = await context.newPage();
    const log = watch(page);
    page.setDefaultTimeout(30_000);

    await step(r, "home", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForFunction(() => document.readyState === "complete", null, { timeout: 90_000 }).catch(() => {}); await page.waitForTimeout(2000);
    });
    const searched = await step(r, "header-search", async () => {
      if (v.width >= 1280) await page.getByTestId("header-search-trigger").click();
      else await page.getByRole("button", { name: "Pretraga delova" }).click();
      const dialog = page.getByRole("dialog", { name: "Pretraga delova" });
      await dialog.waitFor();
      const box = dialog.getByRole("combobox");
      await box.fill("5q0-615-505-r");
      await page.waitForTimeout(2500);
      await shot(page, `xbrowser/shop-${key}-01-search-dialog`);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("role") ?? document.activeElement?.tagName);
      await box.press("Enter");
      await page.waitForURL(/\/pretraga\?q=|\/deo\//, { timeout: 30_000 });
      return { focused, url: page.url().replace(BASE, "") };
    });
    await step(r, "search-results", async () => {
      if (!page.url().includes("/pretraga")) return { skipped: "went straight to product" };
      await page.waitForLoadState("domcontentloaded");
      const card = page.locator(`[data-product-slug="${PRODUCT}"]`).first();
      await card.waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1200);
      await shot(page, `xbrowser/shop-${key}-02-search-results`);
      await card.getByRole("link").first().click();
      await page.waitForURL(new RegExp(`/deo/${PRODUCT}`));
      return { url: page.url().replace(BASE, "") };
    });
    if (!page.url().includes(`/deo/${PRODUCT}`)) {
      await page.goto(`${BASE}/deo/${PRODUCT}`, { waitUntil: "domcontentloaded", timeout: 120_000 }).catch((e) => r.steps.push({ name: "fallback-goto", ok: false, error: String(e).slice(0, 200) }));
      r.steps.push({ name: "fallback-goto-product", ok: true });
    }
    await step(r, "product", async () => {
      await page.locator("#buy-box").waitFor();
      await page.waitForTimeout(1500);
      await shot(page, `xbrowser/shop-${key}-03-product`);
      // quantity control
      const qty = page.locator("#buy-box").locator('input[type="number"], input[inputmode="numeric"], input[name*="qty" i], input[aria-label*="Količina" i]').first();
      const info = { qtyFound: (await qty.count()) > 0 };
      if (info.qtyFound) {
        info.qtyType = await qty.getAttribute("type");
        info.qtyBox = await qty.boundingBox();
        info.qtyStyle = await qty.evaluate((e) => {
          const cs = getComputedStyle(e);
          return { appearance: cs.appearance || cs.webkitAppearance, h: e.offsetHeight, w: e.offsetWidth, font: cs.fontSize };
        });
        await qty.fill("2");
        await qty.press("Tab");
        info.qtyAfter = await qty.inputValue();
        await shot(page, `xbrowser/shop-${key}-03b-buybox`, { locator: page.locator("#buy-box") });
        await qty.fill("1");
        await qty.press("Tab");
      }
      info.overflow = await overflowX(page);
      return info;
    });
    await step(r, "add-to-cart", async () => {
      const add = page.locator("#buy-box").getByTestId("product-add-to-cart");
      await add.click();
      await page.waitForFunction(() => /Dodato/.test(document.querySelector("#buy-box [data-testid=product-add-to-cart]")?.textContent ?? ""), null, { timeout: 30_000 });
      await page.waitForTimeout(800);
      const count = await page.getByTestId("cart-count").first().textContent().catch(() => null);
      await shot(page, `xbrowser/shop-${key}-04-added`);
      return { count };
    });
    await step(r, "category-vehicle-filter", async () => {
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(1500);
      await shot(page, `xbrowser/shop-${key}-05-category`);
      if (mobile) {
        await page.getByRole("button", { name: /^Filteri/ }).click();
        await page.getByRole("dialog", { name: "Filteri" }).waitFor();
        await page.waitForTimeout(700);
        await shot(page, `xbrowser/shop-${key}-05b-filter-sheet`);
      }
      await page.getByRole("button", { name: "Izaberite vozilo" }).filter({ visible: true }).first().click();
      const picker = page.getByRole("dialog", { name: "Izaberite vozilo" });
      await picker.waitFor();
      await page.waitForTimeout(700);
      await shot(page, `xbrowser/shop-${key}-06-picker`);
      await picker.getByRole("button", { name: "Volkswagen" }).click();
      await picker.getByRole("button", { name: /^Golf/ }).first().click();
      await picker.getByRole("button", { name: /Golf VII/ }).first().click();
      await page.waitForTimeout(400);
      await shot(page, `xbrowser/shop-${key}-06b-picker-engine`);
      await picker.getByRole("button", { name: "Ne znam motor" }).click();
      await page.waitForURL(/generacija=/, { timeout: 30_000 });
      if (mobile) {
        await page.getByRole("button", { name: /^Prikaži \d+ rezultat/ }).click();
        await page.getByRole("dialog", { name: "Filteri" }).waitFor({ state: "hidden" });
      }
      await page.getByTestId("product-card").first().waitFor();
      await page.waitForTimeout(1200);
      const n = await page.getByTestId("product-card").count();
      await shot(page, `xbrowser/shop-${key}-07-filtered`);
      return { cards: n, url: page.url().replace(BASE, "") };
    });
    await step(r, "cart-drawer", async () => {
      await page.getByTestId("cart-button").first().click();
      const drawer = page.getByTestId("cart-drawer");
      await drawer.waitFor({ timeout: 20_000 });
      await page.waitForTimeout(900);
      await shot(page, `xbrowser/shop-${key}-08-drawer`);
      await drawer.getByTestId("cart-checkout").click();
      await page.waitForURL(/\/porudzbina$/);
    });
    const email = `audit-xbrowser-${engine}-${v.tag}-${Date.now()}@primer.rs`;
    r.email = email;
    const submitted = await step(r, "checkout", async () => {
      await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await shot(page, `xbrowser/shop-${key}-09-contact`);
      await page.getByLabel("Ime", { exact: true }).fill("Nikola");
      await page.getByLabel("Prezime").fill("Stanković");
      await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
      await page.getByLabel("E-pošta").fill(email);
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-delivery").waitFor();
      await page.getByRole("radio", { name: /Kurirska služba/ }).click();
      await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
      await page.getByLabel("Poštanski broj").fill("21000");
      await page.getByLabel("Mesto").fill("Novi Sad");
      await page.waitForTimeout(400);
      await shot(page, `xbrowser/shop-${key}-10-delivery`);
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-payment").waitFor();
      const codChecked = await page.getByRole("radio", { name: /Pouzećem/ }).isChecked();
      await shot(page, `xbrowser/shop-${key}-11-payment`);
      await page.getByTestId("checkout-next").click();
      await page.getByTestId("checkout-step-review").waitFor();
      await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
      await page.waitForTimeout(3300);
      await shot(page, `xbrowser/shop-${key}-12-review`);
      await page.getByTestId("checkout-submit").click();
      await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 45_000 });
      await page.getByTestId("order-number").first().waitFor();
      const number = (await page.getByTestId("order-number").first().textContent())?.trim();
      await page.waitForTimeout(1500);
      await shot(page, `xbrowser/shop-${key}-13-thanks`);
      r.number = number;
      return { codChecked, number };
    });
    if (submitted && r.number) {
      try {
        r.probe = convexRun("testing:orderProbe", { number: r.number });
      } catch (e) {
        r.probe = { error: String(e).slice(0, 300) };
      }
    }
    r.csp = await cspLog(page);
    r.log = log;
    await context.close();
    console.log(key, JSON.stringify({ steps: r.steps.map((s) => `${s.name}:${s.ok ? "ok" : "FAIL " + s.error}`), number: r.number, probe: r.probe && { status: r.probe.status, pay: r.probe.paymentMethod, del: r.probe.deliveryMethod }, csp: r.csp.length, console: log.console, pageErrors: log.pageErrors, bad: log.badResponses.slice(0, 5) }));
  }
  await browser.close();
}
saveJson(`shop-${ENGINES.join("_")}.json`, out);
