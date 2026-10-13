// Lighthouse gate (docs/TESTING.md §M, SEO-ADS §J11, BRIEF §9): runs Lighthouse 13 against a
// running production server (`next build && next start -p 3100`), mobile by default (`--desktop`
// for the desktop preset), N valid runs per URL, prints the median metrics, category scores,
// first-load JS and the LCP element, and writes the JSON reports plus a summary to .lighthouse/.
// Exit code 1 when a budget fails or a URL has no valid run.
//
// Budgets are per template (J11): home; category / landing / product; checkout / inquiry; every
// other page falls back to the BRIEF §9 bar. Metric and JS budgets are mobile-lab budgets and are
// checked on mobile runs only; accessibility, best practices and SEO (≥ 95, SEO skipped for
// noindex pages) are checked on every run.
//
// A run is discarded and retried (up to 2 × --runs attempts per URL) when Lighthouse reports a
// runtimeError (NO_NAVSTART, NO_FCP …), throws, or the machine's benchmarkIndex is below
// --min-benchmark (a loaded machine produces TBT/LCP that say nothing about the page).
//
// `--throttling simulate` (default, Lantern) or `devtools` (applied throttling: the page really
// loads on a throttled network and a 4x slower CPU). docs/3d/WEB-QA.md explains why both are
// recorded for localhost runs. In Git Bash run with MSYS_NO_PATHCONV=1.
//
//   node tests/lighthouse/run.mjs [--base http://localhost:3100] [--runs 3] [--desktop]
//                                 [--throttling simulate|devtools] [--min-benchmark 600] [/ /delovi …]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

// ---------------------------------------------------------------------------------------------
// Arguments: only these flags take a value; everything else starting with "/" is a path.
const VALUE_FLAGS = new Set(["--base", "--runs", "--throttling", "--min-benchmark"]);
const BOOLEAN_FLAGS = new Set(["--desktop"]);
const args = process.argv.slice(2);
const options = {};
const paths = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (VALUE_FLAGS.has(arg)) {
    if (i + 1 >= args.length) throw new Error(`${arg} needs a value`);
    options[arg.slice(2)] = args[++i];
  } else if (BOOLEAN_FLAGS.has(arg)) {
    options[arg.slice(2)] = true;
  } else if (arg.startsWith("/")) {
    paths.push(arg);
  } else {
    throw new Error(`Unknown argument ${arg} (paths must start with "/")`);
  }
}
const BASE = options.base ?? "http://localhost:3100";
const RUNS = Number(options.runs ?? "3");
const DESKTOP = options.desktop === true;
const THROTTLING = options.throttling ?? "simulate";
const MIN_BENCHMARK = Number(options["min-benchmark"] ?? "600");
if (!["simulate", "devtools"].includes(THROTTLING)) throw new Error(`--throttling ${THROTTLING}?`);
if (!Number.isInteger(RUNS) || RUNS < 1) throw new Error(`--runs ${options.runs}?`);
if (!Number.isFinite(MIN_BENCHMARK)) throw new Error(`--min-benchmark ${options["min-benchmark"]}?`);
const URLS = (paths.length ? paths : ["/"]).map((p) => `${BASE}${p}`);
const MAX_ATTEMPTS = RUNS * 2;
const OUT = resolve(".lighthouse");
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------------------------
// Budgets: SEO-ADS §J11 per template (mobile lab), BRIEF §9 as the fallback. JS = first-load
// script transfer size (requested before the load event, so the lazy 3D chunk is excluded), KB.
const CATEGORY_MIN = { accessibility: 0.95, bestPractices: 0.95, seo: 0.95 };
const TEMPLATES = [
  // Home: the hero v2 gate (docs/3d/HERO-V2.md §13, D364) — the brief's 90 and TBT < 150 ms.
  { name: "home", match: (p) => p === "/", performance: 0.9, lcp: 2500, cls: 0.05, tbt: 150, jsKb: 180 },
  {
    name: "catalog",
    match: (p) => /^\/(delovi|deo|ponuda)(\/|$)/.test(p),
    performance: 0.9,
    lcp: 2000,
    cls: 0.05,
    tbt: 150,
    jsKb: 160,
  },
  {
    name: "checkout",
    match: (p) => /^\/(korpa|porudzbina|upit)(\/|$)/.test(p),
    performance: 0.85,
    lcp: 2500,
    cls: 0.05,
    tbt: 200,
    jsKb: 200,
  },
  { name: "other", match: () => true, performance: 0.85, lcp: 2500, cls: 0.05, tbt: 200, jsKb: null },
];
const templateFor = (url) => {
  const pathname = new URL(url).pathname;
  return TEMPLATES.find((t) => t.match(pathname));
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Lighthouse 13 moved the LCP element into the lcp-breakdown insight (a `node` item). */
function findNode(value) {
  if (!value || typeof value !== "object") return null;
  if (value.type === "node") return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const found = findNode(child);
    if (found) return found;
  }
  return null;
}

function firstLoadJsBytes(audits) {
  const loadMs = audits.metrics?.details?.items?.[0]?.observedLoad;
  const requests = audits["network-requests"]?.details?.items ?? [];
  return requests
    .filter((r) => r.resourceType === "Script" && (loadMs === undefined || r.networkRequestTime <= loadMs))
    .reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
}

/** One Lighthouse run → metrics, or `{ invalid: reason }` when the run must be retried. */
async function runOnce(url, port) {
  let result;
  try {
    result = await lighthouse(
      url,
      { port, output: "json", logLevel: "error", throttlingMethod: THROTTLING },
      // Lighthouse's own desktop preset (desktop throttling 40 ms RTT / 10 Mbps / 1x CPU,
      // 1350 × 940 screen) — not just the desktop screen with mobile throttling.
      DESKTOP ? { ...desktopConfig, settings: { ...desktopConfig.settings, throttlingMethod: THROTTLING } } : undefined,
    );
  } catch (error) {
    return { invalid: `lighthouse threw: ${String(error).slice(0, 200)}` };
  }
  const lhr = result?.lhr;
  if (!lhr) return { invalid: "no result" };
  if (lhr.runtimeError) return { invalid: `runtimeError ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`, report: result.report };
  const audits = lhr.audits;
  const benchmarkIndex = lhr.environment?.benchmarkIndex ?? null;
  const numeric = (id) => audits[id]?.numericValue;
  const run = {
    performance: lhr.categories.performance?.score,
    accessibility: lhr.categories.accessibility?.score,
    bestPractices: lhr.categories["best-practices"]?.score,
    seo: lhr.categories.seo?.score,
    lcp: numeric("largest-contentful-paint"),
    fcp: numeric("first-contentful-paint"),
    cls: numeric("cumulative-layout-shift"),
    tbt: numeric("total-blocking-time"),
    si: numeric("speed-index"),
    jsBytes: firstLoadJsBytes(audits),
    indexable: audits["is-crawlable"]?.score !== 0,
    benchmarkIndex,
    lcpElement: (() => {
      const node = findNode(audits["lcp-breakdown-insight"]?.details);
      return node ? `${node.selector ?? ""} ${node.snippet ?? ""}`.trim() : "";
    })(),
  };
  const missing = Object.entries(run).filter(([, v]) => v === undefined || v === null || Number.isNaN(v));
  if (missing.length) return { invalid: `missing ${missing.map(([k]) => k).join(", ")}`, report: result.report };
  if (benchmarkIndex < MIN_BENCHMARK) {
    return { invalid: `benchmarkIndex ${Math.round(benchmarkIndex)} < ${MIN_BENCHMARK} (machine too busy)`, report: result.report };
  }
  return { run, report: result.report };
}

function budgetMisses(m, template) {
  const misses = [];
  if (m.accessibility < CATEGORY_MIN.accessibility) misses.push(`accessibility ${Math.round(m.accessibility * 100)} < 95`);
  if (m.bestPractices < CATEGORY_MIN.bestPractices) misses.push(`best practices ${Math.round(m.bestPractices * 100)} < 95`);
  if (m.indexable && m.seo < CATEGORY_MIN.seo) misses.push(`SEO ${Math.round(m.seo * 100)} < 95`);
  if (DESKTOP) return misses;
  if (m.performance < template.performance) misses.push(`performance ${Math.round(m.performance * 100)} < ${Math.round(template.performance * 100)}`);
  if (m.lcp > template.lcp) misses.push(`LCP ${Math.round(m.lcp)} > ${template.lcp}`);
  if (m.cls > template.cls) misses.push(`CLS ${m.cls.toFixed(3)} > ${template.cls}`);
  if (m.tbt > template.tbt) misses.push(`TBT ${Math.round(m.tbt)} > ${template.tbt}`);
  if (template.jsKb !== null && m.jsBytes / 1024 > template.jsKb) {
    misses.push(`first-load JS ${Math.round(m.jsBytes / 1024)} KB > ${template.jsKb} KB`);
  }
  return misses;
}

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH || undefined,
  chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"],
});
let failed = false;
const summary = [];
const device = DESKTOP ? "desktop" : "mobile";
try {
  for (const url of URLS) {
    const template = templateFor(url);
    const slug = new URL(url).pathname.replace(/\//g, "_") || "_";
    const runs = [];
    const rejected = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && runs.length < RUNS; attempt++) {
      const { run, invalid, report } = await runOnce(url, chrome.port);
      const name = `${slug}-${device}-${THROTTLING}-${attempt}${invalid ? "-invalid" : ""}.json`;
      if (report) writeFileSync(resolve(OUT, name), report);
      if (invalid) {
        rejected.push(invalid);
        console.log(`${url} attempt ${attempt}: discarded (${invalid})`);
        continue;
      }
      runs.push(run);
      console.log(
        `${url} run ${runs.length}: perf ${Math.round(run.performance * 100)} · LCP ${Math.round(run.lcp)} ms · CLS ${run.cls.toFixed(3)} · TBT ${Math.round(run.tbt)} ms · FCP ${Math.round(run.fcp)} ms · SI ${Math.round(run.si)} ms · JS ${Math.round(run.jsBytes / 1024)} KB · benchmarkIndex ${Math.round(run.benchmarkIndex)}`,
      );
    }
    if (runs.length < RUNS) {
      failed = true;
      console.log(`  NO RESULT: ${runs.length}/${RUNS} valid runs for ${url} (${rejected.join(" | ")})`);
      summary.push({ url, template: template.name, device, throttling: THROTTLING, validRuns: runs.length, rejected, misses: ["not enough valid runs"] });
      continue;
    }
    const pick = (key) => median(runs.map((r) => r[key]));
    const m = {
      performance: pick("performance"),
      accessibility: pick("accessibility"),
      bestPractices: pick("bestPractices"),
      seo: pick("seo"),
      lcp: pick("lcp"),
      fcp: pick("fcp"),
      cls: pick("cls"),
      tbt: pick("tbt"),
      si: pick("si"),
      jsBytes: pick("jsBytes"),
      benchmarkIndex: pick("benchmarkIndex"),
      indexable: runs.every((r) => r.indexable),
    };
    console.log(
      `MEDIAN ${url} (${template.name}, ${device}, ${THROTTLING} throttling, ${RUNS} runs): performance ${Math.round(m.performance * 100)} · accessibility ${Math.round(m.accessibility * 100)} · best practices ${Math.round(m.bestPractices * 100)} · SEO ${Math.round(m.seo * 100)}${m.indexable ? "" : " (noindex)"} · LCP ${Math.round(m.lcp)} ms · CLS ${m.cls.toFixed(3)} · TBT ${Math.round(m.tbt)} ms · FCP ${Math.round(m.fcp)} ms · SI ${Math.round(m.si)} ms · first-load JS ${Math.round(m.jsBytes / 1024)} KB · benchmarkIndex ${Math.round(m.benchmarkIndex)}`,
    );
    const lcpElement = runs.map((r) => r.lcpElement).find(Boolean) ?? "";
    console.log(`  LCP element: ${lcpElement || "(none reported)"}`);
    const misses = budgetMisses(m, template);
    if (misses.length) {
      failed = true;
      console.log(`  BUDGET MISSED: ${misses.join(", ")}`);
    } else console.log("  budgets met");
    summary.push({ url, template: template.name, device, throttling: THROTTLING, validRuns: runs.length, rejected, median: m, lcpElement, misses });
  }
} finally {
  await chrome.kill();
  writeFileSync(
    resolve(OUT, `summary-${device}-${THROTTLING}.json`),
    JSON.stringify({ at: new Date().toISOString(), base: BASE, runs: RUNS, minBenchmark: MIN_BENCHMARK, results: summary }, null, 2),
  );
}
process.exit(failed ? 1 : 0);
