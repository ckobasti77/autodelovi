/**
 * xbrowser — why is the `load` event slow in some engines? Per engine, 3 runs per route:
 * navigation timing (DCL, load) and the slowest resources (responseEnd) at the load event.
 */
import { BASE } from "./kit.mjs";
import { ENGINES, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const ROUTES = (process.env.XB_ROUTES ?? "/,/deo/kocioni-disk-prednji-276-24-mm-demo-0004").split(",");
const RUNS = Number(process.env.XB_RUNS ?? 3);
const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const route of ROUTES) {
    for (let i = 0; i < RUNS; i++) {
      const context = await xctx(browser, engine, { width: 1440, height: 900, tag: `lt${i}` });
      const page = await context.newPage();
      const reqs = new Map();
      page.on("request", (q) => reqs.set(q, { url: q.url(), t0: Date.now() }));
      page.on("requestfinished", (q) => { const x = reqs.get(q); if (x) x.t1 = Date.now(); });
      page.on("requestfailed", (q) => { const x = reqs.get(q); if (x) { x.t1 = Date.now(); x.failed = q.failure()?.errorText; } });
      const t = Date.now();
      let err = null;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 120_000 });
      } catch (e) {
        err = String(e).slice(0, 120);
      }
      const wall = Date.now() - t;
      const nav = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0];
        const res = performance.getEntriesByType("resource").map((e) => ({ n: e.name.replace(location.origin, ""), start: Math.round(e.startTime), end: Math.round(e.responseEnd), type: e.initiatorType }));
        res.sort((a, b) => b.end - a.end);
        return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), ttfb: Math.round(n.responseStart), slowest: res.slice(0, 6) } : null;
      }).catch(() => null);
      const pending = [...reqs.values()].filter((x) => !x.t1).map((x) => x.url.replace(BASE, "")).slice(0, 8);
      const slowReq = [...reqs.values()].filter((x) => x.t1).map((x) => ({ u: x.url.replace(BASE, "").slice(0, 90), ms: x.t1 - x.t0, f: x.failed })).sort((a, b) => b.ms - a.ms).slice(0, 5);
      const key = `${engine}${route}#${i}`;
      out[key] = { wall, err, nav, pending, slowReq };
      console.log(key, JSON.stringify({ wall, err, dcl: nav?.dcl, load: nav?.load, ttfb: nav?.ttfb, slow: slowReq.slice(0, 3), pending: pending.slice(0, 3) }));
      await context.close();
    }
  }
  await browser.close();
}
saveJson(`loadtiming-${ENGINES.join("_")}.json`, out);
