// perf-lh (step 21 audit): summarises the Lighthouse JSON reports written by perf-lh-batch.sh
// (.lighthouse/perf-lh-audit/.lighthouse/*.json) into docs/qa/audit/perf-lh/lighthouse-summary.json
// and docs/qa/audit/perf-lh/lighthouse.md. Groups by path × form factor × throttling method;
// medians + min/max spread; LCP element + phases; top long tasks / scripts; bytes; fonts.
//
//   node scripts/qa/audit/perf-lh-summarize.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(".lighthouse/perf-lh-audit");
const OUT = path.resolve("docs/qa/audit/perf-lh");
// The machine is shared: runs whose Lighthouse CPU benchmarkIndex is below this are "contended"
// (the uncontended baseline on this machine is ~4000, see earlier reports in .lighthouse/).
const MIN_BENCH = Number(process.env.MIN_BENCH ?? 3000);
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") && !e.name.startsWith("stale-") ? [path.join(d, e.name)] : [],
  );

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const min = (xs) => Math.min(...xs.filter((x) => x != null));
const max = (xs) => Math.max(...xs.filter((x) => x != null));
const short = (u) => (u ?? "").replace(/^https?:\/\/localhost:\d+/, "");

function extract(full) {
  const file = path.relative(SRC, full).replace(/\\/g, "/");
  const j = JSON.parse(readFileSync(full, "utf8"));
  const a = j.audits;
  if (j.runtimeError) return { file, runtimeError: j.runtimeError.code, fetchTime: j.fetchTime, bench: j.environment?.benchmarkIndex };
  const url = new URL(j.requestedUrl);
  const s = j.configSettings;
  const lcpB = a["lcp-breakdown-insight"]?.details?.items ?? [];
  const phasesTable = lcpB.find((x) => x.type === "table");
  const node = lcpB.find((x) => x.type === "node");
  const phases = {};
  for (const p of phasesTable?.items ?? []) phases[p.subpart] = Math.round(p.duration);
  const net = a["network-requests"]?.details?.items ?? [];
  const metricsItem = a.metrics?.details?.items?.[0] ?? {};
  const observedLoad = metricsItem.observedLoad ?? null;
  const observedLcp = metricsItem.observedLargestContentfulPaint ?? null;
  const scripts = net.filter((r) => r.resourceType === "Script");
  const fonts = net
    .filter((r) => r.resourceType === "Font")
    .map((r) => ({
      file: short(r.url).replace("/_next/static/media/", ""),
      kb: +(r.transferSize / 1024).toFixed(1),
      priority: r.priority,
      preload: !!r.isLinkPreload,
      start: Math.round(r.networkRequestTime),
    }));
  const rs = Object.fromEntries((a["resource-summary"]?.details?.items ?? []).map((i) => [i.resourceType, i]));
  const sum = (xs) => xs.reduce((t, r) => t + (r.transferSize ?? 0), 0);
  return {
    file,
    path: url.pathname + url.search,
    formFactor: s.formFactor,
    method: s.throttlingMethod,
    fetchTime: j.fetchTime,
    runtimeError: null,
    bench: j.environment?.benchmarkIndex ?? null,
    perf: j.categories.performance.score,
    a11y: j.categories.accessibility.score,
    bp: j.categories["best-practices"].score,
    seo: j.categories.seo.score,
    lcp: a["largest-contentful-paint"].numericValue,
    fcp: a["first-contentful-paint"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    si: a["speed-index"].numericValue,
    tti: a.interactive?.numericValue ?? null,
    maxFid: a["max-potential-fid"]?.numericValue ?? null,
    observedLcp,
    observedLoad,
    lcpElement: node ? { label: node.nodeLabel, selector: node.selector, snippet: node.snippet } : null,
    lcpPhases: phases,
    totalKB: +((rs.total?.transferSize ?? 0) / 1024).toFixed(1),
    requests: rs.total?.requestCount ?? null,
    scriptKB: +((rs.script?.transferSize ?? 0) / 1024).toFixed(1),
    scriptCount: rs.script?.requestCount ?? null,
    scriptBeforeLoadKB: observedLoad != null ? +(sum(scripts.filter((r) => r.networkRequestTime <= observedLoad)) / 1024).toFixed(1) : null,
    fontKB: +((rs.font?.transferSize ?? 0) / 1024).toFixed(1),
    cssKB: +((rs.stylesheet?.transferSize ?? 0) / 1024).toFixed(1),
    docKB: +((rs.document?.transferSize ?? 0) / 1024).toFixed(1),
    imageKB: +((rs.image?.transferSize ?? 0) / 1024).toFixed(1),
    fonts,
    longTasks: (a["long-tasks"]?.details?.items ?? [])
      .slice()
      .sort((x, y) => y.duration - x.duration)
      .slice(0, 6)
      .map((t) => ({ url: short(t.url) || "(doc)", ms: Math.round(t.duration), start: Math.round(t.startTime) })),
    bootup: (a["bootup-time"]?.details?.items ?? []).slice(0, 6).map((b) => ({
      url: short(b.url) || "(doc)",
      total: Math.round(b.total),
      scripting: Math.round(b.scripting),
      parse: Math.round(b.scriptParseCompile),
    })),
    mainThread: Object.fromEntries((a["mainthread-work-breakdown"]?.details?.items ?? []).map((m) => [m.group, Math.round(m.duration)])),
    mainThreadTotal: Math.round(a["mainthread-work-breakdown"]?.numericValue ?? 0),
    unusedJsKB: +(((a["unused-javascript"]?.details?.overallSavingsBytes ?? 0) / 1024)).toFixed(1),
    renderBlocking: (a["render-blocking-insight"]?.details?.items ?? []).map((r) => ({ url: short(r.url), kb: +((r.totalBytes ?? 0) / 1024).toFixed(1), ms: Math.round(r.wastedMs ?? 0) })),
    failedA11y: Object.values(a)
      .filter((x) => j.categories.accessibility.auditRefs.some((r) => r.id === x.id && r.weight > 0) && x.score === 0)
      .map((x) => x.id),
    failedSeo: Object.values(a)
      .filter((x) => j.categories.seo.auditRefs.some((r) => r.id === x.id && r.weight > 0) && x.score === 0)
      .map((x) => x.id),
    failedBp: Object.values(a)
      .filter((x) => j.categories["best-practices"].auditRefs.some((r) => r.id === x.id && r.weight > 0) && x.score === 0)
      .map((x) => x.id),
    layoutShifts: (a["layout-shifts"]?.details?.items ?? []).slice(0, 3).map((l) => ({
      score: +(l.score ?? 0).toFixed(4),
      node: l.node?.selector ?? "",
      label: (l.node?.nodeLabel ?? "").slice(0, 60),
      cause: (l.subItems?.items ?? []).map((s) => `${s.cause} ${short(s.extra?.value ?? "")}`).join("; "),
    })),
    scripts: scripts.map((r) => ({
      url: short(r.url).replace("/_next/static/chunks/", ""),
      kb: +(r.transferSize / 1024).toFixed(1),
      rawKB: +(r.resourceSize / 1024).toFixed(1),
      start: Math.round(r.networkRequestTime),
    })),
    unusedJs: (a["unused-javascript"]?.details?.items ?? []).map((u) => ({
      url: short(u.url).replace("/_next/static/chunks/", ""),
      kb: +(u.totalBytes / 1024).toFixed(1),
      unusedKB: +(u.wastedBytes / 1024).toFixed(1),
      pct: Math.round(u.wastedPercent),
    })),
    unusedCssKB: +(((a["unused-css-rules"]?.details?.overallSavingsBytes ?? 0) / 1024)).toFixed(1),
    docRawKB: +((net.find((r) => r.resourceType === "Document")?.resourceSize ?? 0) / 1024).toFixed(1),
    rscInlineKB: +(
      ((a["script-treemap-data"]?.details?.nodes ?? [])
        .find((n) => !n.name.includes("/_next/"))
        ?.children?.filter((c) => c.name.includes("__next_f"))
        .reduce((t, c) => t + c.resourceBytes, 0) ?? 0) / 1024
    ).toFixed(1),
    domElements: a["dom-size-insight"]?.details?.items?.[0]?.value?.value ?? null,
  };
}

const all = walk(SRC)
  .map(extract)
  .sort((x, y) => x.fetchTime.localeCompare(y.fetchTime));
// Applied throttling (devtools) multiplies real main-thread time by 4, so host contention goes
// straight into TBT/LCP: strict threshold. Simulated runs (Lantern) are network-model dominated
// for LCP/FCP; they keep a looser threshold (their benchmarkIndex is still recorded per run).
const MIN_BENCH_SIM = Number(process.env.MIN_BENCH_SIM ?? 1500);
const minFor = (r) => (r.method === "devtools" ? MIN_BENCH : MIN_BENCH_SIM);
const errored = all.filter((r) => r.runtimeError);
const contended = all.filter((r) => !r.runtimeError && r.bench < minFor(r));
const runs = all.filter((r) => !r.runtimeError && r.bench >= minFor(r));

const groups = new Map();
for (const r of runs) {
  const key = `${r.path} | ${r.formFactor} | ${r.method}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const NUM = ["perf", "a11y", "bp", "seo", "lcp", "fcp", "cls", "tbt", "si", "tti", "maxFid", "totalKB", "requests", "scriptKB", "scriptBeforeLoadKB", "fontKB", "mainThreadTotal", "unusedJsKB", "bench"];
const summary = [];
for (const [key, rs] of groups) {
  const g = { key, path: rs[0].path, formFactor: rs[0].formFactor, method: rs[0].method, runs: rs.length, median: {}, min: {}, max: {} };
  for (const k of NUM) {
    const xs = rs.map((r) => r[k]);
    g.median[k] = median(xs);
    g.min[k] = min(xs);
    g.max[k] = max(xs);
  }
  const phaseKeys = [...new Set(rs.flatMap((r) => Object.keys(r.lcpPhases)))];
  g.lcpPhasesMedian = Object.fromEntries(phaseKeys.map((p) => [p, median(rs.map((r) => r.lcpPhases[p] ?? 0))]));
  const labels = {};
  for (const r of rs) {
    const l = r.lcpElement ? `${r.lcpElement.snippet.slice(0, 90)} — “${(r.lcpElement.label ?? "").slice(0, 70)}”` : "(none)";
    labels[l] = (labels[l] ?? 0) + 1;
  }
  g.lcpElements = labels;
  // representative run = run whose TBT is the median (closest)
  const mt = g.median.tbt;
  const rep = rs.slice().sort((x, y) => Math.abs(x.tbt - mt) - Math.abs(y.tbt - mt))[0];
  g.representative = {
    file: rep.file,
    longTasks: rep.longTasks,
    bootup: rep.bootup,
    mainThread: rep.mainThread,
    fonts: rep.fonts,
    renderBlocking: rep.renderBlocking,
    layoutShifts: rep.layoutShifts,
    scripts: rep.scripts,
    unusedJs: rep.unusedJs,
    unusedCssKB: rep.unusedCssKB,
    docRawKB: rep.docRawKB,
    rscInlineKB: rep.rscInlineKB,
    domElements: rep.domElements,
    cssKB: rep.cssKB,
    docKB: rep.docKB,
    imageKB: rep.imageKB,
    scriptCount: rep.scriptCount,
  };
  g.failedA11y = [...new Set(rs.flatMap((r) => r.failedA11y))];
  g.failedSeo = [...new Set(rs.flatMap((r) => r.failedSeo))];
  g.failedBp = [...new Set(rs.flatMap((r) => r.failedBp))];
  g.perRun = rs.map((r) => ({ file: r.file, bench: r.bench, perf: r.perf, lcp: Math.round(r.lcp), tbt: Math.round(r.tbt), cls: +r.cls.toFixed(3), fcp: Math.round(r.fcp), si: Math.round(r.si), obsLcp: r.observedLcp }));
  summary.push(g);
}

const TEMPLATE_ORDER = ["/", "/delovi", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/pretraga?q=disk", "/vozila/volkswagen/golf/golf-7", "/delovi/kocioni-diskovi/volkswagen/golf", "/za-majstore", "/upit", "/ponuda/kocione-plocice-golf", "/kontakt"];
const cfgOrder = (g) => (g.formFactor === "mobile" ? (g.method === "devtools" ? 0 : 1) : 2);
summary.sort((x, y) => TEMPLATE_ORDER.indexOf(x.path) - TEMPLATE_ORDER.indexOf(y.path) || cfgOrder(x) - cfgOrder(y));

// Budgets (BRIEF §9 + step 22 a11y/SEO bar)
const catalog = new Set(["/delovi", "/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/pretraga?q=disk", "/vozila/volkswagen/golf/golf-7", "/delovi/kocioni-diskovi/volkswagen/golf", "/ponuda/kocione-plocice-golf"]);
for (const g of summary) {
  const m = g.median;
  const misses = [];
  if (g.formFactor === "mobile") {
    if (m.lcp > 2500) misses.push(`LCP ${Math.round(m.lcp)} > 2500`);
    if (m.cls > 0.05) misses.push(`CLS ${m.cls.toFixed(3)} > 0.05`);
    if (m.tbt > 200) misses.push(`TBT ${Math.round(m.tbt)} > 200`);
    const perfBar = g.path === "/" ? 0.85 : catalog.has(g.path) ? 0.9 : 0.85;
    if (m.perf < perfBar) misses.push(`perf ${Math.round(m.perf * 100)} < ${perfBar * 100}`);
  }
  if (m.a11y < 0.95) misses.push(`a11y ${Math.round(m.a11y * 100)} < 95`);
  if (m.seo < 0.95) misses.push(`SEO ${Math.round(m.seo * 100)} < 95`);
  g.budgetMisses = misses;
}

writeFileSync(
  path.join(OUT, "lighthouse-summary.json"),
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      source: ".lighthouse/perf-lh-audit/** (git-ignored full reports)",
      minBenchmarkIndex: { devtools: MIN_BENCH, simulateAndDesktop: MIN_BENCH_SIM },
      validRuns: runs.length,
      excluded: {
        runtimeErrors: errored.map((r) => ({ file: r.file, code: r.runtimeError, bench: r.bench })),
        contended: contended.map((r) => ({ file: r.file, bench: r.bench, perf: r.perf, lcp: Math.round(r.lcp), tbt: Math.round(r.tbt) })),
      },
      groups: summary,
    },
    null,
    1,
  ),
);

const fmt = (v, k) => {
  if (v == null || Number.isNaN(v)) return "–";
  if (["perf", "a11y", "bp", "seo"].includes(k)) return String(Math.round(v * 100));
  if (k === "cls") return v.toFixed(3);
  if (k.endsWith("KB")) return v.toFixed(0);
  return String(Math.round(v));
};
const cell = (g, k) => (g.runs > 1 ? `${fmt(g.median[k], k)} <sub>${fmt(g.min[k], k)}–${fmt(g.max[k], k)}</sub>` : fmt(g.median[k], k));
let md = `# perf-lh — Lighthouse lab per template (step 21 audit)\n\nServer: isolated \`next start\` on :3200 (production build, NEXT_PUBLIC_TEST_HOOKS=1). Lighthouse ${"13.5"} via \`tests/lighthouse/run.mjs\`, headless Chrome, fresh profile (no consent cookie → banner visible, like a first ad click). Median with min–max spread in small print. Budgets: BRIEF §9 (mobile LCP ≤ 2500 ms, CLS ≤ 0.05, TBT ≤ 200 ms, perf ≥ 85 home / ≥ 90 catalog & product) and step 22 (a11y ≥ 95, SEO ≥ 95). Generated by \`scripts/qa/audit/perf-lh-summarize.mjs\` from ${runs.length} valid runs; excluded ${errored.length} runs with a Lighthouse runtime error (NO_NAVSTART) and ${contended.length} runs whose CPU benchmarkIndex was below the threshold (applied throttling < ${MIN_BENCH}, simulated/desktop < ${MIN_BENCH_SIM}; shared machine under load; uncontended baseline on this machine ≈ 4000, see step 10–19 reports in .lighthouse/).\n\n`;
md += `| Template | Preset · method | n | Perf | A11y | BP | SEO | LCP ms | FCP ms | CLS | TBT ms | SI ms | Total KB | JS KB | Req | Budget misses |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const g of summary) {
  md += `| \`${g.path}\` | ${g.formFactor} · ${g.method} | ${g.runs} | ${cell(g, "perf")} | ${fmt(g.median.a11y, "a11y")} | ${fmt(g.median.bp, "bp")} | ${fmt(g.median.seo, "seo")} | ${cell(g, "lcp")} | ${cell(g, "fcp")} | ${fmt(g.median.cls, "cls")} | ${cell(g, "tbt")} | ${cell(g, "si")} | ${fmt(g.median.totalKB, "totalKB")} | ${fmt(g.median.scriptKB, "scriptKB")} | ${fmt(g.median.requests, "requests")} | ${g.budgetMisses.join("; ") || "—"} |\n`;
}
md += `\n## LCP element and phases (median ms)\n\n| Template | Preset · method | LCP element (runs) | TTFB | Load delay | Load time | Render delay |\n|---|---|---|---|---|---|---|\n`;
for (const g of summary) {
  const p = g.lcpPhasesMedian;
  const el = Object.entries(g.lcpElements).map(([k, v]) => `${k.replace(/\|/g, "\\|")} (${v})`).join("<br>");
  md += `| \`${g.path}\` | ${g.formFactor} · ${g.method} | ${el} | ${p.timeToFirstByte ?? "–"} | ${p.resourceLoadDelay ?? "–"} | ${p.resourceLoadDuration ?? "–"} | ${p.elementRenderDelay ?? "–"} |\n`;
}
md += `\n## Top long tasks and script boot-up (representative run = median TBT)\n\n`;
for (const g of summary.filter((x) => x.formFactor === "mobile")) {
  const r = g.representative;
  md += `- **\`${g.path}\` ${g.method}** (${r.file}): long tasks ${r.longTasks.map((t) => `${t.url} ${t.ms} ms @${t.start}`).join(", ") || "none"}; boot-up ${r.bootup.slice(0, 4).map((b) => `${b.url} ${b.total} ms`).join(", ")}; main thread ${Object.entries(r.mainThread).map(([k, v]) => `${k} ${v}`).join(", ")}\n`;
}
md += `\n## Bytes (mobile, representative run)\n\n| Template | Method | HTML KB (gz / raw) | inline RSC KB raw | CSS KB gz (unused) | JS KB gz (scripts) | JS before load KB | Fonts | DOM elements |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const g of summary.filter((x) => x.formFactor === "mobile")) {
  const r = g.representative;
  md += `| \`${g.path}\` | ${g.method} | ${r.docKB} / ${r.docRawKB} | ${r.rscInlineKB} | ${r.cssKB} (${r.unusedCssKB}) | ${fmt(g.median.scriptKB, "scriptKB")} (${r.scriptCount}) | ${fmt(g.median.scriptBeforeLoadKB, "scriptBeforeLoadKB")} | ${r.fonts.map((f) => `${f.file.replace(/-s\.p?\.?.*$/, "").slice(0, 22)} ${f.kb}${f.preload ? " pre" : ""}`).join(", ")} | ${r.domElements ?? "–"} |\n`;
}
md += `\n## Failed scored audits\n\n`;
for (const g of summary) {
  const f = [...g.failedA11y.map((x) => `a11y:${x}`), ...g.failedSeo.map((x) => `seo:${x}`), ...g.failedBp.map((x) => `bp:${x}`)];
  if (f.length) md += `- \`${g.path}\` ${g.formFactor} · ${g.method}: ${f.join(", ")}\n`;
}
md += `\n## Per-run values\n\n`;
for (const g of summary) md += `- \`${g.path}\` ${g.formFactor} · ${g.method}: ${g.perRun.map((r) => `${Math.round(r.perf * 100)}·${r.lcp}·${r.tbt}·${r.cls}·b${Math.round(r.bench)}`).join(" | ")} (perf·LCP·TBT·CLS·benchmarkIndex)\n`;
if (contended.length) md += `\nExcluded as contended (benchmarkIndex below threshold):${contended.map((r) => `${r.file} (b${Math.round(r.bench)}, TBT ${Math.round(r.tbt)})`).join(", ")}\n`;
if (errored.length) md += `\nExcluded with runtime errors: ${errored.map((r) => `${r.file} (${r.runtimeError})`).join(", ")}\n`;
md += `
## Verdicts and attribution (perf-lh reviewer notes)

- **Machine contention.** The audit machine was shared during these runs: Lighthouse's CPU benchmarkIndex ranged 790–4103 (uncontended baseline on this machine ≈ 4000 in the step 10–19 reports). Applied-throttling runs below 3000 are excluded above; the absolute TBT values of the kept runs are still somewhat inflated. For comparison, the same build (identical chunk hashes) measured uncontended in step 19 (\`.lighthouse/_delovi_kocioni-diskovi-mobile-devtools-*.json\`, bench ≈ 4070) gave category TBT 264–438 ms — the TBT budget (≤ 200 ms) is missed with or without contention.
- **Simulated (Lantern) LCP 3.9–4.6 s is an artefact of localhost + headless raster.** In every simulated run the *observed* (unthrottled) FCP and LCP are the same frame (e.g. product 151/151 ms, category 177/177 ms), and the observed \`load\` event (183–292 ms) fires *before* that first frame is presented; 23–24 of the 24–25 scripts (330–352 KB gzip) have finished downloading before the observed LCP, so Lantern models all of them as LCP dependencies and replays them over its 150 ms RTT / 1.6 Mbps link. Simulated FCP is 0.9–1.4 s for the same paint. Under applied throttling (real slow-4G + 4× CPU) LCP = FCP on every template. Verdict: not a real 4.2 s LCP; a real mobile LCP on this build is ≈ 2.0–2.6 s (applied throttling), which is itself at or over the 2.5 s budget on home/product (see findings). PageSpeed Insights on the deployed site remains the arbiter (HUMAN-TODO).
- **LCP element.** On a first visit the cookie banner paragraph („Neophodne kolačiće…“) is the LCP element on most mobile templates; it is server-rendered and painted in the first frame, so LCP = FCP. With consent already given the LCP is the RevealText lead/H1 (category, landing), a single RevealText word span on home („Rasklopi“), or the product image (product) — all painted at FCP too.
- **What gates FCP/LCP under applied throttling.** The only render-blocking stylesheet (19.7 KB gzip) is requested at ≈ 610 ms together with four preloaded fonts (≈ 80 KB) and 1–2 preloaded card images; all finish together at 1.68–1.80 s (slow 4G ≈ 180 KB/s). Then the document's first parse/style/layout(/paint) task runs 343–682 ms at 4× before the first frame. FCP = LCP = 2.0–2.6 s.
- **What makes TBT.** Per representative run: React DOM + Next runtime hydration (\`0qy3sss5e6eww.js\`, 72 KB gzip) long tasks 140–304 ms at ≈ 3.1–3.3 s and 85–235 ms at 4.8–6.4 s; the document's second style/layout task after FCP (116–282 ms); the app chunk \`25dplrt_qw3he.js\` (TextRevealGlobal/Convex/consent) 51–163 ms; GSAP ticker frames of the per-word text reveal (\`1tr6a7zmh41cy.js\`, bootup attribution 1.2–2.45 s of main-thread time per load at 4×, the largest of any script).
- **Accessibility / SEO / best practices.** Accessibility 100 and SEO 100 on every indexable template; SEO 66–69 on \`/pretraga\` and \`/ponuda\` is the intended noindex (D194, SEO-ADS §J10) — not a defect. Best practices 96 on \`/upit\`: CSP blocks zod's \`eval\` probe (see findings).
- **Desktop preset.** Performance 98–99, LCP 0.87–1.0 s, TBT 0 on every template; CLS 0.074 on the Golf 7 vehicle page (same Martian Mono swap as mobile).
`;
writeFileSync(path.join(OUT, "lighthouse.md"), md);
console.log(`runs ${runs.length}, groups ${summary.length}`);
for (const g of summary) console.log(`${g.key.padEnd(70)} n=${g.runs} perf ${fmt(g.median.perf, "perf")} lcp ${fmt(g.median.lcp, "lcp")} tbt ${fmt(g.median.tbt, "tbt")} cls ${fmt(g.median.cls, "cls")} a11y ${fmt(g.median.a11y, "a11y")} seo ${fmt(g.median.seo, "seo")} misses: ${g.budgetMisses.join("; ")}`);
