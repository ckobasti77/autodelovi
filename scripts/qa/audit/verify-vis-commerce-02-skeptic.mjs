// Skeptic verification of vis-commerce-02: header icon links at 360/390 (guest + approved mechanic),
// real state and with phone + Viber simulated using the exact classes Header.tsx renders.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-commerce";
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const ICON = "inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";

const measure = (page) =>
  page.evaluate(() => {
    const header = document.querySelector("header");
    const row = header.firstElementChild;
    const right = row.lastElementChild;
    const items = [...row.children, ...right.children].filter((e) => e !== right).map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const btn = e.matches("a,button") ? e : e.querySelector("a,button");
      return {
        tag: e.tagName.toLowerCase(),
        label: (btn?.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30),
        display: cs.display,
        L: Math.round(r.left),
        R: Math.round(r.right),
        cls: String(e.className).includes("hidden sm:inline-flex") ? "hidden sm:inline-flex" : "",
      };
    }).filter((i) => i.display !== "none");
    const menu = [...header.querySelectorAll("button")].find((b) => /meni/i.test(b.getAttribute("aria-label") || ""));
    const mr = menu?.getBoundingClientRect();
    return {
      vw: document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth,
      headerScrollW: row.scrollWidth,
      menu: menu ? { label: menu.getAttribute("aria-label"), L: Math.round(mr.left), R: Math.round(mr.right) } : null,
      items,
    };
  });

const simulate = (page, icon) =>
  page.evaluate((ICON) => {
    const acct = document.querySelector('[data-testid="account-button"]');
    const parent = acct.parentElement;
    // AccountLink renders a fragment: quick-order (mechanic) + account. Insert before the first of them.
    let first = acct;
    const prev = acct.previousElementSibling;
    if (prev && prev.getAttribute("aria-label") === "Brza porudžbina") first = prev;
    const phone = document.createElement("a");
    phone.href = "tel:+381641234567";
    phone.setAttribute("aria-label", "Pozovite (sim)");
    phone.className = `${ICON} min-[90rem]:hidden`;
    phone.textContent = "P";
    const viber = document.createElement("a");
    viber.href = "viber://chat?number=%2B381641234567";
    viber.setAttribute("aria-label", "Viber (sim)");
    viber.className = `${ICON} hidden sm:inline-flex min-[90rem]:hidden`;
    viber.textContent = "V";
    parent.insertBefore(phone, first);
    parent.insertBefore(viber, first);
  }, icon);

// "As intended": what would happen if `hidden` below sm actually applied.
const intended = (page) =>
  page.evaluate(() => {
    if (window.innerWidth < 480)
      for (const e of document.querySelectorAll('header [class*="sm:inline-flex"]')) e.style.display = "none";
  });

const browser = await launch();
const res = {};
const run = async (role, w, h, route, doSim) => {
  const ctx = await newContext(browser, { width: w, height: h, tag: `vc02sk-${role}-${w}` });
  const page = await ctx.newPage();
  if (role === "mechanic") await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  const key = `${role}-${w}-${route}`;
  res[key] = { real: await measure(page) };
  await shot(page, `verify/vis-commerce/vis-commerce-02-skeptic-${role}-${w}-real`, { clip: { x: 0, y: 0, width: w, height: 64 } });
  if (doSim) {
    await simulate(page, ICON);
    await page.waitForTimeout(200);
    res[key].simPhoneViber = await measure(page);
    await shot(page, `verify/vis-commerce/vis-commerce-02-skeptic-${role}-${w}-sim`, { clip: { x: 0, y: 0, width: w, height: 64 } });
    await intended(page);
    await page.waitForTimeout(100);
    res[key].simIfHiddenWorked = await measure(page);
  }
  await ctx.close();
};
for (const [w, h] of [[360, 780], [390, 844], [430, 932]]) {
  await run("guest", w, h, "/delovi/kocioni-diskovi", true);
}
await run("guest", 360, 780, "/", false);
for (const [w, h] of [[360, 780], [390, 844]]) {
  await run("mechanic", w, h, "/delovi", true);
}
writeFileSync(`${OUT}/vis-commerce-02-skeptic.json`, JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res)) {
  const s = (m) => m && `scrollW ${m.scrollW}/${m.vw} menu ${m.menu?.L}-${m.menu?.R} | ${m.items.map((i) => `${i.label || i.tag}[${i.L}-${i.R}${i.cls ? " " + i.display : ""}]`).join(" ")}`;
  console.log(k, "\n  real:", s(v.real), "\n  sim:", s(v.simPhoneViber), "\n  ifHidden:", s(v.simIfHiddenWorked));
}
await browser.close();
