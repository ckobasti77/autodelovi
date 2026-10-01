// Step 22 shell-perf verify round 2 · PERF-01 (D250 consent fix-up), independent of the
// implementer's script. Checks: first-visit banner in the server HTML and not in the first-load
// client modules; when the interactive banner chunk is requested relative to hydration; the swap
// (no layout shift, no opacity dip, same look); held click / tap / early Escape / keyboard focus
// across the swap; chunk failure; returning visitor; no JS; reduced motion; reveal contract;
// console errors (hydration warnings included).
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/perf01-consent.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, shot } from "../../../../../../scripts/qa/audit/kit.mjs";

const DIR = "docs/qa/fix/shell-perf/verify/r2";
const BANNER = "[data-testid='consent-banner']";
const DEF = (p) => `[project]/${p} [app-client] (ecmascript)", ((__turbopack_context__`;
const MODS = {
  ConsentBanner: "components/consent/ConsentBanner.tsx",
  ConsentPanel: "components/consent/ConsentPanel.tsx",
  ConsentDetails: "components/consent/ConsentDetails.tsx",
  ConsentGate: "components/consent/ConsentGate.tsx",
};
const ROUTES = [
  "/delovi/kocioni-diskovi",
  "/",
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/upit",
  "/ponuda/kocione-plocice-golf",
];

const PROBE = () => {
  const r2 = (window.__r2 = { banners: [], shifts: [], minOpacity: 1, rects: [], hydratedAt: null });
  // Hydration marker: React attaches its fiber to the server header node when it hydrates it
  // (window.__NEXT_HYDRATED exists only in Next's test mode).
  const hyd = setInterval(() => {
    const h = document.querySelector("[data-testid='site-header']") || document.querySelector("main");
    if (h && Object.keys(h).some((k) => k.startsWith("__reactFiber"))) {
      r2.hydratedAt = Math.round(performance.now());
      clearInterval(hyd);
    }
  }, 10);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        r2.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  const mark = () => {
    const b = document.querySelector("[data-testid='consent-banner']");
    if (b && !b.__r2seen) {
      b.__r2seen = true;
      r2.banners.push({ t: Math.round(performance.now()), hydrated: r2.hydratedAt !== null });
    }
  };
  const start = () => {
    mark();
    new MutationObserver(mark).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  const t0 = performance.now();
  let last = "";
  const tick = () => {
    const b = document.querySelector("[data-testid='consent-banner']");
    const f = b?.querySelector("form");
    if (b && f) {
      const r = f.getBoundingClientRect();
      r2.minOpacity = Math.min(r2.minOpacity, parseFloat(getComputedStyle(b).opacity));
      const key = `${Math.round(r.top)}/${Math.round(r.height)}`;
      if (key !== last) {
        last = key;
        r2.rects.push({ t: Math.round(performance.now()), rect: key });
      }
    }
    if (performance.now() - t0 < 9000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/** Tracks which response defines which module, and holds/aborts the banner chunk if asked. */
async function instrument(page, { delayBannerMs = 0, abortBanner = false, delayAllScriptsMs = 0 } = {}) {
  const defined = {};
  let html = "";
  const bannerChunk = { url: null };
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (delayAllScriptsMs) await new Promise((r) => setTimeout(r, delayAllScriptsMs));
    let res;
    try {
      res = await route.fetch();
    } catch {
      return route.abort().catch(() => {});
    }
    const body = await res.text();
    const file = route.request().url().split("/_next/")[1];
    for (const [name, p] of Object.entries(MODS)) if (body.includes(DEF(p))) (defined[name] ??= []).push(file);
    if (body.includes(DEF(MODS.ConsentBanner))) {
      bannerChunk.url = route.request().url();
      if (abortBanner) return route.abort("failed");
      if (delayBannerMs) await new Promise((r) => setTimeout(r, delayBannerMs));
    }
    await route.fulfill({ response: res, body });
  });
  page.on("response", (res) => {
    if (res.request().resourceType() === "document") res.text().then((t) => (html = t)).catch(() => {});
  });
  await page.addInitScript(PROBE);
  return {
    async report() {
      const timing = await page.evaluate((url) => {
        const e = url ? performance.getEntriesByName(url)[0] : null;
        return {
          hydratedAt: window.__r2.hydratedAt,
          loadAt: Math.round(performance.getEntriesByType("navigation")[0]?.loadEventStart ?? -1),
          bannerChunkRequestedAt: e ? Math.round(e.startTime) : null,
          banners: window.__r2.banners,
          shifts: window.__r2.shifts,
          minOpacity: window.__r2.minOpacity,
          rects: window.__r2.rects,
        };
      }, bannerChunk.url);
      const htmlChunks = [...html.matchAll(/<script src="\/_next\/([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
      const inHtml = Object.fromEntries(
        Object.entries(defined).map(([k, files]) => [k, files.map((f) => ({ f, inHtml: htmlChunks.includes(decodeURIComponent(f)) }))]),
      );
      return { bannerInServerHtml: html.includes('data-testid="consent-banner"'), modules: inHtml, ...timing };
    },
  };
}

const cookieOf = async (ctx) => {
  const c = (await ctx.cookies()).find((x) => x.name === "sk_consent");
  return c ? JSON.parse(decodeURIComponent(c.value)) : null;
};
const hydrated = (page) => page.waitForFunction(() => window.__r2 && window.__r2.hydratedAt !== null, null, { timeout: 60000 });
const focused = (page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return "BODY";
    return {
      key: e.getAttribute("data-consent-key"),
      role: e.getAttribute("role"),
      text: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30),
      inBanner: !!e.closest("[data-testid='consent-banner']"),
      staticNode: e.__r2static === true,
      focusVisible: e.matches(":focus-visible"),
    };
  });
const markStatic = (page) =>
  page.evaluate(() => document.querySelectorAll("[data-testid='consent-banner'], [data-testid='consent-banner'] *").forEach((el) => (el.__r2static = true)));
const isStatic = (page) => page.evaluate(() => document.querySelector("[data-testid='consent-banner']")?.__r2static === true);
const errs = (log) => [...log.console, ...log.pageErrors];

const out = {};
const browser = await launch();
try {
  // 1 · First visit on every listed template (390) + 1440 on the category: idle swap.
  out.firstVisit = {};
  for (const [route, width] of [...ROUTES.map((r) => [r, 390]), ["/delovi/kocioni-diskovi", 1440]]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, consent: false, tag: `r2p1-${width}` });
    try {
    const page = await ctx.newPage();
    const log = watch(page);
    const probe = await instrument(page);
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(5000);
    const rep = await probe.report();
    const liveAfterIdle = rep.banners.length >= 2 && (await page.locator(BANNER).count()) === 1;
    await scrollThrough(page);
    const reveal = await revealCheck(page);
    if (route === "/delovi/kocioni-diskovi") await shot(page, `../fix/shell-perf/verify/r2/consent-first-${width}`);
    await page.locator(BANNER).getByRole("button", { name: "Prihvati sve" }).click();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    out.firstVisit[`${route} ${width}`] = {
      ...rep,
      swapAfterHydrationMs: rep.banners[1] ? rep.banners[1].t - rep.hydratedAt : null,
      liveAfterIdle,
      reveal,
      bannerAfterAccept: await page.locator(BANNER).count(),
      cookie: await cookieOf(ctx),
      errors: errs(log),
    };
    } catch (e) {
      out.firstVisit[`${route} ${width}`] = { error: String(e).slice(0, 300) };
    } finally {
      await ctx.close();
    }
  }

  // 2 · Static vs live look: screenshot the static panel (chunk held), then the live one.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "r2p1-look" });
    const page = await ctx.newPage();
    await instrument(page, { delayBannerMs: 4000 });
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(600);
    await markStatic(page);
    const a = await page.locator(BANNER).screenshot({ type: "png" });
    await page.waitForFunction(() => document.querySelector("[data-testid='consent-banner']")?.__r2static !== true, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const b = await page.locator(BANNER).screenshot({ type: "png" });
    const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
    let diff = 0;
    const same = ra.info.width === rb.info.width && ra.info.height === rb.info.height;
    if (same) for (let i = 0; i < ra.data.length; i++) if (Math.abs(ra.data[i] - rb.data[i]) > 8) diff++;
    await sharp(a).webp({ quality: 80 }).toFile(`${DIR}/consent-static-390.webp`);
    await sharp(b).webp({ quality: 80 }).toFile(`${DIR}/consent-live-390.webp`);
    out.look = { static: `${ra.info.width}x${ra.info.height}`, live: `${rb.info.width}x${rb.info.height}`, sameSize: same, differingChannelValues: diff };
    await ctx.close();
  }

  // 3 · Held click (mouse) and held tap (touch) while the banner chunk is held 3 s.
  for (const mode of ["click", "tap"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: `r2p1-held-${mode}` });
    const page = await ctx.newPage();
    const log = watch(page);
    const probe = await instrument(page, { delayBannerMs: 3000 });
    const posts = [];
    page.on("request", (r) => r.method() === "POST" && posts.push({ url: r.url().replace(BASE, ""), action: !!r.headers()["next-action"], doc: r.resourceType() === "document", at: Date.now() }));
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(300);
    await markStatic(page);
    await page.evaluate(() => (window.__r2doc = true));
    const btn = page.locator(BANNER).getByRole("button", { name: mode === "click" ? "Odbij sve" : "Prihvati sve" });
    const t0 = Date.now();
    if (mode === "click") await btn.click();
    else await btn.tap();
    await page.waitForTimeout(150);
    const rightAfter = { banner: await page.locator(BANNER).count(), static: await isStatic(page), postsSoFar: posts.length, cookie: await cookieOf(ctx) };
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    const rep = await probe.report();
    out[`held-${mode}`] = {
      rightAfter,
      bannerGoneAfterMs: Date.now() - t0,
      bannerNow: await page.locator(BANNER).count(),
      sameDocument: await page.evaluate(() => window.__r2doc === true),
      posts: posts.map((p) => ({ ...p, at: p.at - t0 })),
      cookie: await cookieOf(ctx),
      bannerChunkRequestedAt: rep.bannerChunkRequestedAt,
      hydratedAt: rep.hydratedAt,
      errors: errs(log),
    };
    await ctx.close();
  }

  // 4 · Keyboard from the top of the page (1440): Tab into the static panel, swap keeps focus,
  // Enter on „Podešavanja“ → first switch, Escape collapses, Tab still reaches the decisions.
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, consent: false, tag: "r2p1-kb" });
    const page = await ctx.newPage();
    const log = watch(page);
    await instrument(page, { delayBannerMs: 2500 });
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(300);
    await markStatic(page);
    const path = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const f = await focused(page);
      path.push(f);
      if (f !== "BODY" && f.key === "settings") break;
    }
    await page.waitForFunction(() => document.querySelector("[data-testid='consent-banner']")?.__r2static !== true, null, { timeout: 20000 });
    await page.waitForTimeout(200);
    const afterSwap = await focused(page);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "switch", null, { timeout: 15000 }).catch(() => {});
    const afterSettings = await focused(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const collapsed = (await page.locator(`${BANNER}[data-collapsed]`).count()) === 1;
    const tabs = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      tabs.push(await focused(page));
    }
    out.keyboard = { path, afterSwap, afterSettings, collapsedAfterEscape: collapsed, tabsAfterCollapse: tabs, errors: errs(log) };
    await ctx.close();
  }

  // 5 · Escape before the swap (390).
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "r2p1-esc" });
    const page = await ctx.newPage();
    const log = watch(page);
    await instrument(page, { delayBannerMs: 2500 });
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(300);
    await markStatic(page);
    await page.keyboard.press("Escape");
    const collapsedBeforeSwap = (await page.locator(`${BANNER}[data-collapsed]`).count()) === 1;
    await page.waitForFunction(() => document.querySelector("[data-testid='consent-banner']")?.__r2static !== true, null, { timeout: 20000 });
    await page.waitForTimeout(400);
    out.earlyEscape = { collapsedBeforeSwap, collapsedAfterSwap: (await page.locator(`${BANNER}[data-collapsed]`).count()) === 1, errors: errs(log) };
    await ctx.close();
  }

  // 6 · Banner chunk fails: the static panel must still record a decision.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "r2p1-fail" });
    const page = await ctx.newPage();
    const log = watch(page);
    await instrument(page, { abortBanner: true });
    const posts = [];
    page.on("request", (r) => r.method() === "POST" && posts.push({ action: !!r.headers()["next-action"], doc: r.resourceType() === "document" }));
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(4500);
    await page.locator(BANNER).getByRole("button", { name: "Odbij sve" }).click();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    out.chunkFailure = { bannerAfter: await page.locator(BANNER).count(), cookie: await cookieOf(ctx), posts, errors: errs(log).filter((e) => !/ConsentBanner|Failed to load chunk|ChunkLoadError|net::ERR_FAILED/i.test(e)), allErrors: errs(log).length };
    await ctx.close();
  }

  // 7 · Returning visitor: nothing of the banner in the first load; footer reopens it.
  out.returning = {};
  for (const route of ["/delovi/kocioni-diskovi", "/"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: true, tag: "r2p1-ret" });
    const page = await ctx.newPage();
    const log = watch(page);
    const probe = await instrument(page);
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(4000);
    const rep = await probe.report();
    const bannerInDom = await page.locator(BANNER).count();
    const res = { bannerInDom, modulesBeforeReopen: rep.modules };
    if (route === "/delovi/kocioni-diskovi") {
      const reopen = page.getByRole("button", { name: "Podešavanja kolačića" });
      await reopen.scrollIntoViewIfNeeded();
      await reopen.click();
      await page.locator(BANNER).waitFor({ timeout: 20000 });
      await page.waitForFunction(() => document.activeElement?.closest("[data-testid='consent-banner']"), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);
      res.focusOnReopen = await focused(page);
      res.switches = await page.locator(`${BANNER} [role=switch]`).count();
      res.opacity = await page.locator(BANNER).evaluate((e) => getComputedStyle(e).opacity);
      await shot(page, "../fix/shell-perf/verify/r2/consent-reopen-390");
      await page.locator(`${BANNER} [role=switch]`).first().click();
      await page.locator(BANNER).getByRole("button", { name: "Sačuvaj izbor" }).click();
      await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
      res.bannerAfterSave = await page.locator(BANNER).count();
      res.cookieAfterSave = await cookieOf(ctx);
      await scrollThrough(page);
      res.reveal = await revealCheck(page);
    }
    res.errors = errs(log);
    out.returning[route] = res;
    await ctx.close();
  }

  // 8 · First-visit decision, then client navigation, reopen in the same document, reload.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "r2p1-nav" });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.addInitScript(PROBE);
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(3500);
    await page.evaluate(() => (window.__r2doc = true));
    await page.locator(BANNER).getByRole("button", { name: "Prihvati sve" }).click();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      const a = document.querySelector('footer a[href="/kontakt"]');
      a?.click();
    });
    await page.waitForURL("**/kontakt", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const afterNav = { url: new URL(page.url()).pathname, sameDocument: await page.evaluate(() => window.__r2doc === true), banner: await page.locator(BANNER).count() };
    const reopen = page.getByRole("button", { name: "Podešavanja kolačića" });
    await reopen.scrollIntoViewIfNeeded();
    await reopen.click();
    await page.locator(BANNER).waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const reopenFocus = await focused(page);
    const analyticsChecked = await page.locator(`${BANNER} [role=switch]`).first().getAttribute("aria-checked").catch(() => null);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const collapsed = (await page.locator(`${BANNER}[data-collapsed]`).count()) === 1;
    await page.locator(BANNER).getByRole("button", { name: "Odbij sve" }).click();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    const cookie = await cookieOf(ctx);
    await page.reload({ waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(1500);
    out.afterDecision = { afterNav, reopenFocus, analyticsCheckedOnReopen: analyticsChecked, collapsed, cookie, bannerAfterReload: await page.locator(BANNER).count(), errors: errs(log) };
    await ctx.close();
  }

  // 9 · Reduced motion, first visit (390): swap, decision, reveal contract.
  {
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, reducedMotion: "reduce", tag: "r2p1-rm" });
    const page = await ctx.newPage();
    const log = watch(page);
    const probe = await instrument(page);
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    await hydrated(page);
    await page.waitForTimeout(4000);
    const rep = await probe.report();
    await page.locator(BANNER).getByRole("button", { name: "Odbij sve" }).click();
    await page.locator(BANNER).waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    await scrollThrough(page);
    out.reducedMotion = { banners: rep.banners, shifts: rep.shifts, minOpacity: rep.minOpacity, bannerAfter: await page.locator(BANNER).count(), reveal: await revealCheck(page), errors: errs(log) };
    await ctx.close();
  }

  // 10 · No JavaScript: the server panel posts the decision.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/delovi/kocioni-diskovi`);
    const visible = await page.locator(BANNER).isVisible();
    await page.locator(BANNER).getByRole("button", { name: "Odbij sve" }).click();
    await page.waitForLoadState("load");
    out.noJs = { visible, cookie: await cookieOf(ctx), bannerAfterPost: await page.locator(BANNER).count() };
    await ctx.close();
  }
} finally {
  writeFileSync(`${DIR}/perf01-consent.json`, JSON.stringify(out, null, 2));
  await browser.close();
}
writeFileSync(`${DIR}/perf01-consent.json`, JSON.stringify(out, null, 2));
console.log("done");
