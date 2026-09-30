/**
 * xbrowser-01 verification, realistic variant: Chromium, Slow 4G (150 ms RTT, 1.6 Mbps down,
 * 750 kbps up) + 4x CPU via CDP, no request interception. Types into the home hero search as soon
 * as it is painted and reports timings and the value after hydration. V_RUNS runs (default 3).
 * Also V_SCOPE=1: JS-chunk delay on other SSR forms (/prijava, /za-majstori/registracija, /registracija)
 * to see which forms keep pre-hydration input.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUDIT_DIR, BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = path.join(AUDIT_DIR, "verify", "xbrowser");
mkdirSync(OUT, { recursive: true });
const RUNS = Number(process.env.V_RUNS ?? 3);
const hydratedFn = (s) => {
  const e = document.querySelector(s);
  return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
};

const out = { real: [], scope: {} };
const browser = await launch("chromium");
if (process.env.V_SCOPE !== "only") {
  for (let i = 0; i < RUNS; i++) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `v01real${i}` });
    const page = await ctx.newPage();
    page.setDefaultTimeout(120_000);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 120_000 });
    const sel = "[data-testid=hero-search-input] input";
    const input = page.locator(sel).first();
    await input.waitFor({ state: "visible" });
    const r = { run: i, visibleAt: Date.now() - t0 };
    r.hydratedBeforeTyping = await page.evaluate(hydratedFn, sel);
    await input.tap();
    await page.keyboard.type("5Q0615505R", { delay: 60 });
    r.typedAt = Date.now() - t0;
    r.domAfterTyping = await input.inputValue();
    r.hydratedRightAfterTyping = await page.evaluate(hydratedFn, sel);
    await page.waitForFunction(hydratedFn, sel, { timeout: 120_000, polling: 50 });
    r.hydratedAt = Date.now() - t0;
    await page.waitForTimeout(2000);
    r.after = await input.inputValue();
    out.real.push(r);
    console.log("real", JSON.stringify(r));
    if (i === 0) await shot(page, "verify/xbrowser/xbrowser-01-reproduce-real-chromium-390-home-after");
    await ctx.close();
  }
}

if (process.env.V_SCOPE) {
  const forms = [
    { route: "/prijava", sel: "[data-testid=auth-email]", text: "kupac@primer.rs" },
    { route: "/registracija", sel: "input[type=email]", text: "kupac@primer.rs" },
    { route: "/za-majstore/registracija", sel: "input[type=email]", text: "servis@primer.rs" },
    { route: "/pretraga?q=disk", sel: "[data-testid=hero-search-input] input, form[role=search] input", text: "5Q0615505R" },
  ];
  for (const f of forms) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "v01scope" });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60_000);
    await page.route("**/_next/static/chunks/**", async (rt) => {
      if (!/\.js(\?|$)/.test(rt.request().url())) return rt.continue();
      await new Promise((res) => setTimeout(res, 6000));
      await rt.continue().catch(() => {});
    });
    const r = {};
    try {
      await page.goto(`${BASE}${f.route}`, { waitUntil: "commit" });
      const el = page.locator(f.sel).first();
      await el.waitFor({ state: "visible" });
      r.hydratedBeforeTyping = await el.evaluate((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
      await el.click();
      await el.press("End");
      await page.keyboard.type(f.text, { delay: 20 });
      r.domAfterTyping = await el.inputValue();
      await page.waitForFunction(
        (s) => {
          const e = document.querySelector(s.split(", ")[0]) ?? document.querySelector(s.split(", ")[1] ?? "x");
          return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
        },
        f.sel,
        { timeout: 60_000, polling: 50 },
      );
      await page.waitForTimeout(2500);
      r.after = await el.inputValue();
    } catch (e) {
      r.error = String(e).split("\n")[0].slice(0, 300);
    }
    out.scope[f.route] = r;
    console.log("scope", f.route, JSON.stringify(r));
    await ctx.close();
  }
}
await browser.close();
const file = path.join(OUT, `xbrowser-01-reproduce-real${process.env.V_SCOPE ? "-scope" : ""}.json`);
writeFileSync(file, JSON.stringify(out, null, 2));
console.log("saved", file);
