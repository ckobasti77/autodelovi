// Skeptic analysis for perf-lh-01: reads existing Lighthouse JSON reports (no new runs),
// recomputes TBT per long task with Lighthouse's clipping rule (FCP..TTI, 50 ms threshold),
// and attributes blocking time to URL / script.
import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);
const out = [];
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(f, "utf8"));
  const a = r.audits;
  const fcp = a["first-contentful-paint"].numericValue;
  const tti = a["interactive"]?.numericValue;
  const tbt = a["total-blocking-time"].numericValue;
  const lts = a["long-tasks"]?.details?.items ?? [];
  const perUrl = {};
  let approx = 0;
  const rows = [];
  for (const t of lts) {
    const s = t.startTime, e = t.startTime + t.duration;
    if (e < fcp || (tti && s > tti)) continue;
    const cs = Math.max(s, fcp), ce = tti ? Math.min(e, tti) : e;
    const d = ce - cs;
    const b = d > 50 ? d - 50 : 0;
    approx += b;
    const u = (t.url || "").split("/").pop().split("?")[0].slice(0, 24) || "(none)";
    perUrl[u] = (perUrl[u] || 0) + b;
    if (b > 0) rows.push(`${u}@${Math.round(s)}:${Math.round(t.duration)}→${Math.round(b)}`);
  }
  const boot = (a["bootup-time"]?.details?.items ?? []).slice(0, 4).map(i => `${(i.url||"").split("/").pop().slice(0,24)} ${Math.round(i.total)}/${Math.round(i.scripting)}`);
  const mt = (a["mainthread-work-breakdown"]?.details?.items ?? []).map(i => `${i.group}:${Math.round(i.duration)}`).join(" ");
  const line = {
    file: path.basename(f),
    dir: path.basename(path.dirname(f)),
    fetchTime: r.fetchTime,
    url: r.finalDisplayedUrl ?? r.finalUrl,
    method: r.configSettings.throttlingMethod,
    cpu: r.configSettings.throttling?.cpuSlowdownMultiplier,
    bench: r.environment?.benchmarkIndex,
    perf: Math.round((r.categories.performance?.score ?? 0) * 100),
    fcp: Math.round(fcp), lcp: Math.round(a["largest-contentful-paint"].numericValue),
    tti: tti && Math.round(tti), tbt: Math.round(tbt), tbtApprox: Math.round(approx),
    tbtByUrl: Object.fromEntries(Object.entries(perUrl).map(([k, v]) => [k, Math.round(v)])),
    blocking: rows.join(" "),
    bootup: boot.join(" | "),
    mainthread: mt,
    scriptChunks: (a["network-requests"]?.details?.items ?? []).filter(i => i.resourceType === "Script").map(i => i.url.split("/").pop()).filter(n => /^(0qy3|25dp|1tr6)/.test(n)).join(","),
  };
  out.push(line);
}
for (const l of out) {
  console.log(`${l.dir}/${l.file} ${l.fetchTime} ${l.method} cpu${l.cpu} bench ${l.bench} perf ${l.perf} FCP ${l.fcp} LCP ${l.lcp} TTI ${l.tti} TBT ${l.tbt} (recomputed ${l.tbtApprox})`);
  console.log(`   byUrl ${JSON.stringify(l.tbtByUrl)}`);
  console.log(`   blocking ${l.blocking}`);
  console.log(`   bootup ${l.bootup}`);
  console.log(`   main ${l.mainthread}`);
  console.log(`   chunks ${l.scriptChunks}`);
}
