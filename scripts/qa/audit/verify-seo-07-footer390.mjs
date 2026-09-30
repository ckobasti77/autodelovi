/** Step 21 QA audit — seo-07 verification: the footer at 390 px, captured as a locator (no /kontakt link). */
import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "vseo07" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/kontakt`, { waitUntil: "networkidle" });
  const footer = page.locator("footer").first();
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
  }
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  console.log(await shot(page, "verify/seo/seo-07-reproduce-footer-390-full", { locator: footer }));
  const crumbs = await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Putanja"] a, nav[aria-label="Putanja"] [aria-current]')].map(
      (e) => `${e.tagName.toLowerCase()} ${e.getAttribute("href") ?? ""} ${e.textContent.trim()}`,
    ),
  );
  console.log("kontakt breadcrumb:", JSON.stringify(crumbs));
} finally {
  await browser.close();
}
