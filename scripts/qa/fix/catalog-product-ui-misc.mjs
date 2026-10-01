// A11Y-19 (add-to-cart accessible names), VIS-21 (landing lead collapsed, first price in the
// first 360 px viewport), add-to-cart still works from a card, text-reveal contract on the landing.
import { writeFileSync } from "node:fs";
import { launch, newContext, revealCheck, scrollThrough, shot, watch } from "../audit/kit.mjs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const out = {};
const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width: 360, height: 780, tag: "cpu-misc" });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(BASE + "/delovi/kocioni-diskovi/volkswagen/golf", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  out.landing = await page.evaluate(() => {
    const d = document.querySelector("main details");
    const price = document.querySelector('[data-testid="product-card"] [data-reveal="off"]');
    const card = document.querySelector('[data-testid="product-card"]');
    return {
      detailsSummary: d?.querySelector("summary")?.textContent.trim() ?? null,
      detailsOpen: d?.open ?? null,
      firstCardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
      firstPriceBottom: price ? Math.round(price.getBoundingClientRect().bottom) : null,
      vh: innerHeight,
    };
  });
  await shot(page, "../fix/catalog-product-ui/vis21-landing-360");
  const names = await page.getByTestId("product-add-to-cart").evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("aria-label")));
  const axName = await page.getByRole("button", { name: /^U korpu: / }).first().getAttribute("aria-label");
  out.a11y19 = { names, axName, strayColonSpace: names.some((n) => / :/.test(n ?? "")) };
  // Add to cart from the first card still works.
  await page.getByRole("button", { name: /^U korpu: / }).first().click();
  await page.waitForTimeout(2500);
  out.addToCart = {
    live: await page.evaluate(() => document.getElementById("cart-live")?.textContent ?? null),
  };
  await page.goto(BASE + "/delovi/kocioni-diskovi/volkswagen/golf", { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  await scrollThrough(page, { stepMs: 80 });
  out.reveal = await revealCheck(page);
  out.errors = [...log.console, ...log.pageErrors];
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/catalog-product-ui/misc.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
