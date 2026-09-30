/**
 * a11y-store: checkout error summary steals focus when a corrected field loses focus (keyboard Tab
 * and mouse click into the next field); honeypot exposure; submit without terms; thank-you focus.
 *   node scripts/qa/audit/a11y-store-co-steal.mjs <width>
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, axe, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 1024 ? 844 : 900;
const rec = {};
const note = (k, v) => {
  rec[k] = v;
  console.log("--", k, JSON.stringify(v).slice(0, 1500));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}#${el.id || ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  });
const vals = (page) => page.evaluate(() => ["co-firstName", "co-lastName", "co-phone", "co-email"].map((id) => `${id}=${document.getElementById(id)?.value}`));

const browser = await launch();
const ctx = await newContext(browser, { width, height, tag: `a11ysteal${width}` });
const page = await ctx.newPage();
await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2000);
await page.getByTestId("product-add-to-cart").first().click();
await page.waitForTimeout(1500);
await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
await page.locator("#co-firstName").waitFor({ timeout: 120000 });
await page.waitForTimeout(3000);
note("step1 form aria", (await page.locator("form").first().ariaSnapshot()).slice(0, 1500));
note("honeypot", await page.evaluate(() => {
  const i = [...document.querySelectorAll("form input")].find((e) => e.autocomplete === "off" || /veb|website|url/i.test(e.name + e.id));
  if (!i) return null;
  const r = i.getBoundingClientRect();
  return { name: i.name, tabIndex: i.tabIndex, ariaHiddenAncestor: !!i.closest("[aria-hidden=true]"), inert: !!i.closest("[inert]"), rect: [r.left, r.top, r.width, r.height].map(Math.round) };
}));
await page.getByTestId("checkout-next").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
note("A after Dalje", await act(page));
// keyboard: fix Ime, Tab to go to Prezime
await page.locator("#co-firstName").focus();
await page.keyboard.type("Petar", { delay: 40 });
note("A while typing Ime (focus)", await act(page));
await page.keyboard.press("Tab");
await page.waitForTimeout(600);
note("A after Tab from fixed Ime (expected co-lastName)", await act(page));
await page.keyboard.type("Petrović", { delay: 30 });
await page.waitForTimeout(300);
note("A values after typing Prezime blindly", await vals(page));
await shot(page, `a11y-store/co-steal-kbd-${width}`);
// mouse: fix Prezime field by clicking into it, typing, then clicking Telefon
await page.locator("#co-lastName").click();
await page.keyboard.type("Petrović", { delay: 30 });
await page.locator("#co-phone").click();
await page.waitForTimeout(600);
note("B after click into Telefon (expected co-phone)", await act(page));
await page.keyboard.type("0641234567", { delay: 30 });
await page.waitForTimeout(300);
note("B values after typing Telefon", await vals(page));
await shot(page, `a11y-store/co-steal-mouse-${width}`);
// finish the order: pickup, cash
await page.locator("#co-phone").fill("064 123 4567");
await page.locator("#co-email").fill(`audit-a11y-store-steal${width}-${Date.now()}@primer.rs`);
await page.getByTestId("checkout-next").click();
await page.waitForTimeout(1200);
await page.getByTestId("checkout-next").click();
await page.waitForTimeout(1200);
await page.getByTestId("checkout-next").click();
await page.waitForTimeout(1500);
note("step4 heading focus", await act(page));
await page.getByTestId("checkout-submit").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
note("C after submit without terms", await act(page));
note("C terms state", await page.evaluate(() => {
  const t = document.getElementById("co-terms");
  return t ? { role: t.getAttribute("role"), invalid: t.getAttribute("aria-invalid"), desc: (t.getAttribute("aria-describedby") || "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).join(" | ") } : null;
}));
await shot(page, `a11y-store/co-terms-error-${width}`);
note("C axe", await axe(page));
await page.locator("#co-terms").focus();
await page.keyboard.press("Space");
await page.getByTestId("checkout-submit").focus();
await page.keyboard.press("Enter");
await page.waitForURL(/hvala/, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(2500);
note("D thanks url", page.url());
note("D thanks focus", await act(page));
note("D thanks h1", await page.locator("h1").first().textContent());
note("D axe thanks", await axe(page));
writeFileSync(`docs/qa/audit/a11y-store/co-steal-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
