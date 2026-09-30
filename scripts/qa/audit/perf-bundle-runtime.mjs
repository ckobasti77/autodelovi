// perf-bundle track: one short browser session against :3100.
//  1. Home at 390 (touch) and 1440 (fine pointer): every request before any interaction
//     (load + 10 s idle), JS + CSS coverage of the first-load assets, fonts actually used vs
//     loaded, images (format, bytes, natural vs rendered size, loading, width/height).
//  2. Category, product and ads landing at 390: same request/image/font inventory (no coverage).
//
//   node scripts/qa/audit/perf-bundle-runtime.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { BASE, launch, newContext, watch } from "./kit.mjs";

const OUT = path.resolve("docs/qa/audit/perf-bundle");
const browser = await launch("chromium");
const results = {};

async function inventory(page) {
  return page.evaluate(() => {
    const fontsLoaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight} ${f.style}`);
    const used = new Set();
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const cs = getComputedStyle(el);
      used.add(`${cs.fontFamily.split(",")[0].replace(/['"]/g, "")} ${cs.fontWeight} ${cs.fontStyle}`);
    }
    const imgs = [...document.images].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        src: (img.currentSrc || img.src).replace(location.origin, "").slice(0, 160),
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        rendered: `${Math.round(r.width)}x${Math.round(r.height)}`,
        dpr: devicePixelRatio,
        inViewport: r.top < innerHeight && r.bottom > 0,
        top: Math.round(r.top + scrollY),
        loading: img.getAttribute("loading"),
        fetchpriority: img.getAttribute("fetchpriority"),
        hasWH: img.hasAttribute("width") && img.hasAttribute("height"),
        sizes: img.getAttribute("sizes"),
        complete: img.complete,
      };
    });
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource").map((e) => ({
      name: e.name.replace(location.origin, ""),
      type: e.initiatorType,
      start: Math.round(e.startTime),
      transfer: e.transferSize,
      encoded: e.encodedBodySize,
      decoded: e.decodedBodySize,
      renderBlocking: e.renderBlockingStatus,
    }));
    return { fontsLoaded, fontsUsed: [...used], imgs, nav: { transfer: nav.transferSize, decoded: nav.decodedBodySize, dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) }, res };
  });
}

async function run(name, route, { width, height, coverage = false, idle = 10_000 }) {
  const ctx = await newContext(browser, { width, height, tag: `perf-bundle-${name}-${width}` });
  const page = await ctx.newPage();
  const log = watch(page);
  let cdp;
  if (coverage) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    await cdp.send("CSS.startRuleUsageTracking");
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  }
  const phases = [];
  let phase = "load";
  page.on("response", async (r) => {
    const u = r.url();
    const t = r.request().resourceType();
    phases.push({ phase, t, url: u.replace(BASE, ""), status: r.status(), cc: r.headers()["cache-control"] ?? "", enc: r.headers()["content-encoding"] ?? "", len: Number(r.headers()["content-length"] ?? 0) });
  });
  await page.goto(BASE + route, { waitUntil: "load" });
  phase = "after-load";
  await page.waitForTimeout(idle);
  let cov = null;
  if (coverage) {
    const js = await page.coverage.stopJSCoverage();
    const first = js.filter((e) => e.url.includes("/_next/static/chunks/"));
    const jsRows = first.map((e) => {
      const total = e.source?.length ?? 0;
      let used = 0;
      for (const f of e.functions) {
        if (f.functionName === "" && f.ranges.length && f.ranges[0].startOffset === 0) {
          // top-level ranges: count executed byte ranges (count > 0) minus nested uncalled
        }
      }
      // Approximate: unused = sum of ranges with count 0 at any nesting level (deepest wins).
      const marks = new Uint8Array(total).fill(1);
      for (const f of e.functions) for (const r of f.ranges) if (r.count === 0) marks.fill(0, r.startOffset, r.endOffset);
      for (const f of e.functions) for (const r of f.ranges) if (r.count > 0 && f.ranges.length > 1 && r !== f.ranges[0]) marks.fill(1, r.startOffset, r.endOffset);
      used = marks.reduce((n, x) => n + x, 0);
      return { url: e.url.replace(BASE, ""), total, used, unusedPct: total ? Math.round((1 - used / total) * 100) : 0 };
    });
    const { ruleUsage } = await cdp.send("CSS.stopRuleUsageTracking");
    const sheets = new Map();
    for (const u of ruleUsage) {
      const s = sheets.get(u.styleSheetId) ?? { used: 0, all: 0 };
      s.all += u.endOffset - u.startOffset;
      if (u.used) s.used += u.endOffset - u.startOffset;
      sheets.set(u.styleSheetId, s);
    }
    const cssRows = [];
    for (const [id, s] of sheets) {
      const { text } = await cdp.send("CSS.getStyleSheetText", { styleSheetId: id });
      cssRows.push({ id, bytes: text.length, rulesBytes: s.all, usedBytes: s.used, usedPct: Math.round((s.used / Math.max(1, s.all)) * 100), gz: gzipSync(text).length, head: text.slice(0, 80) });
    }
    cov = { jsRows, cssRows };
  }
  const inv = await inventory(page);
  results[`${name}@${width}`] = { route, width, requests: phases, inventory: inv, coverage: cov, errors: log };
  await ctx.close();
  const kb = (n) => (n / 1024).toFixed(1);
  const scripts = phases.filter((p) => p.t === "script");
  console.log(`\n== ${name} @${width}: ${phases.length} responses; scripts load ${scripts.filter((p) => p.phase === "load").length}, after-load ${scripts.filter((p) => p.phase === "after-load").length}`);
  for (const p of phases.filter((x) => x.phase === "after-load")) console.log(`   after-load ${p.t} ${p.status} ${p.url.slice(0, 110)}`);
  const imgs = inv.res.filter((r) => r.type === "img" || /\.(avif|webp|png|jpe?g)/.test(r.name));
  console.log(`   images fetched: ${imgs.length}, ${kb(imgs.reduce((n, r) => n + r.transfer, 0))} KB transfer`);
  console.log(`   fonts loaded: ${inv.fontsLoaded.join(" | ")}`);
  console.log(`   fonts used: ${inv.fontsUsed.join(" | ")}`);
  console.log(`   render-blocking: ${inv.res.filter((r) => r.renderBlocking === "blocking").map((r) => r.name).join(", ")}`);
  if (cov) {
    const t = cov.jsRows.reduce((a, r) => ({ total: a.total + r.total, used: a.used + r.used }), { total: 0, used: 0 });
    console.log(`   JS coverage (chunks executed so far): ${kb(t.total)} KB raw, unused ${kb(t.total - t.used)} KB (${Math.round((1 - t.used / t.total) * 100)} %)`);
    for (const c of cov.cssRows) console.log(`   CSS ${c.head.slice(0, 40)}… ${kb(c.bytes)} KB, used rules ${c.usedPct} %`);
  }
  if (log.console.length || log.pageErrors.length) console.log(`   console errors: ${JSON.stringify(log.console.concat(log.pageErrors)).slice(0, 300)}`);
}

await run("home", "/", { width: 390, height: 844, coverage: true });
await run("home", "/", { width: 1440, height: 900, coverage: true, idle: 12_000 });
await run("category", "/delovi/kocioni-diskovi", { width: 390, height: 844, idle: 7000 });
await run("product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { width: 390, height: 844, idle: 7000 });
await run("landing", "/ponuda/kocione-plocice-golf", { width: 390, height: 844, idle: 7000 });
await browser.close();
writeFileSync(path.join(OUT, "runtime.json"), JSON.stringify(results, null, 2));
