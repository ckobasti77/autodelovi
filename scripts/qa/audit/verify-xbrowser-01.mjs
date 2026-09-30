/**
 * Independent verification of xbrowser-01 (text typed before hydration is lost).
 * For each engine: delay /_next/static/chunks by DELAY ms, type into the server-rendered field
 * as soon as it is visible, wait for React to own the node, then read the DOM value, check the
 * node identity, and (for /upit) try to submit.
 *   V_ENGINES=chromium,webkit,firefox V_WIDTH=390 node scripts/qa/audit/verify-xbrowser-01.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUDIT_DIR, BASE, launch, newContext, shot } from "./kit.mjs";

const DELAY = Number(process.env.V_DELAY ?? 6000);
const WIDTH = Number(process.env.V_WIDTH ?? 390);
const ENGINES = (process.env.V_ENGINES ?? "chromium,webkit,firefox").split(",");
const ROUTES = (process.env.V_ROUTES ?? "home,upit").split(",");
const OUT = path.join(AUDIT_DIR, "verify", "xbrowser");
mkdirSync(OUT, { recursive: true });

const hydratedFn = (s) => {
  const e = document.querySelector(s);
  return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
};

const result = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const route of ROUTES) {
    const key = `${engine}-${WIDTH}-${route}`;
    const r = (result[key] = { delay: DELAY });
    const ctx = await newContext(browser, { width: WIDTH, height: WIDTH < 1024 ? 844 : 900, tag: `v01-${engine}`, engine });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    let chunkReqs = 0;
    await page.route("**/_next/static/chunks/**", async (rt) => {
      // Only JS: CSS is render-blocking, delaying it would hide the form as well.
      if (!/\.js(\?|$)/.test(rt.request().url())) return rt.continue();
      chunkReqs++;
      await new Promise((res) => setTimeout(res, DELAY));
      await rt.continue().catch(() => {});
    });
    const t0 = Date.now();
    try {
      if (route === "home") {
        await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 90_000 });
        const sel = "[data-testid=hero-search-input] input";
        const input = page.locator(sel).first();
        await input.waitFor({ state: "visible" });
        r.visibleAt = Date.now() - t0;
        r.hydratedBeforeTyping = await page.evaluate(hydratedFn, sel);
        await input.evaluate((e) => (window.__node = e));
        await input.click();
        await page.keyboard.type("5Q0615505R", { delay: 40 });
        r.typedAt = Date.now() - t0;
        r.domAfterTyping = await input.inputValue();
        r.hydratedRightAfterTyping = await page.evaluate(hydratedFn, sel);
        await page.waitForFunction(hydratedFn, sel, { timeout: 90_000, polling: 50 });
        r.hydratedAt = Date.now() - t0;
        await page.waitForTimeout(2500);
        r.after = await page.evaluate((s) => {
          const e = document.querySelector(s);
          return { value: e?.value, sameNode: e === window.__node, focused: document.activeElement === e };
        }, sel);
        await shot(page, `verify/xbrowser/xbrowser-01-reproduce-${key}`);
      } else {
        await page.goto(`${BASE}/upit`, { waitUntil: "commit", timeout: 90_000 });
        const vin = page.locator("#iq-vin");
        await vin.waitFor({ state: "visible" });
        r.visibleAt = Date.now() - t0;
        r.hydratedBeforeTyping = await page.evaluate(hydratedFn, "#iq-vin");
        await vin.evaluate((e) => (window.__node = e));
        await vin.click();
        await page.keyboard.type("WVWZZZ1KZ8W123456", { delay: 20 });
        const msg = page.locator("textarea").first();
        await msg.click();
        await page.keyboard.type("Turbina za Golf 7, dizel.", { delay: 20 });
        r.typedAt = Date.now() - t0;
        r.domAfterTyping = { vin: await vin.inputValue(), msg: await msg.inputValue() };
        r.hydratedRightAfterTyping = await page.evaluate(hydratedFn, "#iq-vin");
        await page.waitForFunction(hydratedFn, "#iq-vin", { timeout: 90_000, polling: 50 });
        r.hydratedAt = Date.now() - t0;
        await page.waitForTimeout(3000);
        r.after = await page.evaluate(() => {
          const v = document.querySelector("#iq-vin");
          const ta = document.querySelector("textarea");
          const txt = document.body.innerText;
          return {
            vin: v?.value,
            sameNode: v === window.__node,
            msg: ta?.value,
            vinCounter: (txt.match(/\d+ \/ 17 znakova/) ?? [""])[0],
            msgCounter: (txt.match(/\d+(\.\d+)? \/ 2\.000/) ?? [""])[0],
            brand: document.querySelector("#iq-brandSlug")?.value ?? null,
          };
        });
        await shot(page, `verify/xbrowser/xbrowser-01-reproduce-${key}-after-hydration`);
        await page.getByLabel("Ime", { exact: true }).fill("Verifikacija Test");
        await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
        await page.getByRole("checkbox", { name: /Slažem se/ }).click();
        await page.getByTestId("inquiry-submit").click();
        await page.waitForTimeout(4000);
        r.afterSubmit = {
          url: page.url().replace(BASE, ""),
          alerts: await page.evaluate(() =>
            [...document.querySelectorAll('[role="alert"], [id$="-error"]')]
              .map((e) => e.textContent.trim().slice(0, 120))
              .filter(Boolean)
              .slice(0, 6),
          ),
        };
        await shot(page, `verify/xbrowser/xbrowser-01-reproduce-${key}-after-submit`);
      }
    } catch (e) {
      r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
    }
    r.chunkRequestsDelayed = chunkReqs;
    console.log(key, JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
}
const file = path.join(OUT, `xbrowser-01-reproduce-${ENGINES.join("_")}-${WIDTH}-${ROUTES.join("_")}.json`);
writeFileSync(file, JSON.stringify(result, null, 2));
console.log("saved", file);
