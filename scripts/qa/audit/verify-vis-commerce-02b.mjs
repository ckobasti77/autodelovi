// vis-commerce-02 follow-up: can a 360 px visitor pan to the off-screen menu (html/body overflow-x)?
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 360, height: 780, tag: "vv02b" });
const page = await ctx.newPage();
await page.goto(`${BASE}/`);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const iconLink = "inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
  const textLink = "inline-flex h-11 items-center gap-2 rounded-xs px-2 text-[0.9375rem] font-medium text-ink-2 transition-control hover:text-ink-1";
  const acct = document.querySelector('[data-testid="account-button"]');
  const svg = acct.querySelector("svg").outerHTML;
  acct.insertAdjacentHTML("beforebegin", [
    `<a href="#" class="${textLink} hidden min-[90rem]:inline-flex">${svg}Pozovite</a>`,
    `<a href="#" aria-label="Pozovite" class="${iconLink} min-[90rem]:hidden">${svg}</a>`,
    `<a href="#" class="${textLink} hidden min-[90rem]:inline-flex">${svg}Viber</a>`,
    `<a href="#" aria-label="Viber" class="${iconLink} hidden sm:inline-flex min-[90rem]:hidden">${svg}</a>`,
  ].join(""));
  const cs = (e) => ({ ox: getComputedStyle(e).overflowX });
  window.scrollTo(1000, 0);
  const menu = document.querySelector('[data-testid="mobile-menu-trigger"]').getBoundingClientRect();
  return { html: cs(document.documentElement), body: cs(document.body), scrollW: document.documentElement.scrollWidth, scrollXAfterScrollTo: window.scrollX, menuAfterPan: { L: Math.round(menu.left), R: Math.round(menu.right) }, visualViewportW: window.visualViewport?.width };
});
await shot(page, "verify/vis-commerce/vis-commerce-02-reproduce-home-360-sim-panned", { clip: { x: 0, y: 0, width: 360, height: 64 } });
console.log(JSON.stringify(r));
writeFileSync("docs/qa/audit/verify/vis-commerce/vis-commerce-02-reproduce-pan.json", JSON.stringify(r, null, 2));
await browser.close();
