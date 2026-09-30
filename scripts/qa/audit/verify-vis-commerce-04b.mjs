// vis-commerce-04 scope: CTA position with 1 and 2 cart lines at 360/390.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch } from "./kit.mjs";
const OUT = "docs/qa/audit/verify/vis-commerce";
const state = JSON.parse(readFileSync(`${OUT}/_cart-state.json`, "utf8"));
const browser = await launch();
const res = {};
const ctx0 = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS", userAgent: `SklopAudit-vvc-04b/${Date.now()}` });
const p = await ctx0.newPage();
const measure = async (w, h, tag) => {
  const ctx = await browser.newContext({ storageState: await ctx0.storageState(), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS", userAgent: `SklopAudit-vvc-04b-${w}/${Date.now()}` });
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/korpa`);
  await pg.getByTestId("cart-line").first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1500);
  res[`${tag}-${w}`] = await pg.evaluate(() => { const c = document.querySelector('[data-testid="cart-checkout"]').getBoundingClientRect(); const a = document.querySelector('aside[aria-label="Ukupno"]').getBoundingClientRect(); return { lines: document.querySelectorAll('[data-testid="cart-line"]').length, vh: innerHeight, asideTop: Math.round(a.top), ctaTop: Math.round(c.top), ctaBottom: Math.round(c.bottom) }; });
  await ctx.close();
};
await p.goto(`${BASE}/korpa`);
await p.getByTestId("cart-line").first().waitFor({ timeout: 30000 });
await p.waitForTimeout(1200);
await p.locator('button[aria-label^="Ukloni"]').last().click();
await p.waitForFunction(() => document.querySelectorAll('[data-testid="cart-line"]').length === 2, null, { timeout: 20000 });
await p.waitForTimeout(800);
for (const [w, h] of [[360, 780], [390, 844], [430, 932]]) await measure(w, h, "2lines");
console.log(JSON.stringify(res));
writeFileSync(`${OUT}/vis-commerce-04-reproduce-lines.json`, JSON.stringify(res, null, 2));
await browser.close();
