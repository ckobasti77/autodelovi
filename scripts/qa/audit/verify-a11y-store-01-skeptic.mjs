/**
 * Independent verification (skeptic) of a11y-store-01: does the checkout ErrorSummary steal focus
 * after the first failed "Dalje", on blur revalidation and on change revalidation?
 *   node scripts/qa/audit/verify-a11y-store-01-skeptic.mjs <width>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, newContext, shot, watch, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
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

async function openCheckout(browser, tag) {
  const ctx = await newContext(browser, { width, height, tag });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2000);
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/porudzbina", { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  // Clear any restored session draft so every run starts empty.
  for (const id of ["co-firstName", "co-lastName", "co-phone", "co-email"]) await page.locator("#" + id).fill("");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  return { ctx, page, log };
}

const browser = await launch();

// Control: no failed attempt, plain keyboard fill -> focus must follow Tab.
{
  const { ctx, page, log } = await openCheckout(browser, `verif01ctl${width}`);
  // Fresh load may still have a touched state from the clears above; reload for a clean form.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.locator("#co-firstName").focus();
  await page.keyboard.type("Petar", { delay: 40 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  note("CTL after Tab from Ime (no prior attempt)", await act(page));
  await page.keyboard.type("Petrovic", { delay: 30 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  note("CTL after Tab from Prezime", await act(page));
  note("CTL values", await vals(page));
  note("CTL summary present", await page.locator('div[role="alert"]').count());
  note("CTL console", log);
  await ctx.close();
}

// Case A (keyboard) + B (mouse) + C (change revalidation mid-typing) after one failed "Dalje".
{
  const { ctx, page, log } = await openCheckout(browser, `verif01${width}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#co-firstName").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  note("start values", await vals(page));
  await page.getByTestId("checkout-next").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  note("0 after empty Dalje (expected summary)", await act(page));

  // A: keyboard
  await page.locator("#co-firstName").focus();
  await page.keyboard.type("Petar", { delay: 40 });
  note("A while typing Ime", await act(page));
  await page.keyboard.press("Tab");
  await page.waitForTimeout(700);
  note("A after Tab from fixed Ime (expected co-lastName)", await act(page));
  await page.keyboard.type("Jovan", { delay: 30 });
  await page.waitForTimeout(300);
  note("A values after typing 'Jovan'", await vals(page));
  await shot(page, "verify/a11y-store/a11y-store-01-skeptic-kbd-" + width);

  // B: mouse
  await page.locator("#co-lastName").click();
  await page.keyboard.type("Petrovic", { delay: 30 });
  await page.locator("#co-phone").click();
  await page.waitForTimeout(700);
  note("B after click into Telefon (expected co-phone)", await act(page));
  await page.keyboard.type("0641234567", { delay: 30 });
  await page.waitForTimeout(300);
  note("B values after typing digits", await vals(page));
  await shot(page, "verify/a11y-store/a11y-store-01-skeptic-mouse-" + width);

  // C: change revalidation on a touched invalid field. Make phone invalid, blur, come back and type
  // a valid number; record focus after every keystroke.
  await page.locator("#co-phone").click();
  await page.locator("#co-phone").fill("12");
  await page.locator("#co-email").click();
  await page.waitForTimeout(700);
  note("C after blur of invalid phone (count may stay)", await act(page));
  await page.locator("#co-phone").click();
  await page.locator("#co-phone").press("Control+A");
  await page.keyboard.press("Backspace");
  const trail = [];
  for (const ch of "0641234567") {
    await page.keyboard.type(ch);
    await page.waitForTimeout(150);
    trail.push(`${ch}:${(await act(page)).slice(0, 22)}`);
  }
  note("C focus after each keystroke in Telefon", trail);
  note("C values", await vals(page));
  note("C summary text", await page.locator('div[role="alert"]').first().textContent().catch(() => null));
  await shot(page, "verify/a11y-store/a11y-store-01-skeptic-typing-" + width);
  note("console", log);
  await ctx.close();
}

writeFileSync(`${OUT}/a11y-store-01-skeptic-${width}.json`, JSON.stringify(rec, null, 1));
await browser.close();
