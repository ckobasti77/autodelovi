// perf-lh (step 21 audit): attribution experiment for the main-thread cost of the site-wide text
// reveal. Loads each template at 390 × 844 with 4× CPU throttling (CDP) and compares three
// variants, interleaved A/B/C per round so machine drift hits all equally:
//   A "baseline"   — the page as served;
//   B "noRevealCss"— the inline <style id="text-reveal-css"> (the :has()-based hiding rule) removed;
//   C "noReveal"   — the stylesheet AND the boot script removed (tr-js never set → TextRevealGlobal
//                    returns at once), i.e. the page without the reveal system.
// Records CDP Performance.getMetrics (RecalcStyleDuration, LayoutDuration, ScriptDuration,
// TaskDuration) 4 s after `load`, plus long tasks (PerformanceObserver) and a TBT-like sum
// (Σ max(0, d − 50)) over long tasks after first contentful paint.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-stylecost.mjs [rounds]
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext } from "./kit.mjs";

const ROUNDS = Number(process.argv[2] ?? 3);
const PATHS = ["/", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/delovi"];
const VARIANTS = ["baseline", "noRevealCss", "noReveal"];

const browser = await chromium.launch();
const results = [];
try {
  for (const p of PATHS) {
    for (let round = 1; round <= ROUNDS; round++) {
      for (const variant of VARIANTS) {
        const context = await newContext(browser, { width: 390, height: 844, tag: "perflh" });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.__lt = [];
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);
          }).observe({ type: "longtask", buffered: true });
        });
        if (variant !== "baseline") {
          await page.route(`${BASE}${p}`, async (route) => {
            if (route.request().resourceType() !== "document") return route.continue();
            const res = await route.fetch();
            let body = await res.text();
            body = body.replace(/<style id="text-reveal-css"[^>]*>[\s\S]*?<\/style>/, "");
            if (variant === "noReveal") body = body.replace(/<script id="text-reveal-boot"[^>]*>[\s\S]*?<\/script>/, "");
            await route.fulfill({ response: res, body });
          });
        }
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(`${BASE}${p}`, { waitUntil: "load" });
        await page.waitForTimeout(4000);
        const { metrics } = await cdp.send("Performance.getMetrics");
        const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
        const probe = await page.evaluate(() => {
          const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          const lt = window.__lt ?? [];
          return {
            fcp: Math.round(fcp),
            longTasks: lt,
            tbtLike: lt.filter(([s]) => s >= fcp).reduce((t, [, d]) => t + Math.max(0, d - 50), 0),
            domNodes: document.getElementsByTagName("*").length,
            hasTrJs: document.documentElement.classList.contains("tr-js"),
            revealCss: !!document.getElementById("text-reveal-css"),
          };
        });
        const row = {
          path: p,
          variant,
          round,
          recalcStyleMs: Math.round(m.RecalcStyleDuration * 1000),
          recalcStyleCount: m.RecalcStyleCount,
          layoutMs: Math.round(m.LayoutDuration * 1000),
          scriptMs: Math.round(m.ScriptDuration * 1000),
          taskMs: Math.round(m.TaskDuration * 1000),
          ...probe,
        };
        results.push(row);
        console.log(
          `${p} ${variant.padEnd(11)} r${round}: style ${row.recalcStyleMs} ms (${row.recalcStyleCount}) · layout ${row.layoutMs} · script ${row.scriptMs} · task ${row.taskMs} · TBT-like ${row.tbtLike} · LT ${row.longTasks.length} · nodes ${row.domNodes} · tr-js ${row.hasTrJs} css ${row.revealCss}`,
        );
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const summary = [];
for (const p of PATHS)
  for (const v of VARIANTS) {
    const rs = results.filter((r) => r.path === p && r.variant === v);
    summary.push({
      path: p,
      variant: v,
      n: rs.length,
      recalcStyleMs: median(rs.map((r) => r.recalcStyleMs)),
      layoutMs: median(rs.map((r) => r.layoutMs)),
      scriptMs: median(rs.map((r) => r.scriptMs)),
      taskMs: median(rs.map((r) => r.taskMs)),
      tbtLike: median(rs.map((r) => r.tbtLike)),
      domNodes: rs[0]?.domNodes,
    });
  }
console.table(summary);
writeFileSync("docs/qa/audit/perf-lh/stylecost.json", JSON.stringify({ base: BASE, cpuThrottle: 4, viewport: "390x844", rounds: ROUNDS, summary, results }, null, 1));
