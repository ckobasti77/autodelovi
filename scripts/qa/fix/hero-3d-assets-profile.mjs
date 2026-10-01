// hero-3d-assets (step 22): copy of scripts/qa/audit/perf-3d-profile.mjs that writes under docs/qa/fix/hero-3d-assets/.
// perf-3d track: attributes the long tasks of the 3D start (intent → ready + 2.5 s) with a V8
// CPU profile at the given CPU throttle. Prints the longest busy stretches (consecutive non-idle
// samples ≈ one task) with their top self-time functions and the deepest named app frames.
//
//   node scripts/qa/audit/perf-3d-profile.mjs --vp desktop|mobile [--cpu 4] [--gpu] [--runs 1]
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { GL_INSTRUMENT, GPU_ARGS, SWIFT_ARGS } from "../audit/perf-3d-gl.mjs";

const args = process.argv.slice(2);
const arg = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = process.env.AUDIT_BASE ?? arg("base", "http://localhost:3200");
const CPU = Number(arg("cpu", "4"));
const GPU = args.includes("--gpu");
const VP = arg("vp", "desktop");
const RUNS = Number(arg("runs", "1"));
const PHASE = arg("phase", "start");
const vpDef =
  VP === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const browser = await chromium.launch({ args: GPU ? GPU_ARGS : SWIFT_ARGS });
const out = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ ...vpDef, locale: "sr-Latn-RS" });
    await context.addCookies([
      {
        name: "sk_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0002" })),
        domain: new URL(BASE).hostname,
        path: "/",
      },
    ]);
    await context.addInitScript(GL_INSTRUMENT);
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
    if (PHASE === "start") await cdp.send("Profiler.start");
    const stage = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="hero-track"]').getBoundingClientRect();
      return { x: r.left + r.width * 0.6, y: Math.min(r.top + r.height / 2, window.innerHeight * 0.6) };
    });
    if (VP === "mobile") await page.touchscreen.tap(stage.x, stage.y);
    else await page.mouse.move(stage.x, stage.y, { steps: 4 });
    await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 180_000 });
    await page.waitForTimeout(2500);
    let wall = 0;
    if (PHASE === "scroll") {
      await page.waitForTimeout(4000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      const distance = await page.evaluate(() => {
        const t = document.querySelector('[data-testid="hero-track"]');
        return t.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      });
      await page.mouse.move(vpDef.viewport.width * 0.7, vpDef.viewport.height * 0.5);
      await cdp.send("Profiler.start");
      const w0 = Date.now();
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(0, distance / 60);
        await page.waitForTimeout(110);
      }
      await page.waitForTimeout(1200);
      wall = Date.now() - w0;
    }
    const { profile } = await cdp.send("Profiler.stop");
    await context.close();

    // Build node map and parent links.
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const name = (n) => {
      const f = n.callFrame;
      const file = f.url ? f.url.split("/").pop() : "";
      return `${f.functionName || "(anon)"}${file ? ` ${file}:${f.lineNumber + 1}:${f.columnNumber + 1}` : ""}`;
    };
    const idle = (n) => ["(idle)", "(program)", "(garbage collector)"].includes(n.callFrame.functionName) && n.callFrame.functionName !== "(garbage collector)";
    // Walk samples into busy stretches.
    let t = profile.startTime;
    const stretches = [];
    let cur = null;
    for (let i = 0; i < profile.samples.length; i++) {
      t += profile.timeDeltas[i];
      const n = nodes.get(profile.samples[i]);
      const dt = profile.timeDeltas[i + 1] ?? 500;
      if (idle(n)) {
        if (cur) {
          // Allow a 2 ms gap of idle inside a task (sampling jitter).
          cur.gap = (cur.gap ?? 0) + dt;
          if (cur.gap > 2000) {
            stretches.push(cur);
            cur = null;
          }
        }
        continue;
      }
      if (!cur) cur = { start: t, end: t, samples: [] };
      cur.gap = 0;
      cur.end = t + dt;
      cur.samples.push({ id: n.id, dt });
    }
    if (cur) stretches.push(cur);
    const top = stretches
      .map((s) => ({ ...s, ms: (s.end - s.start) / 1000 }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6);
    const summary = top.map((s) => {
      const self = new Map();
      const incl = new Map();
      for (const { id, dt } of s.samples) {
        const n = nodes.get(id);
        self.set(name(n), (self.get(name(n)) ?? 0) + dt);
        const seen = new Set();
        let p = id;
        while (p !== undefined) {
          const pn = nodes.get(p);
          const nm = name(pn);
          if (!seen.has(nm) && pn.callFrame.functionName && !/^\(/.test(pn.callFrame.functionName)) {
            seen.add(nm);
            incl.set(nm, (incl.get(nm) ?? 0) + dt);
          }
          p = parent.get(p);
        }
      }
      const fmt = (m, k) =>
        [...m.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, k)
          .map(([k2, v]) => `${(v / 1000).toFixed(0)} ms ${k2}`);
      return {
        at: Math.round((s.start - profile.startTime) / 1000),
        ms: Math.round(s.ms),
        self: fmt(self, 8),
        inclusiveNamed: fmt(incl, 40).filter((x) => /[A-Za-z]{4,}/.test(x.split(" ")[2] ?? "")).slice(0, 25),
      };
    });
    if (PHASE === "scroll") {
      const self = new Map();
      const incl = new Map();
      let busy = 0;
      for (let i = 0; i < profile.samples.length; i++) {
        const dt = profile.timeDeltas[i + 1] ?? 500;
        const n = nodes.get(profile.samples[i]);
        if (idle(n)) continue;
        busy += dt;
        self.set(name(n), (self.get(name(n)) ?? 0) + dt);
        const seen = new Set();
        let p = n.id;
        while (p !== undefined) {
          const pn = nodes.get(p);
          const nm = name(pn);
          if (!seen.has(nm) && pn.callFrame.functionName && !/^\(/.test(pn.callFrame.functionName)) {
            seen.add(nm);
            incl.set(nm, (incl.get(nm) ?? 0) + dt);
          }
          p = parent.get(p);
        }
      }
      const fmt = (m, k) =>
        [...m.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, k)
          .map(([k2, v]) => `${(v / 1000).toFixed(0)} ms ${k2}`);
      const scrollSummary = { wallMs: wall, busyMs: Math.round(busy / 1000), self: fmt(self, 20), incl: fmt(incl, 60) };
      console.log(JSON.stringify(scrollSummary, null, 1));
      out.push({ run, vp: VP, cpu: CPU, gpu: GPU, phase: PHASE, scrollSummary });
      continue;
    }
    out.push({ run, vp: VP, cpu: CPU, gpu: GPU, summary });
    for (const s of summary) {
      console.log(`\n[${VP} cpu${CPU} run ${run}] busy stretch at +${s.at} ms: ${s.ms} ms`);
      console.log("  self:", s.self.join(" | "));
      console.log("  incl:", s.inclusiveNamed.slice(0, 16).join(" | "));
    }
  }
} finally {
  await browser.close();
}
mkdirSync("docs/qa/fix/hero-3d-assets", { recursive: true });
writeFileSync(`docs/qa/fix/hero-3d-assets/profile-${PHASE}-${VP}-cpu${CPU}-${GPU ? "gpu" : "swiftshader"}.json`, JSON.stringify(out, null, 1));
