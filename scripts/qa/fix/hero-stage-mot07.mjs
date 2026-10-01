// Step 22 (hero-stage, MOT-07): does keyboard focus on a header link scroll the page?
// Scrolls / to 1800, presses Tab until a header link has focus and logs scrollY after each
// step; then repeats with header focusables given scroll-margin-top: -80px (the html
// scroll-padding-top), to show where the shift comes from.
import { launch, newContext } from "../audit/kit.mjs";
const base = process.env.AUDIT_BASE ?? "http://localhost:3001";
const browser = await launch();
try {
  for (const patch of [false, true]) {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "mot07" });
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    if (patch) await page.addStyleTag({ content: "header a, header button { scroll-margin-top: -80px; }" });
    for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    const log = [await page.evaluate(() => Math.round(scrollY))];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      log.push(await page.evaluate(() => `${Math.round(scrollY)}:${document.activeElement?.textContent?.trim().slice(0, 16) || document.activeElement?.getAttribute("aria-label")}`));
    }
    console.log(JSON.stringify({ patch, log }));
    await ctx.close();
  }
} finally {
  await browser.close();
}
