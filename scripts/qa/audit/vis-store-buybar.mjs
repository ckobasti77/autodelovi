/** vis-store: does the mobile sticky buy bar (components/product/StickyBuyBar.tsx) ever appear? */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch();
const rows = [];
for (const [w, h, slug] of [
  [390, 844, "kocioni-disk-prednji-276-24-mm-demo-0004"],
  [360, 780, "kocioni-disk-prednji-276-24-mm-demo-0004"],
  [768, 1024, "kocioni-disk-prednji-276-24-mm-demo-0004"],
]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vis-store-bb-${w}-${Date.now()}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  const probe = () =>
    page.evaluate(() => {
      const buy = document.getElementById("buy-box");
      const cands = [...document.querySelectorAll("body *")].filter((e) => {
        const cs = getComputedStyle(e);
        return cs.position === "fixed" && /inset-x-0/.test(String(e.className)) && /bottom-0/.test(String(e.className));
      });
      return {
        scrollY: Math.round(scrollY),
        buyBox: buy ? { top: Math.round(buy.getBoundingClientRect().top), bottom: Math.round(buy.getBoundingClientRect().bottom) } : "no #buy-box",
        mobileMq: matchMedia("(max-width: 1023.98px)").matches,
        bars: cands.map((e) => ({
          cls: String(e.className).slice(0, 80),
          text: e.textContent.trim().slice(0, 60),
          visibility: getComputedStyle(e).visibility,
          transform: getComputedStyle(e).transform,
          top: Math.round(e.getBoundingClientRect().top),
          ariaHidden: e.getAttribute("aria-hidden"),
        })),
      };
    });
  const before = await probe();
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2000);
  const after = await probe();
  rows.push({ w, before, after });
  console.log(w, JSON.stringify({ before, after }, null, 1));
  await shot(page, `vis-store/v2/buybar-probe-${w}`);
  await ctx.close();
}
writeFileSync("docs/qa/audit/vis-store/v2-buybar-probe.json", JSON.stringify(rows, null, 1));
await browser.close();
