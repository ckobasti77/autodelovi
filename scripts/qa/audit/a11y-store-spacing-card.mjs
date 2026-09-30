/** a11y-store: product card under the WCAG 1.4.12 text-spacing override at 320 and 390 CSS px (card crop). */
import { launch, newContext, shot, BASE } from "./kit.mjs";
const SPACING = `*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}`;
const browser = await launch();
for (const w of (process.env.W ? process.env.W.split(",").map(Number) : [320, 390])) {
  const ctx = await newContext(browser, { width: w, height: 800, tag: `a11ysp${w}` });
  const page = await ctx.newPage();
  await page.goto(BASE + "/ponuda/kocione-plocice-golf", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  const card = page.locator("main article").first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const before = await card.evaluate((c) => [...c.querySelectorAll("a, p")].map((e) => ({ t: e.textContent.trim().slice(0, 50), clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 })));
  await shot(page, `a11y-store/v2-card-normal-${w}`, { locator: card });
  await page.addStyleTag({ content: SPACING });
  await page.waitForTimeout(600);
  const after = await card.evaluate((c) => [...c.querySelectorAll("a, p")].map((e) => ({ t: e.textContent.trim().slice(0, 50), clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 })));
  await shot(page, `a11y-store/v2-card-spacing-${w}`, { locator: card });
  console.log(w, JSON.stringify({ before: before.filter((x) => x.clipped), after: after.filter((x) => x.clipped) }));
  await ctx.close();
}
await browser.close();
