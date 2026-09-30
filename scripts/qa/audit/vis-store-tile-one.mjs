/** vis-store: one category tile at DPR 2 after the image has fully loaded (checks img.complete). */
import { BASE, launch, newContext, shot } from "./kit.mjs";
const [route = "/delovi", name = "Kočione pločice", out = "vis-store/delovi/tile-kocione-plocice-dpr2"] = process.argv.slice(2);
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, deviceScaleFactor: 2, tag: "vis-store-tile1" });
const page = await ctx.newPage();
await page.goto(BASE + route, { waitUntil: "load" });
const link = page.locator("main a", { hasText: name }).first();
await link.scrollIntoViewIfNeeded();
await page.waitForFunction((n) => {
  const a = [...document.querySelectorAll("main a")].find((x) => x.textContent.includes(n));
  const img = a?.querySelector("img");
  return img && img.complete && img.naturalWidth > 0;
}, name, { timeout: 30000 });
await page.waitForTimeout(1500);
const info = await link.evaluate((a) => { const i = a.querySelector("img"); return { src: i.currentSrc, nat: [i.naturalWidth, i.naturalHeight], box: [i.clientWidth, i.clientHeight] }; });
console.log(info, await shot(page, out, { locator: link }));
await browser.close();
