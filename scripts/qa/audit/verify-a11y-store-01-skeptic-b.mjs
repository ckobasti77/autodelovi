/**
 * a11y-store-01 skeptic, part B: does the summary steal focus with no submit attempt at all
 * (skipping an empty required field), and on mobile width?
 *   node scripts/qa/audit/verify-a11y-store-01-skeptic-b.mjs <width>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 390);
const height = width < 1024 ? 844 : 900;
const OUT = "docs/qa/audit/verify/a11y-store";
mkdirSync(OUT, { recursive: true });
const rec = { width, base: BASE };
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 600));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  });
const vals = (page) =>
  page.evaluate(() => Object.fromEntries(["co-firstName", "co-lastName", "co-phone", "co-email"].map((id) => [id, document.getElementById(id)?.value])));

const browser = await launch();
const ctx = await newContext(browser, { width, height, tag: `verif01b${width}` });
const page = await ctx.newPage();
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2000);
await page.getByTestId("product-add-to-cart").first().click();
await page.waitForTimeout(1500);
await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
await page.locator("#co-firstName").waitFor({ timeout: 120000 });
await page.waitForTimeout(3000);
note("start values", await vals(page));
note("summary before anything", await page.locator('div[role="alert"]:has-text("Proverite")').count());

// D: user taps Ime, changes mind and taps Telefon first (no Dalje pressed yet).
await page.locator("#co-firstName").click();
await page.locator("#co-phone").click();
await page.waitForTimeout(800);
note("D after moving Ime -> Telefon without typing (expected co-phone)", await act(page));
await page.keyboard.type("0641234567", { delay: 30 });
await page.waitForTimeout(300);
note("D values after typing phone", await vals(page));
note("D summary", await page.locator('div[role="alert"]:has-text("Proverite")').first().textContent().catch(() => null));
await shot(page, "verify/a11y-store/a11y-store-01-skeptic-noattempt-" + width);
writeFileSync(`${OUT}/a11y-store-01-skeptic-noattempt-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
