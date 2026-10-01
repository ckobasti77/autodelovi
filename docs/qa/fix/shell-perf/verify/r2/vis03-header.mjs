// Step 22 shell-perf verify round 2 · VIS-03. Injects the exact contact anchors Header.tsx renders
// with phone + Viber (header-contact-markup.json, produced by header-markup.render.test.tsx) at
// their real position (before AccountLink), then measures the header for guest and approved
// mechanic over many widths; also the real header without injection, keyboard order and menu.
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/vis03-header.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, loginWith } from "../../../../../../scripts/qa/audit/kit.mjs";

const DIR = "docs/qa/fix/shell-perf/verify/r2";
const { anchors } = JSON.parse(readFileSync(`${DIR}/header-contact-markup.json`, "utf8"));
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const WIDTHS = [320, 360, 375, 390, 412, 430, 479, 480, 540, 640, 768, 1023, 1024, 1279, 1280, 1366, 1439, 1440, 1920];
const QUICK = "Brza porudžbina";

const inject = (page) =>
  page.evaluate(
    ({ anchors, QUICK }) => {
      const acct = document.querySelector('header [data-testid="account-button"]');
      let first = acct;
      const prev = acct.previousElementSibling;
      if (prev && prev.getAttribute("aria-label") === QUICK) first = prev;
      for (const html of anchors) {
        const t = document.createElement("template");
        t.innerHTML = html;
        const a = t.content.firstElementChild;
        a.setAttribute("data-r2-sim", "");
        first.parentElement.insertBefore(a, first);
      }
    },
    { anchors, QUICK },
  );

const measure = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const header = document.querySelector('[data-testid="site-header"]');
    const row = header.firstElementChild;
    const controls = [...header.querySelectorAll("a, button")]
      .filter((e) => getComputedStyle(e).display !== "none" && e.getClientRects().length)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return {
          label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 28),
          L: Math.round(r.left),
          R: Math.round(r.right),
          w: Math.round(r.width),
        };
      })
      .filter((c) => c.w > 0);
    const outOfView = controls.filter((c) => c.L < 0 || c.R > vw);
    const sorted = [...controls].sort((a, b) => a.L - b.L);
    const overlaps = [];
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].L < sorted[i - 1].R - 1) overlaps.push(`${sorted[i - 1].label}|${sorted[i].label}`);
    const contact = [...header.querySelectorAll('a[href^="tel:"], a[href^="viber:"]')].map((a) => ({
      kind: `${a.getAttribute("href").startsWith("tel") ? "phone" : "viber"}-${a.getAttribute("aria-label") ? "icon" : "text"}`,
      display: getComputedStyle(a).display,
    }));
    const acct = header.querySelector('[data-testid="account-button"]');
    const menu = header.querySelector('[data-testid="mobile-menu-trigger"]');
    const mr = menu && getComputedStyle(menu).display !== "none" ? menu.getBoundingClientRect() : null;
    return {
      vw,
      docScrollW: document.documentElement.scrollWidth,
      rowScrollW: row.scrollWidth,
      rowClientW: row.clientWidth,
      menu: mr ? `${Math.round(mr.left)}-${Math.round(mr.right)}` : "hidden",
      account: acct ? getComputedStyle(acct).display : null,
      contact,
      controls: controls.map((c) => `${c.label}[${c.L}-${c.R}]`),
      outOfView: outOfView.map((c) => c.label),
      overlaps,
    };
  });

async function mechanicContext(browser, state, opts) {
  const ctx = await newContext(browser, opts);
  await ctx.addCookies(state.cookies);
  await ctx.addInitScript((origins) => {
    const o = origins.find((x) => x.origin === location.origin);
    if (o) for (const { name, value } of o.localStorage) localStorage.setItem(name, value);
  }, state.origins);
  return ctx;
}

const out = { injected: anchors.length, runs: {} };
const errors = [];
const browser = await launch();
try {
  let mechState;
  {
    const ctx = await newContext(browser, { width: 1280, height: 800, tag: "r2v03-login" });
    const page = await ctx.newPage();
    await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    mechState = await ctx.storageState();
    await ctx.close();
  }
  const run = async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const m = await runOnce(...args);
        if (attempt > 1) m.attempts = attempt;
        writeFileSync(`${DIR}/vis03-header.json`, JSON.stringify(out, null, 2));
        return m;
      } catch (e) {
        if (attempt >= 3) return { error: String(e).slice(0, 200) };
      }
    }
  };
  const runOnce = async (role, route, width, sim, shotName) => {
    const mobile = width < 1024;
    const opts = { width, height: mobile ? 800 : 900, tag: `r2v03-${role}-${width}` };
    const ctx = role === "mechanic" ? await mechanicContext(browser, mechState, opts) : await newContext(browser, opts);
    try {
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" }).catch(() => {});
    if (role === "mechanic")
      await page.waitForSelector('header [data-testid="account-button"][data-mechanic]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    if (sim) await inject(page);
    await page.waitForTimeout(150);
    const m = await measure(page);
    if (role === "mechanic")
      m.mechanicViewer = (await page.locator('header [data-testid="account-button"][data-mechanic]').count()) === 1;
    m.url = new URL(page.url()).pathname;
    if (shotName) await shot(page, `../fix/shell-perf/verify/r2/${shotName}`, { clip: { x: 0, y: 0, width, height: 64 } });
    errors.push(
      ...log.console.map((e) => `${role} ${route} ${width}: ${e}`),
      ...log.pageErrors.map((e) => `${role} ${route} ${width}: ${e}`),
    );
    return m;
    } finally {
      await ctx.close();
    }
  };
  for (const w of WIDTHS) {
    const shotW = [320, 360, 390, 480, 1024, 1280, 1440].includes(w);
    out.runs[`guest-sim /delovi/kocioni-diskovi ${w}`] = await run("guest", "/delovi/kocioni-diskovi", w, true, shotW ? `header-guest-sim-${w}` : null);
    out.runs[`mechanic-sim /delovi ${w}`] = await run("mechanic", "/delovi", w, true, shotW ? `header-mechanic-sim-${w}` : null);
  }
  for (const w of [320, 360, 390]) {
    for (const route of ["/", "/korpa", "/majstor", "/majstor/cenovnik"])
      out.runs[`mechanic-real ${route} ${w}`] = await run("mechanic", route, w, false, null);
    for (const route of ["/", "/korpa", "/nalog", "/upit"])
      out.runs[`guest-real ${route} ${w}`] = await run("guest", route, w, false, null);
  }
  for (const role of ["guest", "mechanic"]) {
    const opts = { width: 360, height: 780, tag: `r2v03-kb-${role}` };
    const ctx = role === "mechanic" ? await mechanicContext(browser, mechState, opts) : await newContext(browser, opts);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" }).catch(() => {});
    if (role === "mechanic")
      await page.waitForSelector('header [data-testid="account-button"][data-mechanic]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await inject(page);
    const order = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      order.push(
        await page.evaluate(() => {
          const e = document.activeElement;
          const r = e.getBoundingClientRect();
          return `${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}[${Math.round(r.left)}-${Math.round(r.right)}]`;
        }),
      );
    }
    await page.getByTestId("mobile-menu-trigger").click();
    await page.getByRole("dialog").waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    const menu = await page.evaluate(() =>
      [...document.querySelectorAll('[role="dialog"] a')].map((a) => a.textContent.trim().slice(0, 30)),
    );
    await shot(page, `../fix/shell-perf/verify/r2/menu-${role}-360`);
    out[`keyboard-and-menu-${role}-360`] = { tabOrder: order, menuLinks: menu };
    await ctx.close();
  }
} finally {
  await browser.close();
}
out.errors = errors;
const fails = Object.entries(out.runs).filter(
  ([, m]) => m.error || m.docScrollW > m.vw || m.rowScrollW > m.rowClientW || m.outOfView.length || m.overlaps.length,
);
out.summary = {
  runs: Object.keys(out.runs).length,
  failing: fails.map(
    ([k, m]) => `${k}: doc ${m.docScrollW}/${m.vw} row ${m.rowScrollW}/${m.rowClientW} out ${m.outOfView} overlaps ${m.overlaps}`,
  ),
};
writeFileSync(`${DIR}/vis03-header.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary, null, 1));
