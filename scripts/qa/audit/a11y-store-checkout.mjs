/**
 * a11y-store: checkout keyboard + error handling, step by step (focus after „Dalje“ with errors,
 * tab order, autocomplete, radio group, terms, submit, thank-you focus).
 *   node scripts/qa/audit/a11y-store-checkout.mjs <width>
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, watch, shot, axe, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 1024 ? 844 : 900;
const T = `co${width}`;
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 1400));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50)}" top=${Math.round(r.top)} bottom=${Math.round(r.bottom)}`;
  });
const tabbables = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main a[href], main button, main input, main select, main textarea, main [tabindex]")]
      .filter((e) => !e.disabled && e.tabIndex >= 0 && e.getBoundingClientRect().height > 0 && !e.closest("[inert],[aria-hidden=true]"))
      .map((e) => `${e.tagName.toLowerCase()}${e.type ? ":" + e.type : ""}#${e.id} "${(e.getAttribute("aria-label") || e.labels?.[0]?.textContent || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)}" ac=${e.getAttribute("autocomplete") ?? ""}`),
  );
const sampleFocus = async (page) => {
  const s = [];
  for (const ms of [120, 500, 1500]) {
    await page.waitForTimeout(ms === 120 ? 120 : ms === 500 ? 380 : 1000);
    s.push(`${ms}ms: ${await act(page)}`);
  }
  return s;
};
const fields = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("form input:not([type=hidden]), form textarea, form select")]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => `${e.id}: req=${e.required || e.getAttribute("aria-required") || "-"} invalid=${e.getAttribute("aria-invalid") || "-"} ac=${e.getAttribute("autocomplete") || "-"} desc="${(e.getAttribute("aria-describedby") || "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).join(" | ").slice(0, 70)}"`),
  );

const browser = await launch();
const ctx = await newContext(browser, { width, height, tag: `a11yco${width}` });
const page = await ctx.newPage();
const log = watch(page);
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2000);
await page.getByTestId("product-add-to-cart").first().click();
await page.waitForTimeout(2000);
await page.goto(BASE + "/porudzbina", { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(3000);
note("focus on load", await act(page));
note("step1 tabbables", await tabbables(page));
note("step1 fields", await fields(page));
note("required indicator text", await page.evaluate(() => [...document.querySelectorAll("form label")].slice(0, 6).map((l) => l.textContent.trim())));
// submit empty with keyboard
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
note("focus after Dalje (errors) samples", await sampleFocus(page));
note("summary", await page.locator("[role=alert]").first().ariaSnapshot().catch((e) => String(e).slice(0, 100)));
await shot(page, `a11y-store/${T}-step1-errors`);
note("axe step1 errors", await axe(page));
// Tab from the focused element: next stop
await page.keyboard.press("Tab");
note("tab after errors", await act(page));
// fill by keyboard
await page.locator("#co-firstName").focus();
const seq = [];
await page.keyboard.type("Petar");
for (let i = 0; i < 4; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(60);
  seq.push(await act(page));
}
note("tab sequence from Ime", seq);
await page.locator("#co-lastName").fill("Petrović");
await page.locator("#co-phone").fill("064 123 4567");
await page.locator("#co-email").fill(`audit-a11y-store-co${width}-${Date.now()}@primer.rs`);
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
note("focus step2 samples", await sampleFocus(page));
note("step2 tabbables", await tabbables(page));
note("step2 fields", await fields(page));
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
note("focus after step2 errors", await sampleFocus(page));
await shot(page, `a11y-store/${T}-step2-errors`);
note("axe step2 errors", await axe(page));
const street = page.locator("#co-street, input[autocomplete='street-address'], input[name*=street]").first();
note("street exists", await street.count());
if (await street.count()) {
  await street.fill("Bulevar oslobođenja 12");
  const post = page.locator("#co-postalCode, input[autocomplete='postal-code']").first();
  if (await post.count()) await post.fill("21000");
  const city = page.locator("#co-city, input[autocomplete='address-level2']").first();
  if (await city.count()) await city.fill("Novi Sad");
}
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
note("focus step3 samples", await sampleFocus(page));
note("step3 aria", (await page.locator("form").first().ariaSnapshot().catch((e) => String(e))).slice(0, 2500));
note("axe step3", await axe(page));
await shot(page, `a11y-store/${T}-step3`);
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
note("focus step4 samples", await sampleFocus(page));
note("step4 aria", (await page.locator("form").first().ariaSnapshot().catch((e) => String(e))).slice(0, 3000));
await page.getByTestId("checkout-submit").focus();
await page.keyboard.press("Enter");
note("focus after submit w/o terms", await sampleFocus(page));
note("step4 fields", await fields(page));
await shot(page, `a11y-store/${T}-step4-errors`);
note("axe step4 errors", await axe(page));
// go back to step 1 via stepper link: data retained? (3.3.7)
const back = page.locator("nav[aria-label='Koraci porudžbine'] a, nav[aria-label='Koraci porudžbine'] button").first();
note("stepper back controls", await page.locator("nav[aria-label='Koraci porudžbine'] a, nav[aria-label='Koraci porudžbine'] button").allTextContents());
const terms = page.locator("#co-terms");
if (await terms.count()) {
  await terms.focus();
  await page.keyboard.press("Space");
}
await page.getByTestId("checkout-submit").focus();
await page.keyboard.press("Enter");
await page.waitForURL(/hvala/, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);
note("thanks url", page.url());
note("thanks focus", await act(page));
note("axe thanks", await axe(page));
note("console", log.console.concat(log.pageErrors).slice(0, 8));
writeFileSync(`docs/qa/audit/a11y-store/checkout-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
