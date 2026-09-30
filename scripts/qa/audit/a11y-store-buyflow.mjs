/**
 * a11y-store: keyboard-only buy flow. Home → „/“ search OEM → product → quantity ↑ → add →
 * cart drawer → checkout (errors on every step) → guest order with pouzeće → thank-you page.
 *   node scripts/qa/audit/a11y-store-buyflow.mjs <width>
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, watch, shot, axe, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 1024 ? 844 : 900;
const OUT = "docs/qa/audit/a11y-store";
mkdirSync(OUT, { recursive: true });
const T = `buy${width}`;
const rec = { width, steps: [] };
const note = (k, v) => {
  rec.steps.push({ k, v });
  console.log("--", k, typeof v === "string" ? v.slice(0, 1500) : JSON.stringify(v).slice(0, 1500));
};

const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 60)}" @${Math.round(r.top)} vis:${getComputedStyle(el).outlineStyle}`;
  });

async function tabTo(page, pred, max = 80, back = false) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    await page.waitForTimeout(40);
    const ok = await page.evaluate(pred);
    if (ok) return i + 1;
  }
  return -1;
}

async function fieldState(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("form input:not([type=hidden]), form textarea, form select, form [role=checkbox], form [role=radiogroup]")]
      .filter((e) => e.getBoundingClientRect().height > 0 && !e.closest("[aria-hidden=true]"))
      .map((e) => {
        const lab = e.labels?.[0]?.textContent?.trim() || e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby"))?.textContent) || "";
        const desc = (e.getAttribute("aria-describedby") || "").split(" ").filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim()).join(" | ");
        return `${e.id || e.name || e.tagName}: label="${lab.slice(0, 40)}" req=${e.required || e.getAttribute("aria-required") || ""} invalid=${e.getAttribute("aria-invalid") || ""} ac=${e.getAttribute("autocomplete") || ""} desc="${desc.slice(0, 80)}"`;
      }),
  );
}

const browser = await launch();
const ctx = await newContext(browser, { width, height, tag: `a11ybuy${width}` });
const page = await ctx.newPage();
const log = watch(page);
await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);

// 1. search by keyboard
await page.keyboard.press("/");
await page.waitForTimeout(800);
note("after /", await act(page));
await page.keyboard.type("5Q0 615 505 R", { delay: 30 });
await page.locator("[role=option]").first().waitFor({ timeout: 15000 }).catch(() => note("no suggestions within 15s", ""));
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForURL(/\/deo\/|\/pretraga/, { timeout: 60000 });
if (/pretraga/.test(page.url())) {
  await page.waitForTimeout(2500);
  note("landed on search results", page.url());
  const n = await tabTo(page, () => /\/deo\//.test(document.activeElement.getAttribute("href") || ""), 60);
  note("tabs to first result", n);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/deo\//, { timeout: 60000 });
}
await page.waitForTimeout(2500);
note("product url", page.url());
note("focus after nav", await act(page));

// 2. product page: buy box snapshot, tabs to quantity
const buy = page.getByTestId("product-add-to-cart").first().locator("xpath=ancestor::*[.//h1 or .//*[contains(@class,'numeral')]][1]");
note("buybox aria", (await buy.ariaSnapshot().catch((e) => String(e))).slice(0, 2500));
const nq = await tabTo(page, () => /Količina|spinbutton/i.test((document.activeElement.getAttribute("aria-label") || "") + document.activeElement.getAttribute("role") + (document.activeElement.labels?.[0]?.textContent ?? "")) || document.activeElement.type === "number");
note("tabs to quantity", nq);
note("quantity el", await act(page));
note("quantity attrs", await page.evaluate(() => { const e = document.activeElement; return { role: e.getAttribute("role"), type: e.type, min: e.min || e.getAttribute("aria-valuemin"), max: e.max || e.getAttribute("aria-valuemax"), now: e.value || e.getAttribute("aria-valuenow"), label: e.getAttribute("aria-label") || e.labels?.[0]?.textContent }; }));
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(200);
note("quantity after ArrowUp", await page.evaluate(() => document.activeElement.value || document.activeElement.getAttribute("aria-valuenow")));
const na = await tabTo(page, () => document.activeElement.getAttribute("data-testid") === "product-add-to-cart", 6);
note("tabs quantity→add", na);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
note("cart-live", await page.evaluate(() => document.getElementById("cart-live")?.textContent));
note("live regions", await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((l) => `${l.getAttribute("aria-live") || l.getAttribute("role")}:${l.textContent.trim().slice(0, 80)}`).filter((t) => t.split(":")[1])));
note("cart button name", await page.getByTestId("cart-button").first().getAttribute("aria-label"));
note("focus after add", await act(page));
await shot(page, `a11y-store/${T}-product-added`);
note("axe product after add", await axe(page));

// 3. cart drawer via keyboard (Shift+Tab to the header cart button)
const nb = await tabTo(page, () => document.activeElement.getAttribute("data-testid") === "cart-button", 90, true);
note("shift-tabs to cart", nb);
if (nb < 0) {
  await page.getByTestId("cart-button").first().focus();
}
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
note("drawer focus", await act(page));
const drawer = page.locator("[role=dialog]").last();
note("drawer aria", (await drawer.ariaSnapshot().catch((e) => String(e))).slice(0, 2500));
note("axe drawer", await axe(page));
await shot(page, `a11y-store/${T}-cart-drawer`);
const seq = [];
for (let i = 0; i < 14; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(40);
  seq.push(await act(page));
}
note("drawer tab seq", seq);
const nc = await tabTo(page, () => /Nastavi na porud/i.test(document.activeElement.textContent), 20);
note("tabs to checkout", nc);
await page.keyboard.press("Enter");
await page.waitForURL(/\/porudzbina$/, { timeout: 60000 });
await page.waitForTimeout(3000);
note("checkout focus", await act(page));
note("stepper aria", (await page.locator("form nav, form ol").first().ariaSnapshot().catch((e) => String(e))).slice(0, 1200));

// 4. step 1 empty → submit
const nn = await tabTo(page, () => document.activeElement.getAttribute("data-testid") === "checkout-next", 40);
note("tabs to Dalje (empty)", nn);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
note("focus after empty submit step1", await act(page));
note("fields step1", await fieldState(page));
note("summary aria", (await page.locator("[role=alert]").first().ariaSnapshot().catch((e) => String(e))).slice(0, 800));
note("axe step1 errors", await axe(page));
await shot(page, `a11y-store/${T}-checkout-step1-errors`);
// follow the first summary link with the keyboard
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
await page.waitForTimeout(500);
note("focus after summary link", await act(page));
// fill by keyboard
await page.locator("#co-firstName").focus();
await page.keyboard.type("Petar");
await page.keyboard.press("Tab");
await page.keyboard.type("Petrović");
await page.keyboard.press("Tab");
await page.keyboard.type("064 123 4567");
await page.keyboard.press("Tab");
await page.keyboard.type(`audit-a11y-store-1-${Date.now()}@primer.rs`);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
note("focus step2", await act(page));
note("fields step2", await fieldState(page));
// step 2 empty address
const nn2 = await tabTo(page, () => document.activeElement.getAttribute("data-testid") === "checkout-next", 40);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
note("focus after empty submit step2", await act(page));
note("fields step2 errors", await fieldState(page));
note("axe step2 errors", await axe(page));
await shot(page, `a11y-store/${T}-checkout-step2-errors`);
await page.locator("#co-street").focus();
await page.keyboard.type("Bulevar oslobođenja 12");
await page.keyboard.press("Tab");
await page.keyboard.type("21000");
await page.keyboard.press("Tab");
await page.keyboard.type("Novi Sad");
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
note("focus step3", await act(page));
note("step3 aria", (await page.locator("section[aria-labelledby=step-title]").ariaSnapshot().catch((e) => String(e))).slice(0, 1500));
note("axe step3", await axe(page));
// pick pouzeće by keyboard: Tab into radiogroup, arrows
const nr = await tabTo(page, () => document.activeElement.getAttribute("role") === "radio", 10);
note("tabs to payment radio", nr);
note("radio focused", await act(page));
const cod = await page.evaluate(() => [...document.querySelectorAll("[role=radio]")].map((r) => `${r.getAttribute("aria-checked")}:${(r.getAttribute("aria-label") || r.closest("label")?.textContent || document.querySelector(`label[for="${r.id}"]`)?.textContent || "").trim().slice(0, 40)}`));
note("payment radios", cod);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
note("focus step4", await act(page));
note("fields step4", await fieldState(page));
await shot(page, `a11y-store/${T}-checkout-step4`);
// submit without terms
const ns = await tabTo(page, () => document.activeElement.getAttribute("data-testid") === "checkout-submit", 40);
note("tabs to submit", ns);
await page.keyboard.press("Enter");
await page.waitForTimeout(1500);
note("focus after submit w/o terms", await act(page));
note("fields step4 errors", await fieldState(page));
note("axe step4 errors", await axe(page));
await shot(page, `a11y-store/${T}-checkout-step4-errors`);
// check terms via keyboard: focus checkbox, Space
await page.locator("#co-terms").focus();
await page.keyboard.press("Space");
await page.waitForTimeout(300);
await page.getByTestId("checkout-submit").focus();
await page.keyboard.press("Enter");
await page.waitForURL(/hvala/, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);
note("thanks url", page.url());
note("thanks focus", await act(page));
note("thanks h1", await page.locator("h1").first().textContent());
note("axe thanks", await axe(page));
await shot(page, `a11y-store/${T}-thanks`);
note("console", log.console.concat(log.pageErrors).slice(0, 8));
writeFileSync(`${OUT}/buyflow-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
