/**
 * forms-auth (step 22): text typed before hydration survives (XB-01) and forms never submit
 * natively with credentials in the URL (A11Y-04). JS chunks are held back until the text is
 * typed, then released; values are read after hydration.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-prehydration.mjs [chromium|webkit|firefox]
 */
import { launch, newContext, BASE } from "../audit/kit.mjs";

const engine = process.argv[2] ?? "chromium";
const note = (k, v) => console.log("--", k, JSON.stringify(v).slice(0, 700));

async function holdChunks(page) {
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
    await gate;
    await route.continue();
  });
  return () => release();
}

async function run(browser, { path, fields, ready, label }) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `fa-ph-${label}` });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  const urls = [];
  page.on("request", (r) => r.isNavigationRequest() && urls.push(`${r.method()} ${r.url().replace(BASE, "")}`));
  try {
    const release = await holdChunks(page);
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180000 });
    for (const [sel, text] of fields) {
      await page.locator(sel).first().click({ timeout: 60000 });
      await page.keyboard.type(text, { delay: 15 });
    }
    const before = await page.evaluate((s) => s.map((x) => document.querySelector(x)?.value), fields.map((f) => f[0]));
    release();
    await ready(page);
    await page.waitForTimeout(1500);
    const after = await page.evaluate((s) => s.map((x) => document.querySelector(x)?.value), fields.map((f) => f[0]));
    note(`${label} before→after`, { before, after, kept: before.every((v, i) => v === after[i]) });
    return { page, ctx, errors, urls };
  } catch (e) {
    await ctx.close();
    throw e;
  }
}

const browser = await launch(engine);
try {
  // Hero search (controlled input).
  {
    const { page, ctx, errors } = await run(browser, {
      label: "hero",
      path: "/",
      fields: [['form[role="search"] input[name="q"]', "5Q0615505R"]],
      ready: (p) => p.waitForLoadState("load"),
    });
    await page.waitForTimeout(1500);
    note("hero value after a re-render (resize)", await page.evaluate(() => document.querySelector('form[role="search"] input[name="q"]')?.value));
    note("hero console errors", errors);
    await ctx.close();
  }
  // /upit (react-hook-form).
  {
    const { page, ctx, errors } = await run(browser, {
      label: "upit",
      path: "/upit",
      fields: [
        ["#iq-vin", "WVWZZZ1KZ8W123456"],
        ["#iq-message", "Turbina za Golf 7, dizel."],
        ["#iq-name", "Petar Petrović"],
      ],
      ready: (p) => p.waitForSelector('[data-testid="inquiry-submit"]:not([disabled])', { timeout: 120000 }),
    });
    note("upit VIN help (decoded, not 0 / 17)", await page.locator("#iq-vin-msg").textContent());
    // Validation only (the phone is empty → no inquiry is created): Opis must not be „required“.
    await page.getByTestId("inquiry-submit").click();
    await page.waitForTimeout(800);
    note("upit errors after submit", await page.evaluate(() => [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent)));
    note("upit console errors", errors);
    await ctx.close();
  }
  // /registracija (controlled inputs) + early submit attempt before hydration.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "fa-ph-reg" });
    const page = await ctx.newPage();
    const urls = [];
    page.on("request", (r) => r.isNavigationRequest() && urls.push(`${r.method()} ${r.url().replace(BASE, "")}`));
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
    const release = await holdChunks(page);
    await page.goto(BASE + "/registracija", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator("#su-name").click();
    await page.keyboard.type("Petar Petrović", { delay: 10 });
    await page.locator("#su-email").click();
    await page.keyboard.type("petar@primer.rs", { delay: 10 });
    await page.locator("#su-password").click();
    await page.keyboard.type("TajnaLozinka-555", { delay: 10 });
    note("reg submit disabled before hydration", await page.getByTestId("signup-submit").isDisabled());
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    release();
    await page.waitForSelector('[data-testid="signup-submit"]:not([disabled])', { timeout: 120000 });
    await page.waitForTimeout(1200);
    note("reg values after hydration", await page.evaluate(() => ["su-name", "su-email", "su-password"].map((id) => document.getElementById(id)?.value.length)));
    // Without ticking the terms → summary only, nothing is created.
    await page.getByTestId("signup-submit").click();
    await page.waitForTimeout(800);
    note("reg summary", await page.evaluate(() => ({
      focus: document.activeElement?.firstElementChild?.getAttribute("role") ?? document.activeElement?.tagName,
      items: [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent),
    })));
    note("reg navigations (no GET with password)", urls);
    note("reg console errors", errors);
    await ctx.close();
  }
} finally {
  await browser.close();
}
