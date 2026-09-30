// verify perf-lh (step 21 audit, independent verifier): Lighthouse 13 runner that retries failed runs,
// records benchmarkIndex and extracts a compact summary per run. Full LHR JSON goes to the OS temp dir
// (not the repo); the summary is appended to docs/qa/audit/verify/perf-lh/lh-runs.jsonl.
//
//   node scripts/qa/audit/verify-perf-lh-runner.mjs --base http://localhost:3200 --runs 3 \
//        --throttling devtools|simulate [--desktop] --paths "/,/delovi/kocioni-diskovi"
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const args = process.argv.slice(2);
const val = (n, f) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : f;
};
const BASE = val("base", "http://localhost:3200");
const RUNS = Number(val("runs", "3"));
const THR = val("throttling", "devtools");
const DESKTOP = args.includes("--desktop");
const PATHS = val("paths", "/").split(",");
const TAG = val("tag", "");
const OUTDIR = resolve("docs/qa/audit/verify/perf-lh");
mkdirSync(OUTDIR, { recursive: true });
const RAW = join(tmpdir(), "verify-perf-lh");
mkdirSync(RAW, { recursive: true });
const JSONL = join(OUTDIR, "lh-runs.jsonl");

const kb = (b) => Math.round((b / 1024) * 10) / 10;

function summarize(lhr, path, r) {
  const a = lhr.audits;
  const net = a["network-requests"]?.details?.items ?? [];
  const scripts = net.filter((i) => i.resourceType === "Script");
  const obs = a.metrics?.details?.items?.[0] ?? {};
  const doc = net.find((i) => i.resourceType === "Document");
  const css = net.filter((i) => i.resourceType === "Stylesheet").map((i) => ({
    url: i.url.split("/").pop(), kb: kb(i.transferSize), start: Math.round(i.networkRequestTime), end: Math.round(i.networkEndTime), prio: i.priority,
  }));
  const fonts = net.filter((i) => i.resourceType === "Font").map((i) => ({
    url: i.url.split("/").pop().slice(0, 16), kb: kb(i.transferSize), start: Math.round(i.networkRequestTime), end: Math.round(i.networkEndTime), prio: i.priority,
  }));
  const imgs = net.filter((i) => i.resourceType === "Image" && i.networkRequestTime < (obs.observedFirstContentfulPaint ?? 1e9) + 500).map((i) => ({
    url: i.url.slice(-60), kb: kb(i.transferSize), start: Math.round(i.networkRequestTime), end: Math.round(i.networkEndTime), prio: i.priority,
  }));
  const failed = (cat) => (lhr.categories[cat]?.auditRefs ?? []).filter((ref) => ref.weight > 0 && a[ref.id] && a[ref.id].score !== null && a[ref.id].score < 1).map((ref) => ref.id);
  const treemap = a["script-treemap-data"]?.details?.nodes ?? [];
  const docNode = treemap.find((n) => n.name === doc?.url || (n.name ?? "").startsWith(BASE));
  const inlineRsc = (docNode?.children ?? []).filter((c) => (c.name ?? "").includes("__next_f")).reduce((s, c) => s + (c.resourceBytes ?? 0), 0);
  const inlineAll = (docNode?.children ?? []).reduce((s, c) => s + (c.resourceBytes ?? 0), 0);
  const lcpBreak = a["lcp-breakdown-insight"]?.details?.items ?? [];
  const lcpNode = lcpBreak.find((i) => i.type === "node");
  const phases = lcpBreak.find((i) => i.type === "table")?.items ?? [];
  const shifts = (a["layout-shifts"]?.details?.items ?? []).map((i) => ({ score: i.score, node: i.node?.selector ?? i.node?.snippet?.slice(0, 80), causes: (i.subItems?.items ?? []).map((s) => `${s.cause ?? ""} ${s.extra?.value ?? ""}`.slice(0, 120)) }));
  const unused = (a["unused-javascript"]?.details?.items ?? []).map((i) => ({ url: i.url.split("/").pop(), totalKB: kb(i.totalBytes), wastedKB: kb(i.wastedBytes), pct: i.wastedPercent ? Math.round(i.wastedPercent) : null }));
  const bootup = (a["bootup-time"]?.details?.items ?? []).slice(0, 8).map((i) => ({ url: i.url.split("/").pop(), total: Math.round(i.total), script: Math.round(i.scripting), parse: Math.round(i.scriptParseCompile) }));
  const longTasks = (a["long-tasks"]?.details?.items ?? []).slice(0, 10).map((i) => ({ url: (i.url ?? "").split("/").pop(), start: Math.round(i.startTime), dur: Math.round(i.duration) }));
  const inspector = (a["inspector-issues"]?.details?.items ?? []).map((i) => i.issueType);
  const loadEvt = obs.observedLoad;
  return {
    tag: TAG, path, form: DESKTOP ? "desktop" : "mobile", thr: THR, run: r + 1, at: new Date().toISOString(),
    bench: Math.round(lhr.environment?.benchmarkIndex ?? 0),
    perf: Math.round((lhr.categories.performance.score ?? 0) * 100), a11y: Math.round((lhr.categories.accessibility.score ?? 0) * 100),
    bp: Math.round((lhr.categories["best-practices"].score ?? 0) * 100), seo: Math.round((lhr.categories.seo.score ?? 0) * 100),
    lcp: Math.round(a["largest-contentful-paint"].numericValue), fcp: Math.round(a["first-contentful-paint"].numericValue),
    cls: Math.round(a["cumulative-layout-shift"].numericValue * 1000) / 1000, tbt: Math.round(a["total-blocking-time"].numericValue),
    si: Math.round(a["speed-index"].numericValue),
    observed: { fcp: obs.observedFirstContentfulPaint, lcp: obs.observedLargestContentfulPaint, load: obs.observedLoad, dcl: obs.observedDomContentLoaded },
    scripts: { n: scripts.length, kb: kb(scripts.reduce((s, i) => s + i.transferSize, 0)), rawKB: kb(scripts.reduce((s, i) => s + (i.resourceSize ?? 0), 0)),
      beforeLoadN: scripts.filter((i) => i.networkEndTime <= (loadEvt ?? 1e12)).length,
      beforeObsLcpN: scripts.filter((i) => i.networkEndTime <= (obs.observedLargestContentfulPaint ?? 1e12)).length,
      beforeObsLcpKB: kb(scripts.filter((i) => i.networkEndTime <= (obs.observedLargestContentfulPaint ?? 1e12)).reduce((s, i) => s + i.transferSize, 0)) },
    doc: doc ? { kb: kb(doc.transferSize), rawKB: kb(doc.resourceSize), end: Math.round(doc.networkEndTime) } : null,
    inlineRscKB: kb(inlineRsc), inlineAllKB: kb(inlineAll),
    domSize: a["dom-size-insight"]?.details?.items?.[0]?.items?.[0]?.value?.value ?? a["dom-size"]?.numericValue ?? null,
    css, fonts, imgs,
    lcpNode: lcpNode?.snippet?.slice(0, 140) ?? lcpNode?.selector ?? "",
    lcpPhases: phases.map((p) => ({ k: p.subpart ?? p.label, ms: Math.round(p.duration ?? 0) })),
    shifts, unused, bootup, longTasks, inspector,
    failedA11y: failed("accessibility"), failedBp: failed("best-practices"),
    runtimeError: lhr.runtimeError?.code ?? null,
  };
}

const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"] });
try {
  for (const path of PATHS) {
    let ok = 0, tries = 0;
    while (ok < RUNS && tries < RUNS + 3) {
      tries++;
      let result;
      try {
        result = await lighthouse(
          `${BASE}${path}`,
          { port: chrome.port, output: "json", logLevel: "error", throttlingMethod: THR },
          DESKTOP ? { ...desktopConfig, settings: { ...desktopConfig.settings, throttlingMethod: THR } } : undefined,
        );
      } catch (e) {
        console.log(`${path} try ${tries}: threw ${e.message}`);
        continue;
      }
      const lhr = result.lhr;
      if (lhr.runtimeError || lhr.audits["total-blocking-time"].numericValue == null) {
        console.log(`${path} try ${tries}: runtimeError ${lhr.runtimeError?.code}`);
        appendFileSync(JSONL, JSON.stringify({ tag: TAG, path, thr: THR, form: DESKTOP ? "desktop" : "mobile", runtimeError: lhr.runtimeError?.code ?? "no-metrics", at: new Date().toISOString() }) + "\n");
        continue;
      }
      const s = summarize(lhr, path, ok);
      const fname = `${TAG}${path.replace(/[\/?=&]/g, "_")}-${s.form}-${THR}-${ok + 1}-${Date.now()}.json`;
      writeFileSync(join(RAW, fname), result.report);
      s.raw = fname;
      appendFileSync(JSONL, JSON.stringify(s) + "\n");
      console.log(`${path} ${s.form} ${THR} #${ok + 1} bench ${s.bench}: perf ${s.perf} a11y ${s.a11y} bp ${s.bp} · LCP ${s.lcp} FCP ${s.fcp} TBT ${s.tbt} CLS ${s.cls} · JS ${s.scripts.n}/${s.scripts.kb}KB · obs FCP/LCP/load ${Math.round(s.observed.fcp)}/${Math.round(s.observed.lcp)}/${Math.round(s.observed.load)}`);
      ok++;
    }
  }
} finally {
  await chrome.kill();
}
