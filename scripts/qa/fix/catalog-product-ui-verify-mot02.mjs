// Independent re-verification of MOT-02 (step 22, package catalog-product-ui): the mobile sticky
// buy bar on /deo/[slug]. Checks the slide/fade traces frame by frame, rapid toggles, reload while
// scrolled, keyboard reachability + focus-not-obscured, desktop widths, client navigation to a
// related product, the consent-banner combination, the text-reveal contract and console errors.
// Evidence: docs/qa/fix/catalog-product-ui/verify/mot02-verify.json + screenshots.
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE as KIT_BASE, launch, newContext, revealCheck, scrollThrough, shot, watch } from "../audit/kit.mjs";

const BASE = process.env.AUDIT_BASE ?? KIT_BASE;
const OUT_DIR = "docs/qa/fix/catalog-product-ui/verify";
const SHOT = "../fix/catalog-product-ui/verify";
mkdirSync(OUT_DIR, { recursive: true });

const PRODUCTS = ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/deo/kocioni-disk-prednji-340-30-mm-gti-demo-0005"];
const SEL = '[data-testid="sticky-buy-bar"]';
const out = { base: BASE, runs: [] };
// CHECKS=trace,keyboard,… runs a subset (OUT_SUFFIX names the JSON so earlier runs are kept).
const CHECKS = process.env.CHECKS ? process.env.CHECKS.split(",") : null;
const want = (c) => !CHECKS || CHECKS.includes(c);
const SUFFIX = process.env.OUT_SUFFIX ? `-${process.env.OUT_SUFFIX}` : "";

async function state(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { bar: null };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const btn = el.querySelector("button");
    let topmostIsButton = null;
    if (btn && cs.visibility === "visible" && cs.display !== "none") {
      const b = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      topmostIsButton = !!hit && (hit === btn || btn.contains(hit));
    }
    return {
      scrollY: Math.round(scrollY),
      vh: innerHeight,
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      height: +r.height.toFixed(1),
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      transform: cs.transform,
      inert: el.inert,
      ariaHidden: el.getAttribute("aria-hidden"),
      inlineStyle: el.getAttribute("style"),
      scrollPaddingBottom: document.documentElement.style.scrollPaddingBottom || null,
      buttonLabel: btn?.getAttribute("aria-label") ?? null,
      topmostIsButton,
    };
  }, SEL);
}

/** Scrolls instantly to y inside the page and samples the bar every frame for `ms`. */
async function trace(page, y, ms = 900) {
  return page.evaluate(
    async ({ sel, y, ms }) => {
      const el = document.querySelector(sel);
      const frames = [];
      const t0 = performance.now();
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((resolve) => {
        const tick = () => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          frames.push({ t: Math.round(performance.now() - t0), top: +r.top.toFixed(1), op: +(+cs.opacity).toFixed(2), vis: cs.visibility });
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return frames;
    },
    { sel: SEL, y, ms },
  );
}

function summarize(frames, restingTop) {
  const visible = frames.filter((f) => f.vis === "visible");
  const tops = [...new Set(visible.map((f) => f.top))];
  const firstVisible = visible[0] ?? null;
  const settled = frames.find((f, i) => f.vis === "visible" && f.top === restingTop && f.op === 1 && frames.slice(i).every((g) => g.top === restingTop && g.op === 1));
  const ops = [...new Set(visible.map((f) => f.op))];
  const last = frames.at(-1);
  return {
    firstVisibleAt: firstVisible?.t ?? null,
    firstVisibleTop: firstVisible?.top ?? null,
    firstVisibleOpacity: firstVisible?.op ?? null,
    settledAt: settled?.t ?? null,
    distinctVisibleTops: tops.length,
    distinctVisibleOpacities: ops.length,
    minVisibleOpacity: visible.length ? Math.min(...visible.map((f) => f.op)) : null,
    last,
  };
}

async function keyboardWalk(page, steps = 45) {
  // Start focus at the first focusable element after #buy-box that is on screen (no scroll).
  const started = await page.evaluate(() => {
    const box = document.getElementById("buy-box");
    const all = [...document.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")];
    const cand = all.find(
      (e) =>
        box.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !box.contains(e) &&
        !e.closest("[inert]") &&
        e.getBoundingClientRect().top > 100 &&
        e.getBoundingClientRect().bottom < innerHeight - 120,
    );
    if (!cand) return null;
    cand.focus({ preventScroll: true });
    return cand.textContent.trim().slice(0, 40) || cand.getAttribute("aria-label");
  });
  const log = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(90);
    log.push(
      await page.evaluate((sel) => {
        const bar = document.querySelector(sel);
        const a = document.activeElement;
        const r = a.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const barShown = getComputedStyle(bar).visibility === "visible" && !bar.inert;
        const inBar = bar.contains(a);
        const obscured = barShown && !inBar && r.height > 0 && r.bottom > b.top + 0.5 && r.top < b.bottom;
        return {
          tag: a.tagName,
          label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          barTop: Math.round(b.top),
          barShown,
          inBar,
          inInertBar: inBar && bar.inert,
          obscured,
          offscreen: r.height > 0 && (r.top >= innerHeight || r.bottom <= 0),
        };
      }, SEL),
    );
  }
  return {
    started,
    steps: log.length,
    obscured: log.filter((s) => s.obscured),
    offscreen: log.filter((s) => s.offscreen && !s.inBar),
    reachedBar: log.some((s) => s.inBar && !s.inInertBar),
    focusInInertBar: log.filter((s) => s.inInertBar),
    sample: log,
  };
}

async function withPage(browser, opts, fn) {
  const ctx = await newContext(browser, opts);
  const page = await ctx.newPage();
  const w = watch(page);
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "warning" && /hydrat|did not match|gsap|Invalid property/i.test(m.text())) warnings.push(m.text().slice(0, 300));
  });
  try {
    return { ...(await fn(page)), console: w.console, pageErrors: w.pageErrors, warnings };
  } catch (e) {
    return { error: String(e), console: w.console, pageErrors: w.pageErrors, warnings };
  } finally {
    await ctx.close();
  }
}

async function open(page, route) {
  await page.goto(BASE + route, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(2500);
}

async function pastY(page) {
  return page.evaluate(() => Math.ceil(document.getElementById("buy-box").getBoundingClientRect().bottom + scrollY) + 300);
}

const browser = await launch("chromium");
try {
  if (want("trace")) {
  // A + B: frame traces, normal and reduced motion, at 390 and 360.
  for (const [tag, width, height, reducedMotion] of [
    ["390", 390, 844, "no-preference"],
    ["390-reduced", 390, 844, "reduce"],
    ["360", 360, 780, "no-preference"],
    ["360-reduced", 360, 780, "reduce"],
  ]) {
    out.runs.push({
      check: "trace",
      tag,
      ...(await withPage(browser, { width, height, reducedMotion, tag: `v-mot02-${tag}` }, async (page) => {
        await open(page, PRODUCTS[0]);
        const initial = await state(page);
        const y = await pastY(page);
        const showFrames = await trace(page, y);
        const shown = await state(page);
        await shot(page, `${SHOT}/mot02-${tag}-shown`);
        const hideFrames = await trace(page, 0);
        const hidden = await state(page);
        const resting = +(height - shown.height).toFixed(1);
        return {
          initial,
          shown,
          hidden,
          show: summarize(showFrames, resting),
          hide: { last: hideFrames.at(-1), hiddenAt: hideFrames.find((f) => f.vis === "hidden")?.t ?? null, distinctTops: new Set(hideFrames.map((f) => f.top)).size, minOp: Math.min(...hideFrames.map((f) => f.op)) },
          showFrames,
          hideFrames,
        };
      })),
    });
  }

  }
  if (want("rapid-toggle")) {
  // C: rapid toggles (interrupt the tweens), normal + reduced.
  for (const reducedMotion of ["no-preference", "reduce"]) {
    out.runs.push({
      check: "rapid-toggle",
      reducedMotion,
      ...(await withPage(browser, { width: 390, height: 844, reducedMotion, tag: `v-mot02-rapid-${reducedMotion}` }, async (page) => {
        await open(page, PRODUCTS[0]);
        const y = await pastY(page);
        const go = (to) => page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), to);
        await go(y); await page.waitForTimeout(80);
        await go(0); await page.waitForTimeout(80);
        await go(y); await page.waitForTimeout(1200);
        const endShown = await state(page);
        await go(0); await page.waitForTimeout(60);
        await go(y); await page.waitForTimeout(60);
        await go(0); await page.waitForTimeout(1200);
        const endHidden = await state(page);
        // Many fast flips.
        for (let i = 0; i < 8; i++) { await go(i % 2 ? 0 : y); await page.waitForTimeout(30 + i * 15); }
        await go(y); await page.waitForTimeout(1200);
        const endShown2 = await state(page);
        return { endShown, endHidden, endShown2 };
      })),
    });
  }

  }
  if (want("reload-scrolled")) {
  // D: reload while scrolled past (scroll restoration), and direct load at an anchor below the box.
  out.runs.push({
    check: "reload-scrolled",
    ...(await withPage(browser, { width: 390, height: 844, tag: "v-mot02-reload" }, async (page) => {
      await open(page, PRODUCTS[0]);
      const y = await pastY(page);
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
      await page.waitForTimeout(800);
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(3000);
      const afterReload = await state(page);
      await page.goto(BASE + PRODUCTS[0] + "#related-title", { waitUntil: "load" });
      await page.waitForTimeout(3000);
      const afterAnchorLoad = await state(page);
      return { afterReload, afterAnchorLoad };
    })),
  });

  }
  if (want("keyboard")) {
  // E: keyboard — focus never obscured by the shown bar; bar controls reachable; inert when hidden.
  for (const [tag, width, height] of [["390", 390, 844], ["360", 360, 780]]) {
    out.runs.push({
      check: "keyboard",
      tag,
      ...(await withPage(browser, { width, height, tag: `v-mot02-kbd-${tag}` }, async (page) => {
        await open(page, PRODUCTS[0]);
        const hiddenWalk = await page.evaluate(() => {
          const bar = document.querySelector('[data-testid="sticky-buy-bar"]');
          const btn = bar.querySelector("button");
          btn.focus();
          return { focusLandedInHiddenBar: bar.contains(document.activeElement), inert: bar.inert };
        });
        const y = await pastY(page);
        await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
        await page.waitForTimeout(900);
        const walk = await keyboardWalk(page);
        return { hiddenWalk, walk };
      })),
    });
  }

  }
  if (want("desktop")) {
  // F + G: desktop widths never show the bar or register an inset; resize 390 → 1440 while shown.
  for (const [tag, width, height] of [["1024", 1024, 768], ["1440", 1440, 900]]) {
    out.runs.push({
      check: "desktop",
      tag,
      ...(await withPage(browser, { width, height, tag: `v-mot02-desk-${tag}` }, async (page) => {
        await open(page, PRODUCTS[0]);
        await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
        await page.waitForTimeout(900);
        return { scrolled: await state(page) };
      })),
    });
  }
  out.runs.push({
    check: "resize-while-shown",
    ...(await withPage(browser, { width: 390, height: 844, tag: "v-mot02-resize" }, async (page) => {
      await open(page, PRODUCTS[0]);
      const y = await pastY(page);
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
      await page.waitForTimeout(900);
      const shown = await state(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(900);
      const desktop = await state(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(900);
      const backMobile = await state(page);
      return { shown, desktop, backMobile };
    })),
  });

  }
  if (want("client-nav")) {
  // H: second product + client navigation to a related product while the bar is shown; add to cart.
  out.runs.push({
    check: "client-nav",
    ...(await withPage(browser, { width: 390, height: 844, tag: "v-mot02-nav" }, async (page) => {
      await open(page, PRODUCTS[1]);
      const y1 = await pastY(page);
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y1);
      await page.waitForTimeout(900);
      const p2Shown = await state(page);
      const link = page.locator('section[aria-labelledby="related-title"] a[href^="/deo/"]').first();
      const href = await link.getAttribute("href");
      await link.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const beforeClick = await state(page);
      await link.click();
      await page.waitForURL((u) => u.pathname === href, { timeout: 60_000 });
      await page.waitForTimeout(2500);
      const afterNav = await state(page);
      const y2 = await pastY(page);
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y2);
      await page.waitForTimeout(900);
      const afterNavPast = await state(page);
      await shot(page, `${SHOT}/mot02-390-clientnav-past`);
      // Add to cart from the bar: the click must reach the button and open the drawer / announce.
      await page.locator(`${SEL} button`).first().click();
      await page.waitForTimeout(2500);
      const afterAdd = await page.evaluate(() => ({
        dialog: !!document.querySelector('[role="dialog"]'),
        live: document.getElementById("cart-live")?.textContent ?? null,
      }));
      await shot(page, `${SHOT}/mot02-390-after-add`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(900);
      const afterNavTop = await state(page);
      return { p2Shown, relatedHref: href, beforeClick, afterNav, afterNavPast, afterAdd, afterNavTop };
    })),
  });

  }
  if (want("consent-banner-open")) {
  // Consent banner still open (no consent cookie): both bottom elements coexist.
  out.runs.push({
    check: "consent-banner-open",
    ...(await withPage(browser, { width: 390, height: 844, consent: false, tag: "v-mot02-consent" }, async (page) => {
      await open(page, PRODUCTS[0]);
      const y = await pastY(page);
      await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
      await page.waitForTimeout(1200);
      await shot(page, `${SHOT}/mot02-390-consent-open-past`);
      return { past: await state(page) };
    })),
  });

  }
  if (want("reveal-contract")) {
  // Text-reveal contract after a full scroll-through at 390 (bar has data-reveal="off").
  out.runs.push({
    check: "reveal-contract",
    ...(await withPage(browser, { width: 390, height: 844, tag: "v-mot02-reveal" }, async (page) => {
      await open(page, PRODUCTS[0]);
      await scrollThrough(page);
      return { reveal: await revealCheck(page), end: await state(page) };
    })),
  });
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT_DIR}/mot02-verify${SUFFIX}.json`, JSON.stringify(out, null, 2));
const brief = out.runs.map((r) => {
  const { walk, ...rest } = r;
  delete rest.showFrames;
  delete rest.hideFrames;
  return walk ?{ ...rest, walk: { started: walk.started, obscured: walk.obscured, offscreen: walk.offscreen, reachedBar: walk.reachedBar, focusInInertBar: walk.focusInInertBar } } : rest;
});
console.log(JSON.stringify(brief, null, 1));
