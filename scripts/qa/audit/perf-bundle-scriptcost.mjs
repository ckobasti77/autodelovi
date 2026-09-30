// perf-bundle track: main-thread script cost of the page-specific JS on /upit and /porudzbina
// (zod + react-hook-form chunk) vs /korpa (same shell, no form), Chromium with 4x CPU throttling,
// 390 px, 3 runs each (CDP Performance.getMetrics ScriptDuration + TaskDuration after load + 3 s,
// plus a trace-free per-script compile/eval estimate from the Profiler is not needed).
//   node scripts/qa/audit/perf-bundle-scriptcost.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "./kit.mjs";

const browser = await launch("chromium");
const routes = [["korpa", "/korpa"], ["upit", "/upit"], ["porudzbina", "/porudzbina"], ["prijava", "/prijava"]];
const rows = [];
for (let run = 1; run <= 3; run++) {
  for (const [name, route] of routes) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `perf-bundle-cost-${name}-${run}` });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const { metrics } = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const longTasks = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return { dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) };
    });
    rows.push({ run, name, scriptMs: Math.round(m.ScriptDuration * 1000), taskMs: Math.round(m.TaskDuration * 1000), jsHeapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), ...longTasks });
    await ctx.close();
  }
}
await browser.close();
for (const r of rows) console.log(`run ${r.run} ${r.name.padEnd(11)} script ${String(r.scriptMs).padStart(5)} ms  task ${String(r.taskMs).padStart(5)} ms  heap ${r.jsHeapMB} MB  dcl ${r.dcl}  load ${r.load}`);
const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log("\nmedians (4x CPU):");
for (const [name] of routes) {
  const rs = rows.filter((r) => r.name === name);
  console.log(`  ${name.padEnd(11)} script ${med(rs.map((r) => r.scriptMs))} ms, task ${med(rs.map((r) => r.taskMs))} ms, heap ${med(rs.map((r) => r.jsHeapMB))} MB`);
}
writeFileSync("docs/qa/audit/perf-bundle/scriptcost.json", JSON.stringify(rows, null, 2));
