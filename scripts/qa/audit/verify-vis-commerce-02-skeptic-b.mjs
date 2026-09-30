// Skeptic verification of vis-commerce-02 (part b): ads landing header, phone-only simulation, real horizontal scroll.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const ICON = "inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
const browser = await launch();
const res = {};
// 1) Ads landing header at 360 (own header in app/(landing)/layout.tsx).
{
  const ctx = await newContext(browser, { width: 360, height: 780, tag: "vc02skb-ponuda" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ponuda/kocione-plocice-golf`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  res.ponuda360 = await page.evaluate(() => ({
    vw: document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth,
    headerItems: [...document.querySelector("header").firstElementChild.children].map((e) => {
      const r = e.getBoundingClientRect();
      return `${(e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 20)}[${Math.round(r.left)}-${Math.round(r.right)} ${getComputedStyle(e).display}]`;
    }),
  }));
  await ctx.close();
}
// 2) Guest at 360/390: phone only, then phone + Viber; check actual horizontal scroll and viewport scale.
for (const [w, h] of [[360, 780], [390, 844]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vc02skb-${w}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  const add = (withViber) =>
    page.evaluate(
      ({ ICON, withViber }) => {
        const acct = document.querySelector('[data-testid="account-button"]');
        const mk = (label, cls) => {
          const a = document.createElement("a");
          a.href = "tel:+381641234567";
          a.setAttribute("aria-label", label);
          a.className = cls;
          a.textContent = label[0];
          acct.parentElement.insertBefore(a, acct);
        };
        if (!withViber) mk("Pozovite (sim)", `${ICON} min-[90rem]:hidden`);
        else mk("Viber (sim)", `${ICON} hidden sm:inline-flex min-[90rem]:hidden`);
      },
      { ICON, withViber },
    );
  const m = () =>
    page.evaluate(() => {
      const menu = [...document.querySelectorAll("header button")].find((b) => /meni/i.test(b.getAttribute("aria-label") || ""));
      const r = menu.getBoundingClientRect();
      window.scrollTo(200, 0);
      const sx = window.scrollX;
      window.scrollTo(0, 0);
      return { vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, menuL: Math.round(r.left), menuR: Math.round(r.right), scrollXAfterScrollTo200: sx, vvScale: window.visualViewport.scale, meta: document.querySelector('meta[name=viewport]')?.content };
    });
  await add(false);
  await page.waitForTimeout(150);
  res[`guest${w}-phoneOnly`] = await m();
  await shot(page, `verify/vis-commerce/vis-commerce-02-skeptic-guest-${w}-phone-only`, { clip: { x: 0, y: 0, width: w, height: 64 } });
  await add(true);
  await page.waitForTimeout(150);
  res[`guest${w}-phoneViber`] = await m();
  await shot(page, `verify/vis-commerce/vis-commerce-02-skeptic-guest-${w}-phone-viber-viewport`);
  await ctx.close();
}
writeFileSync("docs/qa/audit/verify/vis-commerce/vis-commerce-02-skeptic-b.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
await browser.close();
