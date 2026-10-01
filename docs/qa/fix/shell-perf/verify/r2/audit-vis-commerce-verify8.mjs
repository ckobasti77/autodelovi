// Copy of scripts/qa/audit/vis-commerce-verify8.mjs with outputs redirected to this folder (audit evidence untouched).
// vis-commerce: header icon links at 360/390 (guest) — does `hidden sm:inline-flex` hide the account link
// below 480 px? Then simulate the phone + Viber icons the header adds once the owner sets them.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "../../../../../../scripts/qa/audit/kit.mjs";
import { OUT, harden, settle } from "../../../../../../scripts/qa/audit/vis-commerce-lib.mjs";
const browser = await launch();
const res = {};
for (const [w, h] of [[360, 780], [390, 844]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `viscom8-${w}` });
  const page = harden(await ctx.newPage());
  await page.goto(`${BASE}/delovi/kocioni-diskovi`);
  await settle(page, 1500);
  res[w] = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="account-button"]') || document.querySelector('header a[aria-label="Moj nalog"]');
    const cls = String(a?.className);
    return { accountDisplay: a && getComputedStyle(a).display, hasHidden: /(^|\s)hidden(\s|$)/.test(cls), hasSmInline: cls.includes("sm:inline-flex"), cls: cls.slice(0, 200), scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth };
  });
  // Simulate the phone + Viber icon links (same classes as the account link) that Header.tsx renders when set.
  res[w].simulated = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="account-button"]') || document.querySelector('header a[aria-label="Moj nalog"]');
    for (const label of ["Pozovite (sim)", "Viber (sim)"]) {
      const c = a.cloneNode(true);
      c.setAttribute("aria-label", label);
      c.removeAttribute("data-testid");
      a.parentElement.insertBefore(c, a);
    }
    const menu = document.querySelector('[data-testid="mobile-menu-trigger"]') || [...document.querySelectorAll("header button")].at(-1);
    const r = menu.getBoundingClientRect();
    return { scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth, menuLeft: Math.round(r.left), menuRight: Math.round(r.right) };
  });
  await shot(page, `../fix/shell-perf/verify/r2/audit-v8-${w}-header-guest-sim-phone-viber`, { clip: { x: 0, y: 0, width: w, height: 60 } });
  await ctx.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify/r2/audit-verify8-header.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res));
await browser.close();
