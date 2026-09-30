// Verifier for seo-13: capture the visible landing intro at 390 and 1440.
import { launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
for (const w of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const ctx = await newContext(browser, { ...w, reducedMotion: "reduce", tag: "verify-seo13" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100/delovi/kocioni-diskovi/volkswagen/golf", { waitUntil: "networkidle" });
  const intro = page.locator("p", { hasText: "Pokrivene generacije" }).first();
  await intro.scrollIntoViewIfNeeded();
  console.log(await intro.innerText());
  console.log(await shot(page, `verify/seo/seo-13-reproduce-landing-intro-${w.width}`, { locator: intro }));
  await ctx.close();
}
await browser.close();
