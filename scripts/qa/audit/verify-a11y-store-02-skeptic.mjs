/** verify a11y-store-02 (skeptic): focus return after closing vehicle picker, cart drawer, header search; controls = mobile menu. */
import { writeFileSync } from "node:fs";
import { launch, newContext, BASE, shot } from "./kit.mjs";

const browser = await launch();
const out = [];
const desc = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return "BODY";
    const label = a.getAttribute("aria-label") || a.getAttribute("data-testid") || (a.textContent || "").trim().slice(0, 40);
    return `${a.tagName.toLowerCase()}[${label}]`;
  });
const dialogs = (page) => page.locator("[role=dialog]:visible").count();

async function run(name, { w, h, url, prep, open, close = "Escape", shotName, typed }) {
  const ctx = await newContext(browser, { width: w, height: h, tag: "vfy02" });
  const page = await ctx.newPage();
  const rec = { name, w, url };
  try {
    await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(2500);
    if (prep) await prep(page, rec);
    const trigger = await open(page);
    await trigger.focus();
    rec.before = await desc(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    rec.dialogsOpen = await dialogs(page);
    rec.focusInside = await desc(page);
    if (typed) { await page.keyboard.type(typed, { delay: 60 }); await page.waitForTimeout(1500); rec.focusTyped = await desc(page); }
    if (close === "Escape") {
      for (let i = 0; i < 3 && (await dialogs(page)) > 0; i++) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(700);
      }
    } else {
      await page.locator("[role=dialog]:visible").last().getByRole("button", { name: "Zatvori" }).first().focus();
      await page.keyboard.press("Enter");
    }
    await page.waitForTimeout(1200);
    rec.dialogsAfter = await dialogs(page);
    rec.after = await desc(page);
    if (shotName) rec.shot = await shot(page, `verify/a11y-store/${shotName}`);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    rec.nextTab = await desc(page);
  } catch (e) {
    rec.error = String(e).slice(0, 300);
  }
  out.push(rec);
  console.log(JSON.stringify(rec));
  await ctx.close();
}

const vehicleTrig = (which) => async (page) => {
  const t = page.locator("[data-testid=vehicle-picker-trigger]:visible");
  return which === "first" ? t.first() : t.last();
};
const addToCart = async (page) => {
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(2500);
  // dismiss anything the add opened (toast/drawer) so we start from the page
  if ((await dialogs(page)) > 0) { await page.keyboard.press("Escape"); await page.waitForTimeout(800); }
};
const PRODUCT = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";

for (const [w, h] of [[1440, 900], [390, 844]]) {
  await run(`vehicle-first-escape-${w}`, { w, h, url: "/", open: vehicleTrig("first"), shotName: w === 1440 ? "a11y-store-02-skeptic-vehicle-1440" : undefined });
  await run(`vehicle-last-zatvori-${w}`, { w, h, url: "/", open: vehicleTrig("last"), close: "Zatvori" });
  await run(`vehicle-first-escape-product-${w}`, { w, h, url: PRODUCT, open: vehicleTrig("first") });
  await run(`cart-escape-${w}`, { w, h, url: PRODUCT, prep: addToCart, open: async (p) => p.getByTestId("cart-button").first(), shotName: `a11y-store-02-skeptic-cart-${w}` });
  await run(`search-escape-${w}`, {
    w, h, url: "/delovi/kocioni-diskovi",
    open: async (p) => (w >= 1280 ? p.getByTestId("header-search-trigger") : p.getByRole("button", { name: "Pretraga delova" }).first()),
    typed: "disk",
  });
  if (w < 1024) {
    await run(`control-mobilemenu-${w}`, { w, h, url: "/", open: async (p) => p.getByTestId("mobile-menu-trigger").first() });
  }
}
writeFileSync("docs/qa/audit/verify/a11y-store/a11y-store-02-skeptic.json", JSON.stringify(out, null, 1));
await browser.close();
