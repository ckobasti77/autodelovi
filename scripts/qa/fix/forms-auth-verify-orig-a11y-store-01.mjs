/**
 * Verifier for a11y-store-01: checkout ErrorSummary focus steal.
 *   node scripts/qa/audit/verify-a11y-store-01.mjs <width> [engine]
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "../audit/kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const engine = process.argv[3] ?? "chromium";
const height = width < 1024 ? 844 : 900;
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 600));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  });
const vals = (page) =>
  page.evaluate(() => Object.fromEntries(["co-firstName", "co-lastName", "co-phone", "co-email"].map((id) => [id, document.getElementById(id)?.value])));
const summary = (page) => page.evaluate(() => document.querySelector("form [role=alert]")?.querySelector("p")?.textContent?.trim() ?? null);

const browser = await launch(engine);
const ctx = await newContext(browser, { width, height, tag: `verify-a11y01-${width}-${engine}`, engine });
const page = await ctx.newPage();
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2000);
await page.getByTestId("product-add-to-cart").first().click();
await page.waitForTimeout(2000);
await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
await page.locator("#co-firstName").waitFor({ timeout: 120000 });
await page.waitForTimeout(3000);

// Scenario 0: before any submit attempt, tab through empty Ime
await page.locator("#co-firstName").focus();
await page.keyboard.press("Tab");
await page.waitForTimeout(700);
note("S0 after Tab through empty Ime (no submit yet): focus", await act(page));
note("S0 summary", await summary(page));
await shot(page, `../fix/forms-auth/verify/orig-a11y-store-01-s0-first-blur-${width}-${engine}`);

// Reload to clean state (draft in sessionStorage is empty anyway)
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("#co-firstName").waitFor({ timeout: 120000 });
await page.waitForTimeout(3000);

// Scenario A (reviewer steps): Enter on Dalje with empty fields
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
note("A1 after Dalje: focus", await act(page));
note("A1 summary", await summary(page));
await page.locator("#co-firstName").focus();
await page.keyboard.type("Petar", { delay: 40 });
note("A2 while typing Ime focus", await act(page));
await page.keyboard.press("Tab");
await page.waitForTimeout(800);
note("A3 after Tab from fixed Ime (expected #co-lastName)", await act(page));
note("A3 summary", await summary(page));
await page.keyboard.type("Petrovic", { delay: 40 });
await page.waitForTimeout(300);
note("A4 values after typing", await vals(page));
await shot(page, `../fix/forms-auth/verify/orig-a11y-store-01-kbd-${width}-${engine}`);

// Scenario B: mouse click into Prezime (now touched), type -> does focus leave mid-typing?
await page.locator("#co-lastName").click();
await page.waitForTimeout(300);
note("B0 focus after click Prezime", await act(page));
const typedLog = [];
for (const ch of "Petrovic") {
  await page.keyboard.type(ch);
  await page.waitForTimeout(120);
  typedLog.push(`${ch}:${(await act(page)).slice(0, 30)}`);
}
note("B1 per-keystroke focus while typing Prezime", typedLog);
note("B1 values", await vals(page));
note("B1 summary", await summary(page));
await page.locator("#co-phone").click();
await page.waitForTimeout(800);
note("B2 after click Telefon (expected #co-phone)", await act(page));
await page.keyboard.type("0641234567", { delay: 30 });
await page.waitForTimeout(300);
note("B3 values", await vals(page));
note("B3 summary", await summary(page));
await shot(page, `../fix/forms-auth/verify/orig-a11y-store-01-mouse-${width}-${engine}`);

writeFileSync(`docs/qa/fix/forms-auth/verify/orig-a11y-store-01-${width}-${engine}.json`, JSON.stringify(rec, null, 1));
await browser.close();
