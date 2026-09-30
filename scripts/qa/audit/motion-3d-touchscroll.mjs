// motion-3d: does a vertical touch drag that starts on the 3D canvas scroll the page (pan-y)?
// Control: the same drag on /delovi. Uses CDP Input.dispatchTouchEvent (compositor path).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "m3d-touchscroll" });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const drag = async (x, y0, y1, steps = 10) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(700);
};
const res = {};
await page.goto(`${BASE}/delovi`, { waitUntil: "load", timeout: 90_000 });
await page.waitForTimeout(1500);
let a = await page.evaluate(() => scrollY);
await drag(195, 600, 250);
res.control = { before: a, after: await page.evaluate(() => scrollY) };
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
await page.waitForTimeout(1500);
a = await page.evaluate(() => scrollY);
await drag(195, 700, 350);
res.homeCopy = { before: a, after: await page.evaluate(() => scrollY), status: await page.evaluate(() => window.__sklop3d?.getState().status) };
await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 150_000 });
const trackTop = await page.evaluate(() => {
  const t = document.querySelector('[data-testid="hero-track"]');
  return Math.round(t.getBoundingClientRect().top + scrollY - 56);
});
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1500);
for (const [label, x, y0, y1] of [["canvas-center", 195, 500, 200], ["canvas-car", 195, 560, 300], ["canvas-top", 195, 250, 100]]) {
  const b = await page.evaluate(() => scrollY);
  const el = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return `${e?.tagName} ta=${getComputedStyle(e).touchAction}`; }, [x, y0]);
  await drag(x, y0, y1);
  await page.waitForTimeout(900);
  const s = await page.evaluate(() => window.__sklop3d.getState());
  res[label] = { el, before: b, after: await page.evaluate(() => scrollY), progress: +s.progress.toFixed(3), selected: s.selected };
  await page.evaluate((y) => window.scrollTo(0, y), trackTop);
  await page.waitForTimeout(1200);
}
console.log(JSON.stringify(res, null, 1));
writeFileSync("docs/qa/audit/motion-3d/touch-scroll.json", JSON.stringify(res, null, 2));
await browser.close();
