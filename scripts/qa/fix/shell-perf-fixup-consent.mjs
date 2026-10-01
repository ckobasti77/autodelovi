// Step 22 fix-up · PERF-01: first-visit consent banner off the hydration path (ConsentGate).
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/shell-perf-fixup-consent.mjs
// Output: docs/qa/fix/shell-perf/fixup/consent.json
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/shell-perf/fixup";
mkdirSync(OUT, { recursive: true });
const ROUTE = "/delovi/kocioni-diskovi";
const DEF = (p) => `${p} [app-client] (ecmascript)", ((__turbopack_context__)`;
const MODS = {
  ConsentBanner: "components/consent/ConsentBanner.tsx",
  ConsentPanel: "components/consent/ConsentPanel.tsx",
  ConsentGate: "components/consent/ConsentGate.tsx",
  ConsentDetails: "components/consent/ConsentDetails.tsx",
};
const BANNER = "[data-testid='consent-banner']";

/** Records which modules each script defines, and whether the server HTML references it. */
function trackModules(page) {
  const bodies = [];
  let html = "";
  page.on("response", (res) => {
    const type = res.request().resourceType();
    if (type === "document") res.text().then((t) => (html = t)).catch(() => {});
    if (type === "script") {
      const at = Date.now();
      bodies.push(res.text().then((t) => ({ url: res.url(), t, at })).catch(() => ({ url: res.url(), t: "", at })));
    }
  });
  return async (loadAt) => {
    const rows = {};
    for (const { url, t, at } of await Promise.all(bodies)) {
      const file = url.split("/_next/")[1] ?? url;
      for (const [name, p] of Object.entries(MODS)) {
        if (t.includes(DEF(p))) (rows[name] ??= []).push({ chunk: file, inServerHtml: html.includes(file), msAfterLoad: loadAt ? at - loadAt : null });
      }
    }
    return rows;
  };
}

/** Holds every script requested after `load` for `ms` (keeps the banner chunk in flight). */
async function delayLateScripts(page, ms) {
  let loaded = false;
  page.on("load", () => (loaded = true));
  await page.route("**/*", async (route) => {
    if (loaded && route.request().resourceType() === "script") await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

const cookieOf = async (ctx) => {
  const c = (await ctx.cookies()).find((x) => x.name === "sk_consent");
  return c ? JSON.parse(decodeURIComponent(c.value)) : null;
};
const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el && el !== document.body
      ? { key: el.getAttribute("data-consent-key"), role: el.getAttribute("role"), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), staticNode: el.__fixupStatic === true }
      : "BODY";
  });

const out = {};
const browser = await launch();
try {
  // 1 · First visit, 390: static panel at first paint; the banner module arrives after load.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "fxc1" });
    const page = await ctx.newPage();
    const log = watch(page);
    const modules = trackModules(page);
    let loadAt = 0;
    page.on("load", () => (loadAt = Date.now()));
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3500);
    const before = await page.locator(BANNER).count();
    const firstLoad = await modules(loadAt);
    await scrollThrough(page);
    const reveal = await revealCheck(page);
    await shot(page, "../fix/shell-perf/fixup/consent-first-390");
    await page.locator(BANNER).getByRole("button", { name: "Prihvati sve" }).click();
    await page.locator(BANNER).waitFor({ state: "hidden", timeout: 10000 });
    out.firstVisitIdle = { bannerAtLoad: before, modules: firstLoad, reveal, cookie: await cookieOf(ctx), errors: [...log.console, ...log.pageErrors] };
    await ctx.close();
  }

  // 2 · First visit: a click on the static panel before the banner chunk arrives is held and
  // replayed (no form post, no reload).
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "fxc2" });
    const page = await ctx.newPage();
    const log = watch(page);
    await delayLateScripts(page, 3000);
    let navigations = 0;
    page.on("framenavigated", (f) => f === page.mainFrame() && navigations++);
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "load" });
    await page.waitForFunction(() => document.querySelector("[data-testid='header-search-trigger'], [data-testid='site-header'] button"));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.__fixupMarker = true;
      document.querySelectorAll("[data-testid='consent-banner'] *").forEach((el) => (el.__fixupStatic = true));
    });
    const t0 = Date.now();
    await page.locator(BANNER).getByRole("button", { name: "Odbij sve" }).click();
    const stillThereRightAfter = await page.locator(BANNER).count();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector("[data-testid='consent-banner']") || getComputedStyle(document.querySelector("[data-testid='consent-banner']")).opacity === "0", null, { timeout: 15000 }).catch(() => {});
    out.heldClick = {
      stillThereRightAfter,
      bannerGoneAfterMs: Date.now() - t0,
      sameDocument: await page.evaluate(() => window.__fixupMarker === true),
      navigations,
      cookie: await cookieOf(ctx),
      errors: [...log.console, ...log.pageErrors],
    };
    await ctx.close();
  }

  // 3 · First visit, keyboard: focus inside the static panel survives the swap; Enter on
  // „Podešavanja“ then moves focus to the first switch (A11Y-06).
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, consent: false, tag: "fxc3" });
    const page = await ctx.newPage();
    const log = watch(page);
    await delayLateScripts(page, 2000);
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "load" });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelectorAll("[data-testid='consent-banner'] *").forEach((el) => (el.__fixupStatic = true)));
    await page.locator(`${BANNER} [data-consent-key='settings']`).focus();
    const focusedStatic = await active(page);
    await page.waitForFunction(() => document.activeElement && document.activeElement.__fixupStatic !== true && document.activeElement.getAttribute("data-consent-key") === "settings", null, { timeout: 15000 }).catch(() => {});
    const focusedAfterSwap = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "switch", null, { timeout: 15000 }).catch(() => {});
    const afterSettings = await active(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const collapsed = await page.locator(BANNER).getAttribute("data-collapsed");
    out.keyboard = { focusedStatic, focusedAfterSwap, afterSettings, collapsedAfterEscape: collapsed !== null, errors: [...log.console, ...log.pageErrors] };
    await ctx.close();
  }

  // 4 · First visit: Escape pressed before the swap collapses the live banner.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "fxc4" });
    const page = await ctx.newPage();
    const log = watch(page);
    await delayLateScripts(page, 2000);
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "load" });
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    await page.waitForSelector(`${BANNER}[data-collapsed]`, { timeout: 15000 }).catch(() => {});
    out.earlyEscape = { collapsed: (await page.locator(`${BANNER}[data-collapsed]`).count()) === 1, errors: [...log.console, ...log.pageErrors] };
    await ctx.close();
  }

  // 5 · Returning visitor: nothing of the banner in the first load; the footer reopens it.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: true, tag: "fxc5" });
    const page = await ctx.newPage();
    const log = watch(page);
    const modules = trackModules(page);
    let loadAt = 0;
    page.on("load", () => (loadAt = Date.now()));
    await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const bannerInDom = await page.locator(BANNER).count();
    const firstLoad = await modules(loadAt);
    const reopen = page.getByRole("button", { name: "Podešavanja kolačića" });
    await reopen.scrollIntoViewIfNeeded();
    await reopen.click();
    await page.locator(BANNER).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => document.activeElement?.closest("[data-testid='consent-banner']"), null, { timeout: 15000 }).catch(() => {});
    const focus = await active(page);
    await shot(page, "../fix/shell-perf/fixup/consent-reopen-390");
    await page.locator(BANNER).getByRole("button", { name: "Sačuvaj izbor" }).click();
    await page.locator(BANNER).waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    out.returning = { bannerInDom, modulesBeforeReopen: firstLoad, focusOnReopen: focus, hiddenAfterSave: (await page.locator(BANNER).isVisible()) === false, errors: [...log.console, ...log.pageErrors] };
    await ctx.close();
  }

  // 6 · No JavaScript: the static panel posts the decision.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${ROUTE}`);
    await page.locator(BANNER).getByRole("button", { name: "Prihvati sve" }).click();
    await page.waitForLoadState("load");
    out.noJs = { cookie: await cookieOf(ctx), bannerAfterPost: await page.locator(BANNER).count() };
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/consent.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
