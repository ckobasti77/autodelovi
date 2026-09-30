/**
 * xbrowser — home per engine × viewport: poster, WebGL availability, live 3D start, feature
 * support, fonts, reveal, overflow, sticky header, console errors, CSP violations.
 *   node scripts/qa/audit/xbrowser-home.mjs
 */
import { BASE, overflowX, revealCheck, scrollThrough, shot, watch } from "./kit.mjs";
import { ENGINES, VIEWS, cspLog, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const v of VIEWS) {
    const key = `${engine}-${v.tag}`;
    const r = (out[key] = {});
    const context = await xctx(browser, engine, { width: v.width, height: v.height, tag: `home${v.tag}` });
    const page = await context.newPage();
    const log = watch(page);
    const t0 = Date.now();
    try {
      await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
      r.loadMs = Date.now() - t0;
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1500);
      r.support = await page.evaluate(() => {
        const c = document.createElement("canvas");
        let webgl2 = false,
          webgl = false,
          renderer = null;
        try {
          const g2 = c.getContext("webgl2");
          webgl2 = Boolean(g2);
          const g = g2 || document.createElement("canvas").getContext("webgl");
          webgl = Boolean(g);
          const ext = g?.getExtension("WEBGL_debug_renderer_info");
          renderer = ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g?.getParameter(g.RENDERER) ?? null;
        } catch (e) {
          renderer = String(e);
        }
        return {
          webgl2,
          webgl,
          renderer,
          backdrop: CSS.supports("backdrop-filter", "blur(4px)"),
          webkitBackdrop: CSS.supports("-webkit-backdrop-filter", "blur(4px)"),
          contentVisibility: CSS.supports("content-visibility", "auto"),
          has: CSS.supports("selector(:has(a))"),
          textWrapBalance: CSS.supports("text-wrap", "balance"),
          textWrapPretty: CSS.supports("text-wrap", "pretty"),
          popover: typeof HTMLElement.prototype.showPopover === "function",
          dialog: typeof HTMLDialogElement === "function",
          scrollbarGutter: CSS.supports("scrollbar-gutter", "stable"),
          fieldSizing: CSS.supports("field-sizing", "content"),
          interpolateSize: CSS.supports("interpolate-size", "allow-keywords"),
          anchor: CSS.supports("anchor-name", "--a"),
          colorMix: CSS.supports("color", "color-mix(in oklch, red, blue)"),
          oklch: CSS.supports("color", "oklch(0.5 0.1 100)"),
          dvh: CSS.supports("height", "100dvh"),
          subgrid: CSS.supports("grid-template-columns", "subgrid"),
          scrollTimeline: CSS.supports("animation-timeline", "scroll()"),
          ua: navigator.userAgent,
          cores: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory ?? null,
          htmlClass: document.documentElement.className,
        };
      });
      r.fonts = await page.evaluate(() =>
        [...document.fonts].map((f) => `${f.family}|${f.weight}|${f.style}|${f.status}`).slice(0, 40),
      );
      r.fontFamilies = await page.evaluate(() => {
        const pick = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cs = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return { sel, font: cs.fontFamily.slice(0, 80), size: cs.fontSize, lh: cs.lineHeight, w: Math.round(b.width), h: Math.round(b.height) };
        };
        return ["h1", "header nav", "main p", "[data-testid=hero-search-input] input", "footer"].map(pick);
      });
      r.hookState0 = await page.evaluate(() => window.__sklop3d?.getState?.() ?? null);
      await shot(page, `xbrowser/home-${key}-poster`);
      // intent → 3D
      await page.evaluate(() => window.scrollTo(0, 80));
      const t1 = Date.now();
      try {
        await page.waitForFunction(() => window.__sklop3d?.ready === true || window.__sklop3d?.getState?.().status === "error" || window.__sklop3d?.getState?.().tier === "low", null, { timeout: 90_000 });
      } catch {
        r.readyTimeout = true;
      }
      r.readyMs = Date.now() - t1;
      await page.waitForTimeout(1500);
      r.hookState1 = await page.evaluate(() => window.__sklop3d?.getState?.() ?? null);
      r.canvasCount = await page.locator("[data-testid=hero-canvas] canvas").count();
      r.canvasOpacity = await page.evaluate(() => {
        const c = document.querySelector("[data-testid=hero-canvas]");
        const p = document.querySelector("[data-testid=hero-poster]");
        return { canvas: c ? getComputedStyle(c).opacity : null, poster: p ? getComputedStyle(p).opacity : null };
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(900);
      await shot(page, `xbrowser/home-${key}-3d-top`);
      // scroll positions inside the hero track
      for (const f of [1, 2.5]) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(v.height * f));
        await page.waitForTimeout(1400);
        await shot(page, `xbrowser/home-${key}-y${String(f).replace(".", "_")}`);
      }
      r.hookState2 = await page.evaluate(() => window.__sklop3d?.getState?.() ?? null);
      // header sticky
      r.header = await page.evaluate(() => {
        const h = document.querySelector("[data-testid=site-header]");
        if (!h) return null;
        const b = h.getBoundingClientRect();
        const cs = getComputedStyle(h);
        return { top: Math.round(b.top), height: Math.round(b.height), position: cs.position, backdrop: cs.backdropFilter || cs.webkitBackdropFilter, bg: cs.backgroundColor };
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await scrollThrough(page);
      await page.waitForTimeout(800);
      r.reveal = await revealCheck(page);
      r.overflow = await overflowX(page);
      r.scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await shot(page, `xbrowser/home-${key}-full`, { fullPage: true, quality: 50 });
    } catch (e) {
      r.error = String(e).slice(0, 500);
    }
    r.csp = await cspLog(page);
    r.log = log;
    await context.close();
    console.log(key, JSON.stringify({ webgl2: r.support?.webgl2, tier: r.hookState1?.tier, status: r.hookState1?.status, readyMs: r.readyMs, canvas: r.canvasCount, reveal: r.reveal, over: r.overflow?.over, csp: r.csp?.length, console: log.console.length, err: r.error }));
  }
  await browser.close();
}
saveJson("home.json", out);
