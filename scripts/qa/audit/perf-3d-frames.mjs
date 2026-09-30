// perf-3d track (step 21 audit): hero 3D runtime on a throttled profile.
// Per run (fresh context): load `/`, throttle the CPU, give intent (desktop: pointer over the
// hero; mobile: tap on the stage, or `--cold` = the first scroll itself is the intent), time
// intent → first GL draw → ready, record long tasks during the start, then wheel through the
// whole explode track recording every rAF interval, long tasks, draw calls/triangles and the
// GPU memory estimate (perf-3d-gl.mjs).
//
//   node scripts/qa/audit/perf-3d-frames.mjs --vp desktop|mobile [--cpu 4] [--gpu] [--runs 3] [--cold] [--tag x]
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { GL_INSTRUMENT, GPU_ARGS, SWIFT_ARGS, quantile } from "./perf-3d-gl.mjs";

const args = process.argv.slice(2);
const arg = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = process.env.AUDIT_BASE ?? arg("base", "http://localhost:3200");
const CPU = Number(arg("cpu", "4"));
const GPU = args.includes("--gpu");
const COLD = args.includes("--cold");
const RUNS = Number(arg("runs", "3"));
const VP = arg("vp", "desktop");
const TAG = arg("tag", `${VP}-cpu${CPU}-${GPU ? "gpu" : "swiftshader"}${COLD ? "-cold" : ""}`);

const vpDef =
  VP === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
if (arg("dpr")) vpDef.deviceScaleFactor = Number(arg("dpr"));

const browser = await chromium.launch({ args: GPU ? GPU_ARGS : SWIFT_ARGS });
const results = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ ...vpDef, locale: "sr-Latn-RS" });
    await context.addCookies([
      {
        name: "sk_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0001" })),
        domain: new URL(BASE).hostname,
        path: "/",
      },
    ]);
    await context.addInitScript(GL_INSTRUMENT);
    await context.addInitScript(() => {
      window.__long = [];
      window.__status = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) });
      }).observe({ type: "longtask", buffered: true });
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    });
    const requests = [];
    page.on("request", (r) => requests.push({ url: r.url().replace(BASE, ""), t: Date.now() }));
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    // Status timeline from the store (poll every animation frame).
    await page.evaluate(() => {
      let last = null;
      const poll = () => {
        const s = window.__sklop3d?.getState();
        const key = s ? `${s.status}|${s.tier}` : "none";
        if (key !== last) {
          window.__status.push({ t: Math.round(performance.now()), key });
          last = key;
        }
        if (!window.__stopStatus) requestAnimationFrame(poll);
      };
      poll();
    });
    const beforeIntent = requests.map((r) => r.url);
    const stage = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hero-track"]');
      const media = el?.querySelector("picture, img") ?? el;
      const r = (media ?? document.body).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.min(r.top + r.height / 2, window.innerHeight * 0.6) };
    });
    const intentAt = await page.evaluate(() => Math.round(performance.now()));
    let frames = [];
    if (COLD) {
      // The first scroll is the intent: record frames from the very start of the scroll.
      await page.evaluate(() => {
        window.__frames = [];
        let last = performance.now();
        const tick = (now) => {
          window.__frames.push(now - last);
          last = now;
          if (!window.__stopFrames) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    } else if (VP === "mobile") {
      await page.touchscreen.tap(stage.x, stage.y);
    } else {
      await page.mouse.move(stage.x, stage.y, { steps: 4 });
    }
    if (!COLD) {
      await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 180_000 });
      await page.waitForTimeout(2500); // crossfade + idle enhancements (edges, BVH)
    }
    const start = await page.evaluate((intent) => {
      const st = window.__status;
      const at = (k) => st.find((s) => s.key.startsWith(k))?.t ?? null;
      const longs = window.__long.filter((l) => l.t >= intent);
      return {
        intentAt: intent,
        loadingAt: at("loading"),
        firstDrawAfterIntent: window.__gl.firstDrawAt ? Math.round(window.__gl.firstDrawAt - intent) : null,
        readyAfterIntent: at("ready") ? at("ready") - intent : null,
        tier: window.__sklop3d?.getState().tier,
        longTasks: longs.map((l) => ({ t: l.t - intent, d: l.d })),
        tbt: longs.reduce((s, l) => s + Math.max(0, l.d - 50), 0),
        resources: performance
          .getEntriesByType("resource")
          .filter((e) => /models|chunks/.test(e.name) && e.startTime >= intent - 5)
          .map((e) => ({ name: e.name.replace(location.origin, ""), start: Math.round(e.startTime - intent), end: Math.round(e.responseEnd - intent), kb: Math.round(e.encodedBodySize / 1024) })),
      };
    }, intentAt);
    const afterIntent = requests.map((r) => r.url).filter((u) => !beforeIntent.includes(u));

    if (!COLD) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        window.__frames = [];
        window.__longScroll = [];
        let last = performance.now();
        const tick = (now) => {
          window.__frames.push(now - last);
          last = now;
          if (!window.__stopFrames) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        window.__scrollStart = performance.now();
      });
    } else {
      await page.evaluate(() => (window.__scrollStart = performance.now()));
    }
    const distance = await page.evaluate(() => {
      const track = document.querySelector('[data-testid="hero-track"]');
      return track ? track.getBoundingClientRect().bottom + window.scrollY - window.innerHeight : 3000;
    });
    const steps = 60;
    await page.mouse.move(vpDef.viewport.width * 0.7, vpDef.viewport.height * 0.5);
    const drawsBefore = await page.evaluate(() => window.__gl.draws);
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, distance / steps);
      await page.waitForTimeout(110);
    }
    await page.waitForTimeout(1200);
    const scroll = await page.evaluate((d0) => {
      window.__stopFrames = true;
      window.__stopStatus = true;
      const s = window.__scrollStart;
      return {
        frames: window.__frames.slice(1),
        long: window.__long.filter((l) => l.t >= s).map((l) => l.d),
        progress: window.__sklop3d?.getState().progress ?? null,
        status: window.__sklop3d?.getState().status ?? null,
        drawsDuringScroll: window.__gl.draws - d0,
        gl: window.__glSnapshot(),
        heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        dpr: window.devicePixelRatio,
        canvas: (() => {
          const c = document.querySelector('[data-testid="hero-canvas"] canvas') ?? document.querySelector("canvas");
          return c ? { css: `${Math.round(c.clientWidth)}x${Math.round(c.clientHeight)}`, px: `${c.width}x${c.height}` } : null;
        })(),
        statusTimeline: window.__status,
      };
    }, drawsBefore);
    if (COLD) {
      start.readyAfterIntent = (scroll.statusTimeline.find((x) => x.key.startsWith("ready"))?.t ?? NaN) - intentAt;
    }
    frames = scroll.frames;
    const over = (ms) => frames.filter((f) => f > ms).length;
    const renderer = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("webgl2");
      const info = c?.getExtension("WEBGL_debug_renderer_info");
      const r = info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
      c?.getExtension("WEBGL_lose_context")?.loseContext();
      return r;
    });
    const res = {
      run,
      renderer,
      tier: start.tier,
      frames: frames.length,
      median: +quantile(frames, 0.5).toFixed(1),
      p95: +quantile(frames, 0.95).toFixed(1),
      p99: +quantile(frames, 0.99).toFixed(1),
      worst: Math.round(Math.max(...frames)),
      over33pct: +((over(33.4) / frames.length) * 100).toFixed(1),
      over50: over(50),
      over100: over(100),
      longTasksScroll: scroll.long.length,
      worstLongScroll: Math.max(0, ...scroll.long),
      endProgress: scroll.progress,
      endStatus: scroll.status,
      drawsDuringScroll: scroll.drawsDuringScroll,
      gl: scroll.gl,
      heapMB: scroll.heap,
      canvas: scroll.canvas,
      start,
      loadedBeforeIntent: beforeIntent.filter((u) => /models|\.glb|\.hdr|chunks/.test(u)).length,
      glbBeforeIntent: beforeIntent.filter((u) => /\.glb|\.hdr/.test(u)),
      afterIntent: afterIntent.filter((u) => /models|\.glb|\.hdr/.test(u) || /chunks/.test(u)).length,
      afterIntentModels: afterIntent.filter((u) => /models/.test(u)),
      consoleErrors,
    };
    results.push(res);
    console.log(
      `[${TAG} run ${run}] ${renderer} tier=${res.tier} · ${res.frames} frames · median ${res.median} · p95 ${res.p95} · p99 ${res.p99} · worst ${res.worst} ms · >33 ms ${res.over33pct} % · >50 ms ${res.over50} · >100 ms ${res.over100} · long tasks ${res.longTasksScroll} (worst ${res.worstLongScroll}) · end p ${res.endProgress?.toFixed?.(2)} ${res.endStatus}` +
        `\n    start: first draw +${start.firstDrawAfterIntent} ms · ready +${start.readyAfterIntent} ms · long tasks ${start.longTasks.length} (sum>50 ${start.tbt} ms; worst ${Math.max(0, ...start.longTasks.map((l) => l.d))} ms)` +
        `\n    gl: draws/frame max ${res.gl.maxDrawsPerFrame} last ${res.gl.lastDraws} · tris/frame max ${res.gl.maxTrisPerFrame} last ${res.gl.lastTris} · GPU est ${res.gl.gpuMB} MB · contexts created ${res.gl.created} live ${res.gl.live} · heap ${res.heapMB} MB · canvas ${JSON.stringify(res.canvas)} · models after intent ${JSON.stringify(res.afterIntentModels)} · before intent ${JSON.stringify(res.glbBeforeIntent)}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
mkdirSync("docs/qa/audit/perf-3d", { recursive: true });
writeFileSync(`docs/qa/audit/perf-3d/frames-${TAG}.json`, JSON.stringify(results, null, 1));
