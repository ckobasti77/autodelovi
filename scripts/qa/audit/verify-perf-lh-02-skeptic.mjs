// perf-lh-02 skeptic: analysis only (no new Lighthouse runs). Reads existing Lighthouse JSON
// reports (finder's kept runs + verifier's runs + step 19 runs) and splits LCP into
// "CSS arrives" (network) and "CSS end -> LCP" (main-thread first parse/style/layout/paint),
// against the run's CPU benchmarkIndex. Also records protocol and request priorities.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dirs = [".lighthouse/perf-lh-audit/kept", ".lighthouse", "docs/qa/audit/verify/perf-lh"];
const files = [];
for (const d of dirs) {
  const abs = path.join(root, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (!f.endsWith(".json")) continue;
    if (!/mobile-devtools/.test(f)) continue;
    files.push(path.join(abs, f));
  }
}
const rows = [];
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  if (!j.audits || j.runtimeError) continue;
  const a = j.audits;
  const lcp = a["largest-contentful-paint"]?.numericValue;
  const fcp = a["first-contentful-paint"]?.numericValue;
  if (!lcp) continue;
  const reqs = a["network-requests"]?.details?.items ?? [];
  const doc = reqs.find((r) => r.resourceType === "Document");
  const css = reqs.filter((r) => r.resourceType === "Stylesheet");
  const fonts = reqs.filter((r) => r.resourceType === "Font");
  const imgs = reqs.filter((r) => r.resourceType === "Image" && r.networkRequestTime < 1000);
  const cssEnd = Math.max(...css.map((r) => r.networkEndTime));
  const early = fonts.filter((r) => r.networkRequestTime < 1000);
  const lt = (a["long-tasks"]?.details?.items ?? []).filter((t) => t.startTime >= cssEnd - 50).sort((x, y) => x.startTime - y.startTime);
  const first = lt[0];
  rows.push({
    file: path.relative(root, f).split(path.sep).join("/"),
    fetchTime: j.fetchTime,
    url: new URL(j.finalDisplayedUrl || j.requestedUrl).pathname,
    bench: Math.round(j.environment?.benchmarkIndex ?? 0),
    lcp: Math.round(lcp),
    fcp: Math.round(fcp),
    tbt: Math.round(a["total-blocking-time"]?.numericValue ?? 0),
    protocol: [...new Set(reqs.map((r) => r.protocol))].join(","),
    docEnd: doc ? Math.round(doc.networkEndTime) : null,
    cssStart: Math.round(Math.min(...css.map((r) => r.networkRequestTime))),
    cssEnd: Math.round(cssEnd),
    cssPrio: css.map((r) => r.priority).join(","),
    earlyFontsKB: Math.round(early.reduce((s, r) => s + r.transferSize, 0) / 102.4) / 10,
    earlyFontEnds: early.map((r) => Math.round(r.networkEndTime)).join("/"),
    earlyFontPrio: [...new Set(early.map((r) => r.priority))].join(","),
    earlyImgs: imgs.map((r) => `${(r.transferSize / 1024).toFixed(1)}KB ${r.priority} ${Math.round(r.networkRequestTime)}-${Math.round(r.networkEndTime)}`).join(" | "),
    cssEndToLcp: Math.round(lcp - cssEnd),
    firstTaskAfterCss: first ? `${Math.round(first.startTime)}+${Math.round(first.duration)}` : "",
  });
}
rows.sort((x, y) => (x.url + x.fetchTime).localeCompare(y.url + y.fetchTime));
const out = path.join(root, "docs/qa/audit/verify/perf-lh/perf-lh-02-perfskeptic.json");
fs.writeFileSync(out, JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`${r.url.padEnd(46)} ${r.fetchTime?.slice(11, 19)} b${String(r.bench).padEnd(5)} LCP ${r.lcp} FCP ${r.fcp} TBT ${String(r.tbt).padEnd(4)} ${r.protocol} doc ${r.docEnd} css ${r.cssStart}->${r.cssEnd} (${r.cssPrio}) fonts ${r.earlyFontsKB}KB ${r.earlyFontPrio} end ${r.earlyFontEnds} | cssEnd->LCP ${r.cssEndToLcp} firstTask ${r.firstTaskAfterCss} | ${r.earlyImgs} | ${r.file.split("/").pop().slice(0, 40)}`);
}
