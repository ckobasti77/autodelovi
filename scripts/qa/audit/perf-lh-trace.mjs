// perf-lh (step 21 audit): main-thread attribution from a Chromium performance trace.
// Loads each path at 412 × 823, 4× CPU (CDP), consent pre-answered, records a devtools.timeline
// trace from navigation to load + 5 s, then attributes:
//   - every top-level task ≥ 50 ms: start, duration, what it was (ParseHTML / EventDispatch:<type> /
//     FunctionCall <script> / FireAnimationFrame / TimerFire / style & layout inside);
//   - per script: FunctionCall + EvaluateScript self time, rAF callback time (GSAP ticker),
//     forced layouts/style recalcs (Layout / UpdateLayoutTree with a JS stack) by script;
//   - the `load` event handler cost (ScrollTrigger's auto refresh runs there).
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-trace.mjs [rounds]
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext } from "./kit.mjs";

const ROUNDS = Number(process.argv[2] ?? 2);
const PATHS = (process.env.PATHS ?? "/,/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004,/delovi/kocioni-diskovi/volkswagen/golf,/kontakt").split(",");
const GSAP_CHUNK = "1tr6a7zmh41cy.js";
const short = (u) => (u ?? "").replace(/^.*\/_next\/static\/chunks\//, "").replace(/^https?:\/\/localhost:\d+/, "") || "(none)";

function analyse(events) {
  const main = (() => {
    // Renderer main thread = the thread with the most RunTask time among CrRendererMain threads.
    const names = events.filter((e) => e.name === "thread_name" && e.args?.name === "CrRendererMain");
    let best = null;
    let bestTime = -1;
    for (const n of names) {
      const t = events.filter((e) => e.pid === n.pid && e.tid === n.tid && e.name === "RunTask" && e.ph === "X").reduce((s, e) => s + e.dur, 0);
      if (t > bestTime) {
        bestTime = t;
        best = n;
      }
    }
    return best;
  })();
  const ev = events.filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === "X" && typeof e.dur === "number").sort((a, b) => a.ts - b.ts);
  const nav = events.find((e) => e.name === "navigationStart" || e.name === "TracingStartedInBrowser");
  const t0 = events.filter((e) => e.name === "navigationStart").map((e) => e.ts).sort((a, b) => b - a)[0] ?? nav?.ts ?? ev[0].ts;
  const tasks = ev.filter((e) => e.name === "RunTask");
  const inside = (task) => ev.filter((e) => e !== task && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur);
  const longTasks = [];
  for (const t of tasks) {
    if (t.dur < 50000) continue;
    const kids = inside(t);
    const top = kids
      .filter((k) => ["ParseHTML", "EventDispatch", "FunctionCall", "FireAnimationFrame", "TimerFire", "EvaluateScript", "v8.compile", "UpdateLayoutTree", "Layout", "RunMicrotasks", "v8.run", "FireIdleCallback", "HandlePostMessage", "Paint", "PrePaint", "Commit", "IntersectionObserverController::computeIntersections"].includes(k.name))
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 4)
      .map((k) => `${k.name}${k.args?.data?.type ? `:${k.args.data.type}` : ""}${k.args?.data?.url ? ` ${short(k.args.data.url)}` : ""} ${Math.round(k.dur / 1000)}`);
    const style = kids.filter((k) => k.name === "UpdateLayoutTree").reduce((s, k) => s + k.dur, 0);
    const layout = kids.filter((k) => k.name === "Layout").reduce((s, k) => s + k.dur, 0);
    longTasks.push({ start: Math.round((t.ts - t0) / 1000), ms: Math.round(t.dur / 1000), styleMs: Math.round(style / 1000), layoutMs: Math.round(layout / 1000), top });
  }
  // Per-script attribution of FunctionCall / EvaluateScript (inclusive), rAF, load handler.
  const perScript = {};
  const add = (url, k, v) => {
    const s = (perScript[short(url)] ??= { evaluate: 0, functionCall: 0, forcedStyle: 0, forcedLayout: 0 });
    s[k] += v;
  };
  for (const e of ev) {
    if (e.name === "EvaluateScript") add(e.args?.data?.url, "evaluate", e.dur);
    if (e.name === "FunctionCall") add(e.args?.data?.url, "functionCall", e.dur);
    if ((e.name === "Layout" || e.name === "UpdateLayoutTree") && e.args?.beginData?.stackTrace?.length) {
      add(e.args.beginData.stackTrace[0].url, e.name === "Layout" ? "forcedLayout" : "forcedStyle", e.dur);
    }
  }
  for (const s of Object.values(perScript)) for (const k of Object.keys(s)) s[k] = Math.round(s[k] / 1000);
  const raf = ev.filter((e) => e.name === "FireAnimationFrame");
  const rafMs = Math.round(raf.reduce((s, e) => s + e.dur, 0) / 1000);
  const loadDispatch = ev.filter((e) => e.name === "EventDispatch" && e.args?.data?.type === "load").map((e) => Math.round(e.dur / 1000));
  const styleTotal = Math.round(ev.filter((e) => e.name === "UpdateLayoutTree").reduce((s, e) => s + e.dur, 0) / 1000);
  const layoutTotal = Math.round(ev.filter((e) => e.name === "Layout").reduce((s, e) => s + e.dur, 0) / 1000);
  const tbtLike = longTasks.reduce((s, t) => s + Math.max(0, t.ms - 50), 0);
  return { longTasks, perScript, rafCount: raf.length, rafMs, loadDispatch, styleTotal, layoutTotal, tbtLikeAllTasks: tbtLike };
}

const browser = await chromium.launch();
const out = [];
try {
  for (const p of PATHS) {
    for (let round = 1; round <= ROUNDS; round++) {
      const context = await newContext(browser, { width: 412, height: 823, tag: "perflh-tr" });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await browser.startTracing(page, { categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "loading", "v8.execute"] });
      await page.goto(`${BASE}${p}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(5000);
      const buf = await browser.stopTracing();
      const events = JSON.parse(buf.toString("utf8")).traceEvents;
      const a = analyse(events);
      const gsap = a.perScript[GSAP_CHUNK] ?? {};
      console.log(`${p} r${round}: long tasks ${a.longTasks.length} (Σ>50 ${a.tbtLikeAllTasks} ms) · style ${a.styleTotal} · layout ${a.layoutTotal} · rAF ${a.rafCount}× ${a.rafMs} ms · load handler ${a.loadDispatch.join("/")} ms · gsap chunk ${JSON.stringify(gsap)}`);
      for (const t of a.longTasks) console.log(`   @${t.start} ${t.ms} ms (style ${t.styleMs}, layout ${t.layoutMs}) ${t.top.join(" | ")}`);
      out.push({ path: p, round, ...a });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/perf-lh/trace-attribution.json", JSON.stringify({ base: BASE, cpu: 4, viewport: "412x823", runs: out }, null, 1));
