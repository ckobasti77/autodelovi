// Independent verification of vis-commerce-02: header icon links with `hidden sm:inline-flex`
// (plus iconLink/textLink base `inline-flex`) — are they hidden below 480 px? Real guest + real
// mechanic measurements, then a faithful simulation of the exact markup Header.tsx renders once
// phone + Viber are set (text links AND icon links, same classes, same position).
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith, overflowX } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-commerce";
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const engine = process.env.ENGINE ?? "chromium";
const res = { engine, guest: {}, sim: {}, mechanic: {} };

async function settle(page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function measure(page) {
  return page.evaluate(() => {
    const header = document.querySelector('[data-testid="site-header"]');
    const vw = document.documentElement.clientWidth;
    const items = [...header.querySelectorAll("a, button")]
      .filter((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { label: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 20), L: Math.round(r.left), R: Math.round(r.right), display: getComputedStyle(e).display };
      });
    const acct = document.querySelector('[data-testid="account-button"]');
    const menu = document.querySelector('[data-testid="mobile-menu-trigger"]');
    const mr = menu && getComputedStyle(menu).display !== "none" ? menu.getBoundingClientRect() : null;
    return {
      vw,
      scrollW: document.documentElement.scrollWidth,
      accountClass: acct?.className,
      accountDisplay: acct && getComputedStyle(acct).display,
      menu: mr ? { L: Math.round(mr.left), R: Math.round(mr.right), clippedPx: Math.max(0, Math.round(mr.right - vw)) } : null,
      items,
    };
  });
}

// Inserts the exact elements Header.tsx renders for phone + Viber (lines 53-82), before AccountLink.
function simulateContacts(page) {
  return page.evaluate(() => {
    const iconLink = "inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
    const textLink = "inline-flex h-11 items-center gap-2 rounded-xs px-2 text-[0.9375rem] font-medium text-ink-2 transition-control hover:text-ink-1";
    const acct = document.querySelector('[data-testid="account-button"]');
    const quick = acct.parentElement.querySelector('a[aria-label="Brza porudžbina"]');
    const anchor = quick ?? acct;
    const svg = acct.querySelector("svg").outerHTML;
    const html = [
      `<a data-sim href="tel:+381641234567" class="${textLink} hidden min-[90rem]:inline-flex">${svg}Pozovite</a>`,
      `<a data-sim href="tel:+381641234567" aria-label="Pozovite +381 64 123 4567" class="${iconLink} min-[90rem]:hidden">${svg}</a>`,
      `<a data-sim href="viber://chat?number=%2B381641234567" class="${textLink} hidden min-[90rem]:inline-flex">${svg}Viber</a>`,
      `<a data-sim href="viber://chat?number=%2B381641234567" aria-label="Viber +381 64 123 4567" class="${iconLink} hidden sm:inline-flex min-[90rem]:hidden">${svg}</a>`,
    ].join("");
    anchor.insertAdjacentHTML("beforebegin", html);
  });
}

const browser = await launch(engine);

// A. Guest, real state (no phone/Viber configured).
for (const [w, h] of [[360, 780], [390, 844], [479, 900], [480, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vv02-g${w}`, engine });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/delovi/kocioni-diskovi`);
  await settle(page);
  res.guest[w] = await measure(page);
  if (w === 360 || w === 390) await shot(page, `verify/vis-commerce/vis-commerce-02-reproduce-${engine}-guest-${w}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
  // B. Simulated phone + Viber at this width and wider ones.
  await simulateContacts(page);
  await page.waitForTimeout(200);
  res.sim[w] = await measure(page);
  if (w === 360 || w === 390) await shot(page, `verify/vis-commerce/vis-commerce-02-reproduce-${engine}-sim-${w}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
  await ctx.close();
}
for (const [w, h] of [[768, 1024], [1024, 768], [1280, 800], [1440, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vv02-s${w}`, engine });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/delovi/kocioni-diskovi`);
  await settle(page);
  await simulateContacts(page);
  await page.waitForTimeout(200);
  res.sim[w] = await measure(page);
  if (w === 1024 || w === 1280) await shot(page, `verify/vis-commerce/vis-commerce-02-reproduce-${engine}-sim-${w}`, { clip: { x: Math.max(0, w - 760), y: 0, width: 760, height: 64 } });
  await ctx.close();
}

// C. Approved mechanic, real state.
if (engine === "chromium") {
  for (const [w, h] of [[360, 780], [390, 844]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vv02-m${w}`, engine });
    const page = await ctx.newPage();
    await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    for (const route of ["/delovi", "/", "/korpa"]) {
      await page.goto(`${BASE}${route}`);
      await settle(page, 2000);
      await page.waitForSelector('a[aria-label="Brza porudžbina"]', { timeout: 10000 }).catch(() => {});
      const m = await measure(page);
      m.overflow = await overflowX(page);
      res.mechanic[`${w} ${route}`] = m;
      if (route === "/delovi") await shot(page, `verify/vis-commerce/vis-commerce-02-reproduce-mechanic-${w}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
    }
    await ctx.close();
  }
}

writeFileSync(`${OUT}/vis-commerce-02-reproduce-${engine}.json`, JSON.stringify(res, null, 2));
const brief = (m) => m && `vw ${m.vw} scrollW ${m.scrollW} acct ${m.accountDisplay} menu ${JSON.stringify(m.menu)} | ${m.items.map((i) => `${i.label}[${i.L}-${i.R}]`).join(" ")}`;
for (const k of Object.keys(res.guest)) console.log("guest", k, brief(res.guest[k]));
for (const k of Object.keys(res.sim)) console.log("sim", k, brief(res.sim[k]));
for (const k of Object.keys(res.mechanic)) console.log("mech", k, brief(res.mechanic[k]), "over", res.mechanic[k].overflow.over);
await browser.close();
