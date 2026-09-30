/** vis-store: is the desktop filter rail sticky under the header (DS 9.6)? */
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: `vis-store-rail-${Date.now()}` });
const page = await ctx.newPage();
await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1500);
const probe = () => page.evaluate(() => {
  const h = [...document.querySelectorAll("main *")].find((e) => e.tagName === "LABEL" && /Samo na stanju/.test(e.textContent));
  let el = h; let sticky = null;
  while (el && el !== document.body) { if (getComputedStyle(el).position === "sticky") { sticky = { tag: el.tagName, top: getComputedStyle(el).top, cls: String(el.className).slice(0, 80) }; break; } el = el.parentElement; }
  return { scrollY: Math.round(scrollY), dostupnostTop: h ? Math.round(h.getBoundingClientRect().top) : null, sticky };
});
const a = await probe();
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(120); }
await page.waitForTimeout(800);
const b = await probe();
console.log(JSON.stringify({ a, b }));
await shot(page, "vis-store/v3/rail-scrolled-1440");
await ctx.close();
await browser.close();
