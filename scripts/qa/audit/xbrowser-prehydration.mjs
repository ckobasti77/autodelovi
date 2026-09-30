/**
 * xbrowser — what happens to text typed into server-rendered form fields before hydration
 * (slow phone / slow network: HTML is visible and editable, JS chunks still loading).
 * JS chunks are delayed by XB_DELAY ms (default 6000) with page.route, the visitor types into
 * the VIN and description fields as soon as the HTML is there, then the script waits for React
 * and reads what the form state shows (counters, VIN decode → brand) and what submit does.
 *   XB_ENGINES=chromium,firefox,webkit node scripts/qa/audit/xbrowser-prehydration.mjs
 */
import { BASE, shot, watch } from "./kit.mjs";
import { ENGINES, cspLog, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const DELAY = Number(process.env.XB_DELAY ?? 6000);
const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  const key = `${engine}-390`;
  const r = (out[key] = {});
  const context = await xctx(browser, engine, { width: 390, height: 844, tag: "prehyd" });
  const page = await context.newPage();
  page.setDefaultTimeout(40_000);
  const log = watch(page);
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((res) => setTimeout(res, DELAY));
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const vinEl = page.locator("#iq-vin");
    await vinEl.waitFor();
    r.hydratedAtType = await vinEl.evaluate((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
    await vinEl.click();
    await page.keyboard.type("WVWZZZ1KZ8W123456", { delay: 20 });
    const msg = page.locator("textarea").first();
    await msg.click();
    await page.keyboard.type("Turbina za Golf 7, dizel.", { delay: 20 });
    r.domAfterTyping = { vin: await vinEl.inputValue(), msg: await msg.inputValue() };
    // wait for React to own the field
    await page.waitForFunction(() => {
      const e = document.querySelector("#iq-vin");
      return e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
    }, null, { timeout: 90_000 });
    
    await page.waitForTimeout(3000);
    r.afterHydration = await page.evaluate(() => {
      const vin = document.querySelector("#iq-vin");
      const hint = vin?.closest("div")?.parentElement?.textContent ?? "";
      const brand = document.querySelector("#iq-brandSlug");
      const ta = document.querySelector("textarea");
      return {
        vinDom: vin?.value,
        vinCounter: (hint.match(/\d+ \/ 17 znakova/) ?? [""])[0],
        brand: brand?.value ?? null,
        msgDom: ta?.value,
        msgCounter: (document.body.innerText.match(/\d+(\.\d+)? \/ 2\.000/) ?? [""])[0],
      };
    });
    await shot(page, `xbrowser/prehyd-${key}-after-hydration`);
    // Try to submit as a visitor would: fill contact, accept, submit.
    await page.getByLabel("Ime", { exact: true }).fill("Marko Jovanović");
    await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
    await page.getByRole("checkbox", { name: /Slažem se/ }).click();
    await page.getByTestId("inquiry-submit").click();
    await page.waitForTimeout(4000);
    r.afterSubmit = {
      url: page.url().replace(BASE, ""),
      errors: await page.evaluate(() =>
        [...document.querySelectorAll('[role="alert"], [id$="-error"], [aria-invalid="true"]')]
          .map((e) => (e.getAttribute("aria-invalid") ? `invalid:${e.id || e.getAttribute("name")}` : e.textContent.trim().slice(0, 120)))
          .filter(Boolean)
          .slice(0, 8),
      ),
    };
    await shot(page, `xbrowser/prehyd-${key}-after-submit`);
  } catch (e) {
    r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
    await shot(page, `xbrowser/prehyd-${key}-error`).catch(() => {});
  }
  r.csp = await cspLog(page);
  r.log = log;
  console.log(key, JSON.stringify(r));
  await context.close();
  await browser.close();
}
saveJson(`prehydration-${ENGINES.join("_")}.json`, out);
