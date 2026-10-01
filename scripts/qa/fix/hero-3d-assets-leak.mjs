// hero-3d-assets (step 22): copy of scripts/qa/audit/verify-perf-3d-leak.mjs writing under docs/qa/fix/hero-3d-assets/.
// perf-3d track: memory / leak check for the hero 3D across client-side navigations.
// Each cycle: home → 3D ready → full explode (scroll the whole track) → select a part →
// close → navigate to /delovi through the header link (client-side) → GC → measure →
// history back → GC → measure. Records JS heap after forced GC, WebGL contexts created /
// still reachable (WeakRef after GC) / live (not lost), GPU estimate, workers, DOM nodes and
// listeners.
//
//   node scripts/qa/audit/perf-3d-leak.mjs [--cycles 5] [--gpu] [--vp desktop|mobile]
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { GL_INSTRUMENT, GPU_ARGS, SWIFT_ARGS } from "../audit/perf-3d-gl.mjs";

const args = process.argv.slice(2);
const arg = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = process.env.AUDIT_BASE ?? arg("base", "http://localhost:3200");
const CYCLES = Number(arg("cycles", "5"));
const GPU = args.includes("--gpu");
const VP = arg("vp", "desktop");
const vpDef =
  VP === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

const browser = await chromium.launch({ args: GPU ? GPU_ARGS : SWIFT_ARGS });
const context = await browser.newContext({ ...vpDef, locale: "sr-Latn-RS" });
await context.addCookies([
  {
    name: "sk_consent",
    value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-3d-0003" })),
    domain: new URL(BASE).hostname,
    path: "/",
  },
]);
const BARE = args.includes('--bare');
// --bare: only WeakRefs to WebGL contexts (no GL call wrapping) — control run for the instrumentation.
const BARE_SCRIPT = `(() => {
  const L = (window.__ctx = []);
  const o = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (t, a) {
    const c = o.call(this, t, a);
    if (c && /webgl/.test(t) && !seen.has(c)) { seen.add(c); L.push(new WeakRef(c)); }
    return c;
  };
  window.__glSnapshot = () => ({
    created: L.length,
    alive: L.filter((r) => r.deref()).length,
    live: L.filter((r) => { const c = r.deref(); return c && !c.isContextLost(); }).length,
    gpuMB: null,
  });
})();`;
await context.addInitScript(BARE ? BARE_SCRIPT : GL_INSTRUMENT);
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 240)}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${String(e).slice(0, 240)}`));
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

async function measure(label) {
  for (let i = 0; i < 3; i++) {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(300);
  }
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const gl = await page.evaluate(() => window.__glSnapshot());
  const row = {
    label,
    url: new URL(page.url()).pathname,
    heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1),
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
    docs: m.Documents,
    workers: page.workers().length,
    ctxCreated: gl.created,
    ctxReachable: gl.alive,
    ctxLive: gl.live,
    gpuMB: gl.gpuMB,
    status: await page.evaluate(() => window.__sklop3d?.getState().status ?? null),
  };
  console.log(JSON.stringify(row));
  return row;
}

const rows = [];
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(1000);
rows.push(await measure("home, poster (before 3D)"));
for (let c = 1; c <= CYCLES; c++) {
  // Intent + ready.
  const stage = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="hero-track"]').getBoundingClientRect();
    return { x: r.left + r.width * 0.6, y: Math.min(r.top + r.height / 2, window.innerHeight * 0.6) };
  });
  if (VP === "mobile") await page.touchscreen.tap(stage.x, stage.y);
  else await page.mouse.move(stage.x, stage.y, { steps: 3 });
  await page.waitForFunction(() => window.__sklop3d?.getState().status === "ready", null, { timeout: 120_000 });
  // Full explode by scrolling the whole track, then select and close.
  const distance = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    return t.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
  });
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, distance / 20);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__sklop3d.selectPart("turbina"));
  await page.waitForTimeout(1800);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  rows.push(await measure(`cycle ${c}: home, exploded + selected/closed`));
  // Away through a client-side link, then back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const link = page.locator('header a[href="/delovi"]').first();
  if (await link.isVisible().catch(() => false)) await link.click();
  else await page.evaluate(() => document.querySelector('a[href="/delovi"]')?.click());
  await page.waitForURL((u) => u.pathname === "/delovi", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  rows.push(await measure(`cycle ${c}: /delovi (after leaving 3D)`));
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
  await page.waitForTimeout(1500);
}
rows.push(await measure("final: home after back, poster"));
await browser.close();
mkdirSync("docs/qa/fix/hero-3d-assets", { recursive: true });
writeFileSync(`docs/qa/fix/hero-3d-assets/leak-${VP}-${GPU ? "gpu" : "swiftshader"}${BARE ? "-bare" : ""}.json`, JSON.stringify({ rows, logs }, null, 1));
console.log("console:", logs.slice(0, 20));
