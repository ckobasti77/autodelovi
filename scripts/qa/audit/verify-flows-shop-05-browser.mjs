// Verifier (flows-shop-05): no-JS render and JS render timing of dynamic 404s at 390 px.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
const browser = await launch("chromium");
const out = {};
const routes = ["/deo/ne-postoji-demo-9999", "/delovi/ne-postoji-kategorija", "/upit/losToken123", "/ovo-ne-postoji"];
// 1. JS disabled
for (const r of routes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, isMobile: true });
  const page = await ctx.newPage();
  const res = await page.goto(BASE + r, { waitUntil: "load" });
  const info = await page.evaluate(() => ({ title: document.title, h1: document.querySelector("h1")?.textContent ?? null, bodyText: document.body.innerText.trim().slice(0, 120) }));
  out[`nojs ${r}`] = { status: res.status(), ...info };
  if (r.startsWith("/deo") || r === "/ovo-ne-postoji")
    out[`nojs ${r}`].shot = await shot(page, `verify/flows-shop/flows-shop-05-reproduce-nojs-${r.split("/")[1]}-390`);
  await ctx.close();
}
// 2. JS enabled, 3 runs on product 404: time to h1 visible
for (let i = 0; i < 3; i++) {
  for (const r of ["/deo/ne-postoji-demo-9999", "/ovo-ne-postoji"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `v05-${i}` });
    const page = await ctx.newPage();
    const log = watch(page);
    const t0 = Date.now();
    const res = await page.goto(BASE + r, { waitUntil: "commit" });
    let tH1 = null;
    try {
      await page.locator("h1").first().waitFor({ state: "visible", timeout: 20000 });
      tH1 = Date.now() - t0;
    } catch {}
    await page.waitForLoadState("load").catch(() => {});
    const tLoad = Date.now() - t0;
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ title: document.title, h1: document.querySelector("h1")?.textContent ?? null }));
    out[`js run${i} ${r}`] = { status: res.status(), tH1, tLoad, ...info, consoleErrors: log.console.slice(0, 3) };
    if (i === 0 && r.startsWith("/deo")) out[`js run${i} ${r}`].shot = await shot(page, "verify/flows-shop/flows-shop-05-reproduce-js-deo-390");
    await ctx.close();
  }
}
await browser.close();
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-05-reproduce-browser.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
