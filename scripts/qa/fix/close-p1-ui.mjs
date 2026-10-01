// Step 22 close: quick production-build checks for P1s whose verifiers ran on the dev server.
//   VIS-03 — header at 320/360/390: no horizontal overflow, mobile menu button fully on screen.
//   MOT-02 — product page at 390: after scrolling past the buy button the sticky buy bar sits
//            fully inside the viewport, is not aria-hidden and its button is focusable.
// usage: AUDIT_BASE=http://localhost:3100 node scripts/qa/fix/close-p1-ui.mjs > docs/qa/fix/close/p1-ui.json
import { launch, newContext, BASE } from "../audit/kit.mjs";

const out = { base: BASE, vis03: [], mot02: [] };
const browser = await launch();
try {
  for (const width of [320, 360, 390]) {
    const ctx = await newContext(browser, { width, height: 800, tag: `vis03-${width}` });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    out.vis03.push({
      width,
      ...(await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="mobile-menu-trigger"]');
        const r = btn?.getBoundingClientRect();
        const header = document.querySelector("header");
        return {
          docScrollWidth: document.documentElement.scrollWidth,
          headerScrollWidth: header?.scrollWidth ?? null,
          menuButton: r ? [Math.round(r.left), Math.round(r.right)] : null,
          menuOnScreen: r ? r.left >= 0 && r.right <= window.innerWidth : false,
        };
      })),
    });
    await ctx.close();
  }

  const ctx = await newContext(browser, {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    tag: "mot02",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  for (const y of [1400, 2200]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(1200);
    out.mot02.push({
      scrollY: y,
      ...(await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="sticky-buy-bar"]');
        if (!bar) return { bar: false };
        const r = bar.getBoundingClientRect();
        const btn = bar.querySelector("button, a");
        return {
          bar: true,
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          viewportH: window.innerHeight,
          insideViewport: r.top >= 0 && r.bottom <= window.innerHeight + 0.5,
          ariaHidden: bar.getAttribute("aria-hidden"),
          inert: bar.hasAttribute("inert"),
          buttonText: btn?.textContent?.replace(/\s+/g, " ").trim() ?? null,
        };
      })),
    });
  }
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 1));
