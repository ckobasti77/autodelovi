// verify perf-lh: medians per path / form / throttling from docs/qa/audit/verify/perf-lh/lh-runs.jsonl.
// Writes docs/qa/audit/verify/perf-lh/lh-summary.txt.
import { readFileSync, writeFileSync } from "node:fs";

const F = "docs/qa/audit/verify/perf-lh/lh-runs.jsonl";
const rows = readFileSync(F, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const ok = rows.filter((r) => r.perf != null);
const errs = rows.filter((r) => r.runtimeError && r.perf == null);
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const groups = new Map();
for (const r of ok) {
  const k = `${r.path} | ${r.form} | ${r.thr}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const lines = [`Lighthouse 13.5 verify runs against :3200 (${ok.length} valid, ${errs.length} runtime errors)`, ""];
for (const [k, rs] of groups) {
  const f = (key) => `${med(rs.map((r) => r[key]))} (${rs.map((r) => r[key]).join("/")})`;
  lines.push(`${k}  n=${rs.length} bench ${rs.map((r) => r.bench).join("/")}`);
  lines.push(`  perf ${f("perf")} · a11y ${f("a11y")} · bp ${f("bp")} · LCP ${f("lcp")} · FCP ${f("fcp")} · TBT ${f("tbt")} · CLS ${rs.map((r) => r.cls).join("/")}`);
  const r0 = rs[0];
  lines.push(`  JS ${r0.scripts.n} scripts ${r0.scripts.kb} KB gz (${r0.scripts.rawKB} KB raw) · doc ${r0.doc?.kb} KB gz / ${r0.doc?.rawKB} KB raw · inline RSC ${r0.inlineRscKB} KB · failedA11y ${r0.failedA11y.join(",") || "-"} · failedBp ${r0.failedBp.join(",") || "-"}`);
  lines.push(`  observed FCP/LCP/load ${rs.map((r) => `${Math.round(r.observed.fcp)}/${Math.round(r.observed.lcp)}/${Math.round(r.observed.load)}`).join(" · ")} · scripts done before observed LCP ${rs.map((r) => `${r.scripts.beforeObsLcpN}/${r.scripts.n} (${r.scripts.beforeObsLcpKB} KB)`).join(" · ")}`);
  lines.push(`  CSS ${rs.map((r) => r.css.map((c) => `${c.start}→${c.end}`).join(",")).join(" · ")} · preloaded fonts end ${rs.map((r) => r.fonts.filter((x) => x.start < 700).map((x) => x.end).join(",")).join(" · ")}`);
  lines.push(`  unused JS ${r0.unused.map((u) => `${u.url} ${u.wastedKB}/${u.totalKB} KB`).join(", ")}`);
  lines.push(`  bootup ${r0.bootup.slice(0, 4).map((b) => `${b.url} total ${b.total} script ${b.script}`).join(", ")}`);
  lines.push(`  shifts ${JSON.stringify(r0.shifts).slice(0, 400)}`);
  lines.push(`  long tasks (run 1) ${r0.longTasks.map((t) => `${t.url.slice(0, 18) || "doc"}@${t.start}:${t.dur}`).join(" ")}`);
  lines.push("");
}
if (errs.length) lines.push(`runtime errors: ${errs.map((e) => `${e.path} ${e.runtimeError}`).join(", ")}`);
writeFileSync("docs/qa/audit/verify/perf-lh/lh-summary.txt", lines.join("\n"));
console.log(lines.join("\n"));
