// verify perf-lh-07 (perf skeptic lens): functional check of the failsafe/observer race WITHOUT
// throttling or timing measurements. The boot script's 3500 ms failsafe timer is forced to fire
// at 0 ms (setTimeout wrapper in an init script), which reproduces the state "hydration finished
// after the failsafe" deterministically on any machine. Then we log every copy element that goes
// pending -> running (split + opacity 0) and whether it was visibly painted (computed opacity 1)
// before that, for (A) first load, (B) scrolling, (C) a client-side navigation.
// Control run: same steps with the real failsafe timer (hydration wins the race on this machine).
//
//   node scripts/qa/audit/verify-perf-lh-07-perfskeptic.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/perf-lh/perf-lh-07-perfskeptic.json";
const CATEGORY = "/delovi/kocioni-diskovi";

async function run(forceFailsafe) {
  const browser = await chromium.launch();
  const context = await newContext(browser, { width: 412, height: 823, tag: `perfskeptic-07-${forceFailsafe ? "forced" : "control"}` });
  const page = await context.newPage();
  await page.addInitScript((force) => {
    const log = (window.__v = { phase: "load", events: [], failsafeAtDcl: null });
    if (force) {
      const orig = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...rest) => orig(fn, ms === 3500 ? 0 : ms, ...rest);
    }
    const seen = new Map();
    const label = (el) => `${el.tagName.toLowerCase()}: ${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48)}`;
    document.addEventListener("DOMContentLoaded", () => {
      log.failsafeAtDcl = document.documentElement.classList.contains("tr-failsafe");
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.attributeName !== "data-reveal-state") continue;
          const el = m.target;
          const state = el.getAttribute("data-reveal-state");
          const now = Math.round(performance.now());
          if (state === "pending") {
            const r = el.getBoundingClientRect();
            seen.set(el, { pendingAt: now, opacityWhilePending: getComputedStyle(el).opacity, inViewport: r.bottom > 0 && r.top < innerHeight });
          } else if (state === "running") {
            const p = seen.get(el);
            const r = el.getBoundingClientRect();
            log.events.push({
              phase: log.phase,
              el: label(el),
              pendingAt: p?.pendingAt ?? null,
              runningAt: now,
              visibleMsBeforeHide: p && p.opacityWhilePending === "1" ? now - p.pendingAt : 0,
              opacityWhilePending: p?.opacityWhilePending ?? null,
              failsafe: document.documentElement.classList.contains("tr-failsafe"),
              topPx: Math.round(r.top),
            });
            if (log.phase === "nav" && !log.firstNavRunningAt) log.firstNavRunningAt = now;
          }
        }
      }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-reveal-state"] });
    });
  }, forceFailsafe);

  await page.goto(`${BASE}${CATEGORY}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const tag = forceFailsafe ? "forced" : "control";
  if (forceFailsafe) await shot(page, `verify/perf-lh/perf-lh-07-perfskeptic-${tag}-load-settled`);

  // (B) scroll slowly to the end.
  await page.evaluate(() => (window.__v.phase = "scroll"));
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);

  // (C) client-side navigation to the first product (Next <Link>, no full reload).
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__v.phase = "nav";
    window.__v.navAt = Math.round(performance.now());
    window.__v.navMarker = true; // survives only if the navigation is client-side
  });
  const link = page.locator('main a[href^="/deo/"]').first();
  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForURL(`**${href}`);
  // Capture as soon as the first post-navigation element starts re-animating.
  let captured = false;
  for (let i = 0; i < 60 && !captured; i++) {
    const hit = await page.evaluate(() => window.__v.firstNavRunningAt ?? null);
    if (hit && forceFailsafe) {
      await shot(page, `verify/perf-lh/perf-lh-07-perfskeptic-${tag}-clientnav-rehide`);
      captured = true;
    } else await page.waitForTimeout(25);
  }
  await page.waitForTimeout(2000);
  const result = await page.evaluate(() => ({
    clientSideNav: window.__v.navMarker === true,
    failsafeAtDcl: window.__v.failsafeAtDcl,
    failsafeNow: document.documentElement.classList.contains("tr-failsafe"),
    events: window.__v.events,
    navAt: window.__v.navAt,
    leftoverWords: document.querySelectorAll(".reveal-word").length,
    pendingLeft: document.querySelectorAll('[data-reveal-state="pending"]').length,
  }));
  await browser.close();
  const summarize = (phase) => {
    const ev = result.events.filter((e) => e.phase === phase);
    const flashed = ev.filter((e) => e.opacityWhilePending === "1" && e.visibleMsBeforeHide > 16);
    return { running: ev.length, paintedVisibleThenHidden: flashed.length, medianVisibleMs: flashed.length ? flashed.map((e) => e.visibleMsBeforeHide).sort((a, b) => a - b)[Math.floor(flashed.length / 2)] : 0, sample: flashed.slice(0, 6).map((e) => `${e.el} (visible ${e.visibleMsBeforeHide} ms, top ${e.topPx})`) };
  };
  return { mode: tag, url: `${BASE}${CATEGORY} -> ${href}`, clientSideNav: result.clientSideNav, failsafeAtDcl: result.failsafeAtDcl, failsafeNow: result.failsafeNow, leftoverWords: result.leftoverWords, pendingLeft: result.pendingLeft, load: summarize("load"), scroll: summarize("scroll"), nav: summarize("nav"), navRaw: result.events.filter((e) => e.phase === "nav").map((e) => ({ ...e, msFromClickToPending: e.pendingAt - result.navAt, msFromClickToHide: e.runningAt - result.navAt })) };
}

const out = { base: BASE, note: "412x823 Chromium, no CPU/network throttling; forced = boot failsafe timer fired at 0 ms", runs: [] };
for (const force of [true, false]) {
  const r = await run(force);
  out.runs.push(r);
  console.log(JSON.stringify(r, null, 1));
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
