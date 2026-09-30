/**
 * flows-shop run 4: long unbroken search query at 360/390 (overflow), long zero-result query →
 * inquiry prefill; order status page for an on-order line (lead time shown?).
 */
import { BASE, launch, newContext, overflowX, shot, watch } from "./kit.mjs";
import { saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = { long: [] };
const browser = await launch();
for (const width of [360, 390]) {
  const ctx = await newContext(browser, { width, height: 800, tag: `flows-r4-${width}` });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(150_000);
  const log = watch(page);
  for (const q of ["5Q0615505R5Q0615505R5Q0615505R5Q0615505R", "x".repeat(120)]) {
    await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "load" });
    await page.locator("h1").first().waitFor();
    await sleep(2500);
    const ov = await overflowX(page);
    const h1 = await page.locator("h1").first().evaluate((e) => ({ w: e.scrollWidth, cw: e.clientWidth, right: e.getBoundingClientRect().right }));
    out.long.push({ width, q: q.slice(0, 20), len: q.length, ov, h1 });
    if (q.startsWith("x")) await shot(page, `${T}/R4-search-long-${width}`);
  }
  out[`log${width}`] = log;
  await ctx.close();
}
console.log(saveJson("run4", out));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await browser.close();
