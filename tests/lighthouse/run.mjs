// Lighthouse (docs/TESTING.md §M, SEO-ADS §J11): runs Lighthouse 13 against a running production
// server (`next build && next start -p 3100`), mobile by default (`--desktop` for the desktop
// preset), N runs per URL, prints the median LCP / CLS / TBT / FCP / SI and category scores and
// writes the JSON reports to .lighthouse/. Exit code 1 when a budget fails.
//
// `--throttling simulate` (default, Lantern) or `devtools` (applied throttling: the page really
// loads on a throttled network and a 4x slower CPU). docs/3d/WEB-QA.md explains why both are
// recorded for localhost runs.
//
//   node tests/lighthouse/run.mjs [--base http://localhost:3100] [--runs 3] [--desktop]
//                                 [--throttling simulate|devtools] [/ /delovi …]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = value("base", "http://localhost:3100");
const RUNS = Number(value("runs", "3"));
const DESKTOP = flag("desktop");
const THROTTLING = value("throttling", "simulate");
if (!["simulate", "devtools"].includes(THROTTLING)) throw new Error(`--throttling ${THROTTLING}?`);
const paths = args.filter((a, i) => a.startsWith("/") && !(args[i - 1] ?? "").startsWith("--"));
const URLS = (paths.length ? paths : ["/"]).map((p) => `${BASE}${p}`);
const OUT = resolve(".lighthouse");
mkdirSync(OUT, { recursive: true });

/** Budgets (BRIEF §9, ROADMAP step 10/11). */
const BUDGET = { lcp: 2500, cls: 0.05, tbt: 300, performance: 0.85 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || undefined,
  chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"],
});
let failed = false;
try {
  for (const url of URLS) {
    const runs = [];
    for (let r = 0; r < RUNS; r++) {
      const result = await lighthouse(
        url,
        { port: chrome.port, output: "json", logLevel: "error", throttlingMethod: THROTTLING },
        // Lighthouse's own desktop preset (desktop throttling 40 ms RTT / 10 Mbps / 1x CPU,
        // 1350 × 940 screen) — not just the desktop screen with mobile throttling.
        DESKTOP ? { ...desktopConfig, settings: { ...desktopConfig.settings, throttlingMethod: THROTTLING } } : undefined,
      );
      const lhr = result.lhr;
      const audits = lhr.audits;
      const run = {
        performance: lhr.categories.performance.score,
        accessibility: lhr.categories.accessibility.score,
        bestPractices: lhr.categories["best-practices"].score,
        seo: lhr.categories.seo.score,
        lcp: audits["largest-contentful-paint"].numericValue,
        fcp: audits["first-contentful-paint"].numericValue,
        cls: audits["cumulative-layout-shift"].numericValue,
        tbt: audits["total-blocking-time"].numericValue,
        si: audits["speed-index"].numericValue,
        lcpElement: audits["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet ?? "",
      };
      runs.push(run);
      const name = `${new URL(url).pathname.replace(/\//g, "_") || "_"}-${DESKTOP ? "desktop" : "mobile"}-${THROTTLING}-${r + 1}.json`;
      writeFileSync(resolve(OUT, name), result.report);
      console.log(
        `${url} run ${r + 1}: perf ${Math.round(run.performance * 100)} · LCP ${Math.round(run.lcp)} ms · CLS ${run.cls.toFixed(3)} · TBT ${Math.round(run.tbt)} ms · FCP ${Math.round(run.fcp)} ms · SI ${Math.round(run.si)} ms`,
      );
    }
    const m = {
      performance: median(runs.map((r) => r.performance)),
      accessibility: median(runs.map((r) => r.accessibility)),
      bestPractices: median(runs.map((r) => r.bestPractices)),
      seo: median(runs.map((r) => r.seo)),
      lcp: median(runs.map((r) => r.lcp)),
      fcp: median(runs.map((r) => r.fcp)),
      cls: median(runs.map((r) => r.cls)),
      tbt: median(runs.map((r) => r.tbt)),
      si: median(runs.map((r) => r.si)),
    };
    console.log(
      `MEDIAN ${url} (${DESKTOP ? "desktop" : "mobile"}, ${THROTTLING} throttling, ${RUNS} runs): performance ${Math.round(m.performance * 100)} · accessibility ${Math.round(m.accessibility * 100)} · best practices ${Math.round(m.bestPractices * 100)} · SEO ${Math.round(m.seo * 100)} · LCP ${Math.round(m.lcp)} ms · CLS ${m.cls.toFixed(3)} · TBT ${Math.round(m.tbt)} ms · FCP ${Math.round(m.fcp)} ms · SI ${Math.round(m.si)} ms`,
    );
    console.log(`  LCP element: ${runs[0].lcpElement}`);
    if (!DESKTOP) {
      const misses = [];
      if (m.lcp > BUDGET.lcp) misses.push(`LCP ${Math.round(m.lcp)} > ${BUDGET.lcp}`);
      if (m.cls > BUDGET.cls) misses.push(`CLS ${m.cls.toFixed(3)} > ${BUDGET.cls}`);
      if (m.tbt > BUDGET.tbt) misses.push(`TBT ${Math.round(m.tbt)} > ${BUDGET.tbt}`);
      if (m.performance < BUDGET.performance) misses.push(`performance ${Math.round(m.performance * 100)} < 85`);
      if (misses.length) {
        failed = true;
        console.log(`  BUDGET MISSED: ${misses.join(", ")}`);
      } else console.log("  budgets met");
    }
  }
} finally {
  await chrome.kill();
}
process.exit(failed ? 1 : 0);
