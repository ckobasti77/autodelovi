import { readFileSync } from "node:fs";
import path from "node:path";

const d = JSON.parse(readFileSync(path.resolve("scripts/qa/ui-boost/tmp-b/detect-live.json"), "utf8"));
const totals = {};
for (const vp of Object.keys(d)) {
  for (const [p, r] of Object.entries(d[vp])) {
    if (r.error) continue;
    for (const f of r.findings) {
      const k = f.type;
      totals[k] ||= { n: 0, byVp: {}, pages: new Set(), details: new Map() };
      totals[k].n++;
      totals[k].byVp[vp] = (totals[k].byVp[vp] || 0) + 1;
      totals[k].pages.add(p);
      const key = `${vp} ${p} :: ${String(f.detail).slice(0, 230)} :: ${f.selector ?? ""}`;
      totals[k].details.set(key, (totals[k].details.get(key) || 0) + 1);
    }
  }
}
const first = Object.values(d)[0];
console.log("group keys:", Object.values(first)[0].firstGroupKeys);
for (const [k, t] of Object.entries(totals).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`\n## ${k}: ${t.n} ${JSON.stringify(t.byVp)} pages=${t.pages.size}`);
  let i = 0;
  for (const [det, n] of t.details) {
    if (i++ >= Number(process.argv[2] ?? 8)) break;
    console.log(`   ${n}× ${det}`);
  }
}
