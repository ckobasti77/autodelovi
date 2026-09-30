// perf-3d track: interaction cost of the live 3D at a CPU throttle.
// desktop: hover sweep over the car right after ready (BVH not yet built) and again after 6 s
// (BVH built) — long animation frames (LoAF) with script attribution; click on a part →
// Event Timing (INP-style) for pointerup/click; idle frames (no input for 3 s) and frames
// while the hero is scrolled out of view.
// mobile: tap to start, full explode, tap a part → Event Timing + LoAF.
//
//   node scripts/qa/audit/perf-3d-interact.mjs --vp desktop|mobile [--cpu 4] [--gpu] [--runs 3]
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { GL_INSTRUMENT, GPU_ARGS, SWIFT_ARGS } from "./perf-3d-gl.mjs";

const args = process.argv.slice(2);
const arg = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = process.env.AUDIT_BASE ?? arg("base", "http://localhost:3200");
const CPU = Number(arg("cpu", "4"));
const GPU = args.includes("--gpu");
const VP = arg("vp", "desktop");
const RUNS = Number(arg("runs", "3"));
const vpDef =
  VP === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const browser = await chromium.launch({ args: GPU ? GPU_ARGS : SWIFT_ARGS });
const all = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ ...vpDef, locale: "sr-Latn-RS" });
    await context.addCookies([
      {
        name: "sk_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0004" })),
        domain: new URL(BASE).hostname,
        path: "/",
      },
    ]);
    await context.addInitScript(GL_INSTRUMENT);
    await context.addInitScript(() => {
      window.__loaf = [];
      window.__events = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries())
            window.__loaf.push({
              t: Math.round(e.startTime),
              d: Math.round(e.duration),
              block: Math.round(e.blockingDuration),
              render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
              scripts: (e.scripts || [])
                .sort((a, b) => b.duration - a.duration)
                .slice(0, 3)
                .map((s) => `${Math.round(s.duration)}ms ${s.invoker} ${String(s.sourceFunctionName || "")} ${String(s.sourceURL || "").split("/").pop()}:${s.sourceCharPosition}`),
            });
        }).observe({ type: "long-animation-frame", buffered: true });
      } catch {}
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          window.__events.push({ t: Math.round(e.startTime), name: e.name, d: Math.round(e.duration), proc: Math.round(e.processingEnd - e.processingStart), delay: Math.round(e.processingStart - e.startTime) });
      }).observe({ type: "event", durationThreshold: 16, buffered: true });
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    const box = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="hero-track"] canvas, [data-testid="hero-track"] picture, [data-testid="hero-track"]').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: Math.min(r.height, window.innerHeight - r.top) };
    });
    const r = { run };
    const since = async () => page.evaluate(() => performance.now());
    const loafSince = (t0) =>
      page.evaluate((t) => window.__loaf.filter((l) => l.t >= t), t0);
    const eventsSince = (t0) => page.evaluate((t) => window.__events.filter((l) => l.t >= t), t0);

    if (VP === "desktop") {
      await page.mouse.move(box.x + box.w * 0.62, box.y + box.h * 0.5, { steps: 3 });
      await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 180_000 });
      // Sweep immediately (BVH is built in idle slices after the first frame).
      const sweep = async (label) => {
        const t0 = await since();
        for (let i = 0; i <= 24; i++) {
          await page.mouse.move(box.x + box.w * (0.45 + (0.4 * i) / 24), box.y + box.h * (0.45 + 0.1 * Math.sin(i / 3)));
          await page.waitForTimeout(40);
        }
        await page.waitForTimeout(400);
        const loaf = await loafSince(t0);
        const hovered = await page.evaluate(() => window.__sklop3d.getState().hovered);
        r[label] = { loafCount: loaf.length, worst: Math.max(0, ...loaf.map((l) => l.d)), worstBlock: Math.max(0, ...loaf.map((l) => l.block)), top: loaf.sort((a, b) => b.d - a.d).slice(0, 3), hoveredAtEnd: hovered };
      };
      await sweep("hoverRightAfterReady");
      await page.waitForTimeout(6000);
      await sweep("hoverAfter6s");
      // Click a part (the car's middle) — Event Timing.
      const tc = await since();
      await page.mouse.click(box.x + box.w * 0.62, box.y + box.h * 0.52);
      await page.waitForTimeout(2500);
      r.click = { events: (await eventsSince(tc)).filter((e) => /pointer|click|mouse/.test(e.name)), loaf: (await loafSince(tc)).slice(0, 5), selected: await page.evaluate(() => window.__sklop3d.getState().selected) };
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      // Idle: pointer parked outside the canvas, nothing changes.
      await page.mouse.move(5, box.y + box.h - 5);
      await page.waitForTimeout(1500);
      const d0 = await page.evaluate(() => window.__gl.draws);
      await page.waitForTimeout(3000);
      r.idleDraws3s = (await page.evaluate(() => window.__gl.draws)) - d0;
      // Hero out of view: scroll far below and wheel around.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight * 2));
      await page.waitForTimeout(1500);
      const d1 = await page.evaluate(() => window.__gl.draws);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, i % 2 ? 300 : -300);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(800);
      r.offscreenDraws = (await page.evaluate(() => window.__gl.draws)) - d1;
    } else {
      await page.touchscreen.tap(box.x + box.w * 0.5, box.y + box.h * 0.5);
      await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 180_000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__sklop3d.explode(1));
      await page.waitForTimeout(1500);
      const cb = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="hero-track"] canvas').getBoundingClientRect();
        return { x: c.left, y: c.top, w: c.width, h: Math.min(c.height, window.innerHeight - c.top) };
      });
      const results = [];
      // Try a few points until a tap selects something.
      for (const [fx, fy] of [[0.5, 0.5], [0.4, 0.55], [0.6, 0.45], [0.5, 0.62], [0.35, 0.45]]) {
        const tc = await since();
        await page.touchscreen.tap(cb.x + cb.w * fx, cb.y + cb.h * fy);
        await page.waitForTimeout(2200);
        const sel = await page.evaluate(() => window.__sklop3d.getState().selected);
        results.push({ at: [fx, fy], selected: sel, events: (await eventsSince(tc)).filter((e) => /pointer|click|touch/.test(e.name)), loaf: (await loafSince(tc)).slice(0, 4) });
        if (sel) {
          await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
          await page.keyboard.press("Escape");
          await page.waitForTimeout(1200);
        }
      }
      r.taps = results;
      const d0 = await page.evaluate(() => window.__gl.draws);
      await page.waitForTimeout(3000);
      r.idleDraws3s = (await page.evaluate(() => window.__gl.draws)) - d0;
    }
    all.push(r);
    console.log(JSON.stringify(r, null, 0).slice(0, 4000));
    await context.close();
  }
} finally {
  await browser.close();
}
mkdirSync("docs/qa/audit/perf-3d", { recursive: true });
writeFileSync(`docs/qa/audit/perf-3d/interact-${VP}-cpu${CPU}-${GPU ? "gpu" : "swiftshader"}.json`, JSON.stringify(all, null, 1));
