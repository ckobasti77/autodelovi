// Step 22 shell-perf verify round 2 · VIS-03 regression sweep 1024–1439: do header labels wrap
// (nav links, vehicle chip) with and without the phone + Viber links Header.tsx renders?
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/header-wrap.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith } from "../../../../../../scripts/qa/audit/kit.mjs";

const DIR = "docs/qa/fix/shell-perf/verify/r2";
const { anchors } = JSON.parse(readFileSync(`${DIR}/header-contact-markup.json`, "utf8"));
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const WIDTHS = [1024, 1180, 1279, 1280, 1320, 1366, 1400, 1439, 1440, 1536];

const inject = (page) =>
  page.evaluate((anchors) => {
    const acct = document.querySelector('header [data-testid="account-button"]');
    let first = acct;
    const prev = acct.previousElementSibling;
    if (prev && prev.getAttribute("aria-label") === "Brza porudžbina") first = prev;
    for (const html of anchors) {
      const t = document.createElement("template");
      t.innerHTML = html;
      first.parentElement.insertBefore(t.content.firstElementChild, first);
    }
  }, anchors);

const wraps = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('[data-testid="site-header"]');
    const lines = (e) => {
      let max = 0;
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const tops = new Set();
        for (const r of range.getClientRects()) if (r.width > 1) tops.add(Math.round(r.top / 4));
        max = Math.max(max, tops.size);
      }
      return max;
    };
    const items = [...header.querySelectorAll("nav a, button, a")]
      .filter((e) => getComputedStyle(e).display !== "none" && e.getClientRects().length)
      .map((e) => {
        const r = e.getBoundingClientRect();
        const text = (e.textContent || "").trim();
        return { text: text.slice(0, 26), textH: Math.round(r.height), lines: text ? lines(e) : 0 };
      })
      .filter((i) => i.text);
    return {
      vw: document.documentElement.clientWidth,
      headerH: Math.round(header.getBoundingClientRect().height),
      wrapped: items.filter((i) => i.lines > 1).map((i) => `${i.text} (${i.textH}px)`),
    };
  });

const out = {};
const browser = await launch();
try {
  let mechState;
  {
    const ctx = await newContext(browser, { width: 1280, height: 800, tag: "r2wrap-login" });
    const page = await ctx.newPage();
    await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    mechState = await ctx.storageState();
    await ctx.close();
  }
  for (const role of ["guest", "mechanic"]) {
    for (const w of WIDTHS) {
      const ctx = await newContext(browser, { width: w, height: 900, tag: `r2wrap-${role}-${w}` });
      try {
        if (role === "mechanic") {
          await ctx.addCookies(mechState.cookies);
          await ctx.addInitScript((origins) => {
            const o = origins.find((x) => x.origin === location.origin);
            if (o) for (const { name, value } of o.localStorage) localStorage.setItem(name, value);
          }, mechState.origins);
        }
        const page = await ctx.newPage();
        await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" }).catch(() => {});
        if (role === "mechanic")
          await page.waitForSelector('header [data-testid="account-button"][data-mechanic]', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(800);
        const real = await wraps(page);
        await inject(page);
        await page.waitForTimeout(150);
        const sim = await wraps(page);
        if ([1280, 1366].includes(w))
          await shot(page, `../fix/shell-perf/verify/r2/header-wrap-${role}-sim-${w}`, { clip: { x: 0, y: 0, width: w, height: 64 } });
        out[`${role} ${w}`] = { real, sim };
      } catch (e) {
        out[`${role} ${w}`] = { error: String(e).slice(0, 200) };
      } finally {
        await ctx.close();
      }
    }
  }
} finally {
  writeFileSync(`${DIR}/header-wrap.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
for (const [k, v] of Object.entries(out))
  console.log(k, v.error ?? `real h${v.real.headerH} [${v.real.wrapped.join("; ")}] | sim h${v.sim.headerH} [${v.sim.wrapped.join("; ")}]`);
