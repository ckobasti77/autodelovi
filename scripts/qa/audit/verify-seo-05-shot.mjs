// Verifier (seo-05): capture the generation page's category tiles and its landing-links section.
import { launch, newContext, scrollThrough, shot } from "./kit.mjs";
const browser = await launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: "verify-seo" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100/vozila/volkswagen/golf/golf-7", { waitUntil: "networkidle" });
  await scrollThrough(page);
  const sec = page.locator("#generation-landings-title").locator("xpath=ancestor::*[self::section or self::nav][1]");
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await shot(page, `verify/seo/seo-05-reproduce-landing-links-${w}`, { locator: sec });
  const hrefs = await sec.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  console.log(w, hrefs);
  await ctx.close();
}
await browser.close();
