/**
 * xbrowser — realistic pre-hydration window in Chromium without request delays: Slow 4G
 * (150 ms RTT, 1.6 Mbps) + 4x CPU via CDP. Types an OEM number into the home hero search as soon
 * as the field is painted, then reports whether the text survives hydration and how long the
 * field was editable before React owned it. 3 runs.
 */
import { BASE, shot } from "./kit.mjs";
import { launch, saveJson, xctx } from "./xbrowser-lib.mjs";
const out = [];
const browser = await launch("chromium");
for (let i = 0; i < 3; i++) {
  const ctx = await xctx(browser, "chromium", { width: 390, height: 844, tag: `real${i}` });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 120_000 });
  const sel = "[data-testid=hero-search-input] input, input[data-testid=hero-search-input]";
  await page.locator(sel).first().waitFor({ state: "visible", timeout: 120_000 });
  const visibleAt = Date.now() - t0;
  const hydratedAtType = await page.locator(sel).first().evaluate((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
  await page.locator(sel).first().click();
  await page.keyboard.type("5Q0615505R", { delay: 60 });
  const typedAt = Date.now() - t0;
  await page.waitForFunction((s) => { const e = document.querySelector(s.split(", ")[1]) ?? document.querySelector(s.split(", ")[0]); return e && Object.keys(e).some((k) => k.startsWith("__reactProps")); }, sel, { timeout: 120_000 });
  const hydratedAt = Date.now() - t0;
  await page.waitForTimeout(1500);
  const after = await page.locator(sel).first().inputValue();
  const r = { run: i, visibleAt, typedAt, hydratedAt, hydratedAtType, after };
  out.push(r);
  console.log(JSON.stringify(r));
  if (i === 0) await shot(page, "xbrowser/prehyd-real-chromium-390-home-after");
  await ctx.close();
}
await browser.close();
saveJson("prehydration-real-chromium.json", out);
