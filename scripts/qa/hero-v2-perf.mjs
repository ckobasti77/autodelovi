// Hero v2 render budget (docs/3d/HERO-V2.md §13): what the canvas draws and when.
//
// - draw calls and triangles of one frame at every page rest (they must fall as pages leave);
// - cadence of the idle float (every frame on the high tier, every second one on the mid tier),
//   that it stops after the idle time, and that nothing draws with the hero off-screen;
// - the drawing buffer's pixel ratio against the tier cap;
// - allocations per rendered frame while floating and while scrubbing (V8 sampling heap
//   profiler, collected objects included), with the functions that allocate most;
// - script time per drawn frame under a CPU throttle (V8 sampling profiler).
//
// Uses the machine's GPU through ANGLE (a software renderer gets the posters only). Function
// names are readable on a dev server; run it against a production build for the totals.
//
//   node scripts/qa/hero-v2-perf.mjs [--base http://localhost:3210] [--only desktop|mobile] [--top 10] [--cpu 4]
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3210");
const ONLY = arg("only", "");
const TOP = Number(arg("top", "10"));
/** CPU throttle of the main-thread profile (0 skips it). */
const CPU = Number(arg("cpu", "4"));

const VIEWPORTS = [
  { name: "desktop", tier: "high", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "mobile", tier: "mid", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
].filter((v) => !ONLY || v.name === ONLY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Counts draw calls and triangles per animation frame (installed before any page script). */
function instrument() {
  const stats = { draws: 0, tris: 0, frames: [] };
  window.__gl = stats;
  const proto = WebGL2RenderingContext.prototype;
  const count = (name, countIndex) => {
    const original = proto[name];
    proto[name] = function (...a) {
      stats.draws += 1;
      if (a[0] === 4) stats.tris += a[countIndex] / 3;
      return original.apply(this, a);
    };
  };
  count("drawElements", 1);
  count("drawArrays", 2);
  count("drawElementsInstanced", 1);
  count("drawArraysInstanced", 2);
  const tick = () => {
    // Draws since the previous tick belong to the previous frame.
    stats.frames.push(stats.draws, Math.round(stats.tris));
    stats.draws = 0;
    stats.tris = 0;
    if (stats.frames.length > 40000) stats.frames.length = 0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Frames recorded since the last call: [draws, triangles] pairs. */
const takeFrames = (page) =>
  page.evaluate(() => {
    const flat = window.__gl.frames.splice(0);
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
    return out;
  });

/** React element factories: their allocations are named after the component that called them. */
const JSX = /^(exports\.)?(jsx|jsxs|jsxDEV|jsxDEVImpl|createElement|ReactElement)$/;

function summarize(profile) {
  const rows = new Map();
  let total = 0;
  const walk = (node, caller) => {
    const f = node.callFrame;
    const name = f.functionName || "(anonymous)";
    const factory = JSX.test(name);
    if (node.selfSize > 0) {
      total += node.selfSize;
      const file = (f.url.split("/").pop() ?? "").split("?")[0].slice(0, 44);
      const key = factory ? `React elements of ${caller}` : `${name} · ${file || "(native)"}`;
      rows.set(key, (rows.get(key) ?? 0) + node.selfSize);
    }
    for (const child of node.children ?? []) walk(child, factory ? caller : name);
  };
  walk(profile.head, "(root)");
  return { total, rows: [...rows.entries()].sort((x, y) => y[1] - x[1]) };
}

const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--js-flags=--expose-gc"],
});

try {
  for (const vp of VIEWPORTS) {
    const { name, tier, ...options } = vp;
    const context = await browser.newContext({ ...options, locale: "sr-Latn-RS" });
    await context.addInitScript(instrument);
    const page = await context.newPage();
    await page.goto(`${BASE}/?3d=${tier}`, { waitUntil: "load" });
    await sleep(1500);
    const decline = page.getByRole("button", { name: "Odbij sve" });
    if (await decline.count()) await decline.first().click();
    await sleep(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    const poke = async () => {
      if (name === "desktop") {
        // Over the copy column: wakes the float without hovering a part or a slot.
        await page.mouse.move(24 + Math.random() * 8, 480 + Math.random() * 40);
      } else {
        await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
      }
    };
    await poke();
    if (name === "mobile") await page.evaluate(() => window.scrollTo(0, 60));
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1200);

    const buffer = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="hero-canvas"] canvas');
      const info = c.getContext("webgl2")?.getExtension("WEBGL_debug_renderer_info");
      return {
        ratio: +(c.width / c.clientWidth).toFixed(2),
        css: `${c.clientWidth}x${c.clientHeight}`,
        device: window.devicePixelRatio,
        renderer: info ? c.getContext("webgl2").getParameter(info.UNMASKED_RENDERER_WEBGL) : "?",
      };
    });
    console.log(`\n== ${name} (${tier}) · buffer ratio ${buffer.ratio} of device ${buffer.device} · canvas ${buffer.css}`);
    console.log(`   ${buffer.renderer}`);

    // ------------------------------------------------------------ one frame per page
    const line = [];
    for (const step of [0, 1, 2, 3, 4, 5, 6, "end"]) {
      await page.evaluate((s) => {
        if (s === 0) window.__sklop3d.explode(0);
        else if (s === "end") window.__sklop3d.explode(1);
        else window.__sklop3d.page(s);
      }, step);
      await sleep(700);
      await takeFrames(page);
      await poke();
      await sleep(500);
      const drawn = (await takeFrames(page)).filter((f) => f[0] > 0);
      line.push(`${step}: ${median(drawn.map((f) => f[0]))} / ${Math.round(median(drawn.map((f) => f[1])) / 1000)}k`);
    }
    console.log(`   draw calls / triangles per frame — ${line.join(" · ")}`);

    // ------------------------------------------------------------ float cadence and pauses
    await page.evaluate(() => window.__sklop3d.page(2));
    await sleep(800);
    await poke();
    await takeFrames(page);
    await sleep(3000);
    const floating = await takeFrames(page);
    const rendered = floating.filter((f) => f[0] > 0).length;
    await sleep(6500);
    await takeFrames(page);
    await sleep(2000);
    const idle = (await takeFrames(page)).filter((f) => f[0] > 0).length;
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(900);
    await poke();
    await takeFrames(page);
    await sleep(2000);
    const away = (await takeFrames(page)).filter((f) => f[0] > 0).length;
    console.log(
      `   float: ${rendered} of ${floating.length} frames drawn in 3 s (${(rendered / 3).toFixed(0)}/s) · after 8.5 s idle: ${idle} in 2 s · hero off-screen, input: ${away} in 2 s`,
    );

    // ------------------------------------------------------------ allocations
    const cdp = await context.newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    const sample = async (label, run) => {
      await takeFrames(page);
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: 256,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      await run();
      const { profile } = await cdp.send("HeapProfiler.stopSampling");
      const frames = (await takeFrames(page)).filter((f) => f[0] > 0).length;
      const { total, rows } = summarize(profile);
      console.log(
        `   ${label}: ${(total / 1024).toFixed(0)} KB over ${frames} drawn frames = ${frames ? Math.round(total / frames) : 0} B/frame`,
      );
      for (const [key, bytes] of rows.slice(0, TOP)) {
        console.log(`      ${String(Math.round(bytes / Math.max(frames, 1))).padStart(6)} B/frame  ${key}`);
      }
    };

    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.__sklop3d.page(2);
    });
    await sleep(1200);
    await poke();
    await sleep(300);
    await sample("float, 4 s at page 2", () => sleep(4000));

    await page.evaluate(() => window.__sklop3d.explode(0));
    await sleep(800);
    const distance = await page.evaluate(() => {
      const track = document.querySelector('[data-testid="hero-track"]');
      return track.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
    });
    // Scripted scroll (no input events): the cost measured is the hero's own.
    const scrub = async (ms) => {
      await page.evaluate(
        ([d, duration]) =>
          new Promise((resolve) => {
            const start = performance.now();
            const step = (now) => {
              const t = Math.min(1, (now - start) / duration);
              window.scrollTo(0, d * t);
              if (t < 1) requestAnimationFrame(step);
              else resolve(null);
            };
            requestAnimationFrame(step);
          }),
        [distance, ms],
      );
      await sleep(600);
    };
    await sample("scrub, the whole track", () => scrub(5000));

    // ------------------------------------------------------------ main-thread time
    if (CPU > 0) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      const profileOf = async (label, run) => {
        await takeFrames(page);
        await cdp.send("Profiler.start");
        await run();
        const { profile } = await cdp.send("Profiler.stop");
        const frames = (await takeFrames(page)).filter((f) => f[0] > 0).length;
        const self = new Map();
        const byId = new Map(profile.nodes.map((n) => [n.id, n]));
        const dt = profile.timeDeltas;
        let busy = 0;
        profile.samples.forEach((id, i) => {
          const f = byId.get(id).callFrame;
          const fn = f.functionName || "(anonymous)";
          if (fn === "(idle)" || fn === "(program)" || fn === "(root)") return;
          busy += dt[i];
          const file = (f.url.split("/").pop() ?? "").split("?")[0].slice(0, 40);
          const key = `${fn} · ${file || "(native)"}`;
          self.set(key, (self.get(key) ?? 0) + dt[i]);
        });
        console.log(
          `   ${label}, CPU ${CPU}x: ${(busy / 1000 / Math.max(frames, 1)).toFixed(2)} ms of script per drawn frame (${frames} frames)`,
        );
        for (const [key, us] of [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, TOP)) {
          console.log(`      ${(us / 1000 / Math.max(frames, 1)).toFixed(3).padStart(7)} ms/frame  ${key}`);
        }
      };
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        window.__sklop3d.page(1);
      });
      await sleep(1500);
      await poke();
      await profileOf("float at page 1", () => sleep(4000));
      await page.evaluate(() => window.__sklop3d.explode(0));
      await sleep(1500);
      await profileOf("scrub, the whole track", () => scrub(5000));
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
