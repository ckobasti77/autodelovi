/**
 * Independent verification (skeptic) of xbrowser-01: text typed into SSR fields before hydration.
 * For each run: hold /_next/static/chunks (route delay) or throttle via CDP (chromium only),
 * type char by char, record the DOM value and hydration state before hydration, then a value
 * timeline after hydration (what React does to the field).
 *   V_ENGINE=chromium|webkit V_MODE=delay|cdp V_ROUTE=home|upit V_RUNS=3 V_W=390
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUDIT_DIR, BASE, launch, newContext, shot } from "./kit.mjs";

const ENGINE = process.env.V_ENGINE ?? "chromium";
const MODE = process.env.V_MODE ?? "delay";
const ROUTE = process.env.V_ROUTE ?? "home";
const RUNS = Number(process.env.V_RUNS ?? 3);
const W = Number(process.env.V_W ?? 390);
const DELAY = Number(process.env.V_DELAY ?? 6000);

const hydratedFn = (sel) => {
  const e = document.querySelector(sel);
  return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
};

async function typeTracked(page, sel, text) {
  await page.locator(sel).first().click();
  const perChar = [];
  for (const ch of text) {
    await page.keyboard.type(ch);
    perChar.push(await page.evaluate(hydratedFn, sel));
    await page.waitForTimeout(40);
  }
  return { hydratedDuringTyping: perChar.some(Boolean), valueBeforeHydration: await page.locator(sel).first().inputValue() };
}

async function timeline(page, sels, ms = 3000) {
  const t = [];
  const start = Date.now();
  let last = "";
  while (Date.now() - start < ms) {
    const v = await page.evaluate((ss) => ss.map((s) => document.querySelector(s)?.value ?? null).join(" | "), sels);
    if (v !== last) t.push({ at: Date.now() - start, v });
    last = v;
    await page.waitForTimeout(50);
  }
  return t;
}

const out = [];
const browser = await launch(ENGINE);
for (let i = 0; i < RUNS; i++) {
  const ctx = await newContext(browser, { width: W, height: W < 1024 ? 844 : 900, engine: ENGINE, tag: `vx01-${ENGINE}-${i}` });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  if (MODE === "delay") {
    await page.route("**/_next/static/chunks/**", async (route) => {
      if (process.env.V_JSONLY && !/\.js(\?|$)/.test(route.request().url())) return route.continue().catch(() => {});
      await new Promise((r) => setTimeout(r, DELAY));
      await route.continue().catch(() => {});
    });
  } else {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const r = { jsOnly: !!process.env.V_JSONLY, engine: ENGINE, mode: MODE, route: ROUTE, width: W, run: i };
  const t0 = Date.now();
  try {
    if (ROUTE === "home") {
      const sel = "[data-testid=hero-search-input] input";
      await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 120_000 });
      await page.locator(sel).first().waitFor({ state: "visible", timeout: 120_000 });
      r.visibleAt = Date.now() - t0;
      r.hydratedAtVisible = await page.evaluate(hydratedFn, sel);
      Object.assign(r, await typeTracked(page, sel, "5Q0615505R"));
      r.typedAt = Date.now() - t0;
      await page.waitForFunction(hydratedFn, sel, { timeout: 120_000 });
      r.hydratedAt = Date.now() - t0;
      r.timeline = await timeline(page, [sel]);
      r.after = await page.locator(sel).first().inputValue();
      r.focused = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
      if (i === 0) r.shot = await shot(page, `verify/xbrowser/xbrowser-01-skeptic-${ENGINE}-${MODE}-${W}-home-after`);
    } else {
      const vin = "#iq-vin";
      const msg = "textarea";
      await page.goto(`${BASE}/upit`, { waitUntil: "commit", timeout: 120_000 });
      await page.locator(vin).waitFor({ state: "visible", timeout: 120_000 });
      r.visibleAt = Date.now() - t0;
      r.hydratedAtVisible = await page.evaluate(hydratedFn, vin);
      const a = await typeTracked(page, vin, "WVWZZZ1KZ8W123456");
      const b = await typeTracked(page, msg, "Turbina za Golf 7, dizel.");
      r.vinTyping = a;
      r.msgTyping = b;
      r.typedAt = Date.now() - t0;
      await page.waitForFunction(hydratedFn, vin, { timeout: 120_000 });
      r.hydratedAt = Date.now() - t0;
      r.timeline = await timeline(page, [vin, msg]);
      r.after = await page.evaluate(() => ({
        vin: document.querySelector("#iq-vin")?.value,
        msg: document.querySelector("textarea")?.value,
        counters: (document.body.innerText.match(/\d+ \/ 17 znakova|\d+(\.\d+)? \/ 2\.000/g) ?? []),
        brand: document.querySelector("#iq-brandSlug")?.value ?? null,
      }));
      if (i === 0) r.shot = await shot(page, `verify/xbrowser/xbrowser-01-skeptic-${ENGINE}-${MODE}-${W}-upit-after`);
      if (!r.after.msg && i === 0) {
        await page.getByLabel("Ime", { exact: true }).fill("Verifikacija Skeptik");
        await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
        await page.getByRole("checkbox", { name: /Slažem se/ }).click();
        await page.getByTestId("inquiry-submit").click();
        await page.waitForTimeout(2500);
        r.submit = {
          url: page.url().replace(BASE, ""),
          alerts: await page.evaluate(() => [...document.querySelectorAll('[role="alert"], [id$="-error"]')].map((e) => e.textContent.trim().slice(0, 120)).filter(Boolean).slice(0, 6)),
        };
        r.submitShot = await shot(page, `verify/xbrowser/xbrowser-01-skeptic-${ENGINE}-${MODE}-${W}-upit-submit`);
      }
    }
  } catch (e) {
    r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
  }
  r.consoleErrors = errs;
  console.log(JSON.stringify(r));
  out.push(r);
  await ctx.close();
}
await browser.close();
const dir = path.join(AUDIT_DIR, "verify/xbrowser");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `xbrowser-01-skeptic-${ENGINE}-${MODE}${process.env.V_JSONLY ? "-jsonly" : ""}-${ROUTE}-${W}.json`), JSON.stringify(out, null, 2));
