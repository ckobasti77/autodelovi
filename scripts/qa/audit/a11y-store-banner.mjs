/** a11y-store: consent banner — focus obscured (2.4.11), Escape, „Podešavanja“ focus. */
import { launch, newContext, BASE, shot } from "./kit.mjs";
const browser = await launch();
const out = {};
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, consent: false, tag: "a11ybn" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(2500);
  const r = { hits: [] };
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
    const c = await page.evaluate(() => {
      const el = document.activeElement;
      const banner = document.querySelector("[data-testid=consent-banner]");
      if (!el || !banner || banner.contains(el) || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const b = banner.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left));
      const iy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
      const covered = (ix * iy) / (r.width * r.height);
      const name = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50);
      return { name, tag: el.tagName.toLowerCase(), rect: [r.left, r.top, r.width, r.height].map(Math.round), bannerTop: Math.round(b.top), coveredPct: Math.round(covered * 100) };
    });
    if (c && c.coveredPct >= 100) {
      r.hits.push({ tab: i + 1, ...c });
      if (r.hits.length === 1) r.shot = await shot(page, `a11y-store/banner-obscures-focus-${w}`);
    }
  }
  // Escape with focus in page: does the banner go away?
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  r.bannerAfterEscape = await page.getByTestId("consent-banner").isVisible();
  // Podešavanja focus
  await page.getByTestId("consent-banner").getByRole("button", { name: "Podešavanja" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  r.afterSettings = await page.evaluate(() => (document.activeElement === document.body ? "BODY" : document.activeElement.outerHTML.slice(0, 140)));
  r.settingsShot = await shot(page, `a11y-store/banner-settings-focus-${w}`);
  out[w] = r;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
