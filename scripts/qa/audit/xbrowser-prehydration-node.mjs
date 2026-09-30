/**
 * xbrowser — diagnostic for xbrowser prehydration: is the SSR <input id="iq-vin"> the same DOM
 * node after hydration (hydrated in place) or replaced (client re-render)? Chunks delayed 6 s.
 */
import { BASE } from "./kit.mjs";
import { ENGINES, launch, saveJson, xctx } from "./xbrowser-lib.mjs";
const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  const context = await xctx(browser, engine, { width: 390, height: 844, tag: "prehydnode" });
  const page = await context.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text().slice(0, 200)); });
  await page.route("**/_next/static/chunks/**", async (route) => { await new Promise((r) => setTimeout(r, 6000)); await route.continue().catch(() => {}); });
  await page.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#iq-vin").waitFor();
  await page.evaluate(() => { window.__vin = document.querySelector("#iq-vin"); window.__form = document.querySelector("#iq-vin").closest("form"); });
  await page.locator("#iq-vin").click();
  await page.keyboard.type("WVWZZZ1KZ8W123456", { delay: 20 });
  await page.waitForFunction(() => { const e = document.querySelector("#iq-vin"); return e && Object.keys(e).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 90_000 });
  await page.waitForTimeout(2500);
  out[engine] = await page.evaluate(() => ({
    sameInput: document.querySelector("#iq-vin") === window.__vin,
    sameForm: document.querySelector("#iq-vin")?.closest("form") === window.__form,
    oldConnected: window.__vin.isConnected,
    value: document.querySelector("#iq-vin")?.value,
  }));
  out[engine].consoleErrorsOrWarnings = errs;
  console.log(engine, JSON.stringify(out[engine]));
  await context.close();
  await browser.close();
}
saveJson(`prehydration-node-${ENGINES.join("_")}.json`, out);
