import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch("chromium");
for (const [route, w, h, name] of [["/delovi/kocioni-diskovi",1440,900,"cat-1440"],["/delovi/kocioni-diskovi",360,780,"cat-360"],["/pretraga?q=disk",1920,1080,"search-1920"],["/deo/kocioni-disk-prednji-276-24-mm-demo-0004",360,780,"related-360"]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: "v-vs07b" });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  const re = /^Kočioni disk prednji (312|288) × 25 mm, ventilirani$/;
  const link = page.locator("main h3 a, main a").filter({ hasText: re }).first();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const card = link.locator("xpath=ancestor::*[self::article or self::li][1]");
  console.log(name, await shot(page, `verify/vis-store/vis-store-07-reproduce-${name}`, { locator: card }));
  await ctx.close();
}
await browser.close();
