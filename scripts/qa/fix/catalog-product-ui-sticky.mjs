// MOT-02: the mobile sticky buy bar must be fully on screen after scrolling past the inline
// buy box (normal + reduced motion), hidden + inert when scrolled back, and register a bottom inset.
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, watch } from "../audit/kit.mjs";

const URL_ = `${process.env.AUDIT_BASE ?? "http://localhost:3001"}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`;
const out = {};
const browser = await launch("chromium");
try {
  for (const [tag, reducedMotion, width] of [
    ["390", "no-preference", 390],
    ["390-reduced", "reduce", 390],
    ["360", "no-preference", 360],
  ]) {
    const ctx = await newContext(browser, { width, height: 844, reducedMotion, tag: `sticky-${tag}` });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(URL_, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    const bar = page.locator('[data-testid="sticky-buy-bar"]');
    const state = () =>
      bar.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          top: Math.round(r.top * 10) / 10,
          bottom: Math.round(r.bottom * 10) / 10,
          vh: innerHeight,
          visibility: cs.visibility,
          opacity: cs.opacity,
          transform: cs.transform,
          inert: el.inert,
          ariaHidden: el.getAttribute("aria-hidden"),
          scrollPaddingBottom: document.documentElement.style.scrollPaddingBottom || null,
        };
      });
    const initial = await state();
    const boxBottom = await page.locator("#buy-box").evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
    await page.mouse.wheel(0, Math.ceil(boxBottom) + 200);
    await page.waitForTimeout(1200);
    const past = await state();
    await shot(page, `../fix/catalog-product-ui/mot02-${tag}-past`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(1000);
    const back = await state();
    out[tag] = {
      initial,
      past,
      back,
      pass:
        past.visibility === "visible" && past.bottom <= past.vh + 0.5 && past.top < past.vh && !past.inert &&
        back.visibility === "hidden" && back.inert && initial.visibility === "hidden",
      errors: [...log.console, ...log.pageErrors],
    };
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/catalog-product-ui/mot02-sticky.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
