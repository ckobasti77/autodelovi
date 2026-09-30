// Hero frame times (docs/TESTING.md §M3, docs/3d/WEB-QA.md): starts the 3D, throttles the CPU
// 4x and wheels through the whole explode track, recording every animation-frame interval and
// long task. By default headless Chromium draws WebGL through SwiftShader (software: every
// fragment on the CPU), a pessimistic floor; `--gpu` uses the machine's GPU through ANGLE/D3D11
// (Windows), which is what a real browser does — the 4x throttle then applies to the main
// thread only, as on a slow phone CPU.
//
//   node scripts/qa/hero-frames.mjs [--base http://localhost:3100] [--cpu 4] [--gpu]
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:3100");
const CPU = Number(arg("cpu", "4"));
const GPU = args.includes("--gpu");

const VIEWPORTS = [
  { name: "desktop 1440 (high)", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "mobile 390 (mid)", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
];

const browser = await chromium.launch({
  args: GPU
    ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ ...vp, locale: "sr-Latn-RS" });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.evaluate(() => window.scrollTo(0, 60));
    await page.waitForSelector('[data-testid="hero-canvas"][data-status="ready"]', { timeout: 180_000, state: "attached" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const gl = await page.evaluate(() => {
      const c = document.createElement("canvas").getContext("webgl2");
      const info = c?.getExtension("WEBGL_debug_renderer_info");
      return info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    await page.evaluate(() => {
      window.__frames = [];
      window.__long = [];
      let last = performance.now();
      const tick = (now) => {
        window.__frames.push(now - last);
        last = now;
        if (!window.__stopFrames) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__long.push(e.duration);
      }).observe({ type: "longtask" });
    });

    // Wheel from the top of the page through the end of the hero track.
    const distance = await page.evaluate(() => {
      const track = document.querySelector('[data-testid="hero-track"]');
      return track ? track.getBoundingClientRect().bottom + window.scrollY - window.innerHeight : 3000;
    });
    const steps = 60;
    await page.mouse.move(vp.viewport.width * 0.7, vp.viewport.height * 0.5);
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, distance / steps);
      await page.waitForTimeout(110);
    }
    await page.waitForTimeout(1200);
    const { frames, long, progress } = await page.evaluate(() => {
      window.__stopFrames = true;
      return { frames: window.__frames.slice(1), long: window.__long, progress: window.__sklop3d?.getState().progress ?? null };
    });
    const over = (ms) => frames.filter((f) => f > ms).length;
    console.log(
      `${vp.name}, CPU ${CPU}x, ${gl}: ${frames.length} frames · median ${quantile(frames, 0.5).toFixed(1)} ms · p95 ${quantile(frames, 0.95).toFixed(1)} ms · worst ${Math.max(...frames).toFixed(0)} ms · > 33 ms ${((over(33.4) / frames.length) * 100).toFixed(1)} % · long tasks ${long.length} (worst ${Math.round(Math.max(0, ...long))} ms) · end progress ${progress === null ? "n/a" : progress.toFixed(2)}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
