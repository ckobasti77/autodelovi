// Step 22 close: writes the final status of every audit finding into docs/qa/AUDIT.md and
// docs/qa/audit/findings.json.
//
// Sources, in order (a later record wins): docs/qa/fix/<package>.json in the order the packages
// finished (file mtimes, runs 1–3), then OVERRIDES (documented below and in DECISIONS D290), then
// the P1 re-verification on the production build (docs/qa/fix/close/p1-reverify.json), which is
// the only way a P1 becomes FIXED.
//
// usage: node scripts/qa/fix/close-audit-status.mjs [--dry]
import fs from "node:fs";

const dry = process.argv.includes("--dry");
const AUDIT = "docs/qa/AUDIT.md";
const FINDINGS = "docs/qa/audit/findings.json";
const P1_FILE = "docs/qa/fix/close/p1-reverify.json";
const ORDER = [
  "search-catalog-content",
  "shell-perf",
  "forms-auth",
  "backend-orders-quotes",
  "hero-3d-assets",
  "catalog-product-ui",
  "seo-content-email",
  "routing-errors-gates",
  "cart-mechanic-overlays",
  "admin-flows",
  "hero-stage",
  "admin-lists-shell",
  "cross-p1",
];

// A later WONTFIX/OPEN that concerns only an optional cross request or an assist, not the finding
// itself, does not undo the owner's verified fix (D290).
const OVERRIDES = {
  "FLOW-03": {
    status: "FIXED",
    use: "search-catalog-content",
    note: "cross-p1 declined only the optional cross request #13 (vozilo= in the SearchBox submit); the finding is fixed by search-catalog-content",
  },
  "PERF-05": {
    status: "FIXED",
    use: "shell-perf",
    note: "cross-p1 marked only the .claude/** doc update WONTFIX (agents may not edit it; owner item in HUMAN-TODO); the runtime fix is shell-perf's",
  },
  "COPY-06": {
    status: "FIXED",
    use: "routing-errors-gates",
    note: "cross-p1 reverted only cross request #41 (forbidden() in admin generateMetadata, D286); the Serbian 403/401 pages and „Nije pronađeno“ bodies are routing-errors-gates' fix",
  },
};

const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const clip = (s, n = 700) => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const inputs = read(".playwright/run3-inputs.json");
const owner = {};
for (const [p, v] of Object.entries(inputs.packages)) for (const id of v.findings) owner[id] ??= p;

const history = {};
for (const p of ORDER) {
  for (const it of read(`docs/qa/fix/${p}.json`)) (history[it.id] ??= []).push({ ...it, pkg: p });
}
const p1 = fs.existsSync(P1_FILE) ? read(P1_FILE) : {};
const extra = fs.existsSync("docs/qa/fix/close/extra.json")
  ? read("docs/qa/fix/close/extra.json")
  : {};

const json = read(FINDINGS);
const result = {};
for (const f of json.findings) {
  const h = history[f.id] ?? [];
  let last = h.at(-1) ?? null;
  let status = last?.status ?? "OPEN";
  let line;
  const ov = OVERRIDES[f.id];
  if (ov) {
    last = h.filter((x) => x.pkg === ov.use).at(-1);
    status = ov.status;
  }
  if (extra[f.id]) {
    status = extra[f.id].status;
    line = `${extra[f.id].evidence}`;
  } else if (status === "WONTFIX") {
    line = `- **Reason (step 22):** ${clip(last.summary, 500)} (docs/qa/fix/${last.pkg}.json)`;
  } else if (last) {
    const fixedBy = status === "FIXED" ? last : h.filter((x) => x.status === "FIXED").at(-1);
    const src = fixedBy ?? last;
    line = `${status === "OPEN" ? "not fixed — " : ""}${clip(src.verification)} (docs/qa/fix/${src.pkg}.json${ov ? `; ${ov.note}` : ""})`;
    if (status === "OPEN" && !fixedBy)
      line = `not fixed — ${clip(last.summary, 500)} Last check: ${clip(last.verification, 300)} (docs/qa/fix/${last.pkg}.json)`;
  } else {
    line = `not fixed — not addressed in step 22${owner[f.id] ? ` (owned by the ${owner[f.id]} package, which recorded no change for it)` : " (no fix package took it)"}.`;
  }
  if (f.severity === "P1") {
    const v = p1[f.id];
    if (v && v.status === "FIXED") {
      status = "FIXED";
      line = v.evidence;
    } else {
      status = status === "WONTFIX" ? "WONTFIX" : "OPEN";
      if (v) line = `not fixed — ${v.evidence}`;
      else if (status !== "WONTFIX")
        line = `not fixed — no re-verification on the production build yet. ${line}`;
    }
  }
  if (!line.startsWith("- **Reason")) line = `- **Re-verification (step 22):** ${line}`;
  result[f.id] = { status, line, severity: f.severity, pkg: last?.pkg ?? null };
}

// Counts
const counts = {};
for (const r of Object.values(result)) {
  counts[r.severity] ??= { FIXED: 0, WONTFIX: 0, OPEN: 0, total: 0 };
  counts[r.severity][r.status]++;
  counts[r.severity].total++;
}
const pct = (a, b) => `${((a / b) * 100).toFixed(1).replace(".", ",")} %`;
const ids = (sev, st) =>
  Object.entries(result)
    .filter(([, r]) => r.severity === sev && r.status === st)
    .map(([id]) => `[${id}](#${id.toLowerCase()})`)
    .join(", ") || "none";

// AUDIT.md
let md = fs.readFileSync(AUDIT, "utf8");
const lines = md.split("\n");
let current = null;
let touched = 0;
for (let i = 0; i < lines.length; i++) {
  const m = /^#### ([A-Z0-9]+-\d+)\s*$/.exec(lines[i]);
  if (m) {
    current = result[m[1]] ? m[1] : null;
    continue;
  }
  if (/^#{1,3} /.test(lines[i])) current = null;
  if (!current) continue;
  if (lines[i].includes("**Status:** ")) {
    lines[i] = lines[i].replace(
      /\*\*Status:\*\* (OPEN|FIXED|WONTFIX)/,
      `**Status:** ${result[current].status}`,
    );
  }
  if (/^- \*\*(Re-verification|Reason) \(step 22\):\*\*/.test(lines[i])) {
    lines.splice(i, 1);
    i--;
    continue;
  }
  if (lines[i].startsWith("- _Reviewer key:")) {
    lines.splice(i, 0, result[current].line);
    i++;
    touched++;
    current = null;
  }
}
md = lines.join("\n");

const c1 = counts.P1;
const c2 = counts.P2;
const c3 = counts.P3;
const section = `## Step 22 — resolution

Closed on 2026-10-01 after three fix runs, the performance gate and the quality gates. Every finding block below carries its final **Status** and a „Re-verification (step 22)“ line (command and key output, or an evidence path); full records are in \`docs/qa/fix/<package>.json\`. A later run's record wins, except where a later WONTFIX/OPEN concerned only an optional cross request or an assist (FLOW-03, PERF-05, COPY-06; D290). A P1 is FIXED only with a re-run of its reproduction against the production build on :3100 — [fix/close/p1-reverify.md](fix/close/p1-reverify.md).

| Severity | Total | FIXED | WONTFIX | OPEN |
|---|---|---|---|---|
| P1 | ${c1.total} | ${c1.FIXED} | ${c1.WONTFIX} | ${c1.OPEN} |
| P2 | ${c2.total} | ${c2.FIXED} (${pct(c2.FIXED, c2.total)}) | ${c2.WONTFIX} | ${c2.OPEN} |
| P3 | ${c3.total} | ${c3.FIXED} (${pct(c3.FIXED, c3.total)}) | ${c3.WONTFIX} | ${c3.OPEN} |

- Gates: performance — [docs/qa/fix/perf-gate.md](fix/perf-gate.md) (applied and simulated throttling, 3-run medians) and the P1 re-run [fix/close/perf01-lighthouse-devtools.txt](fix/close/perf01-lighthouse-devtools.txt); full e2e suite on the production build — [docs/qa/fix/e2e-final.txt](fix/e2e-final.txt) (105 passed, 27 skipped by design, 0 failed).
- P1 still open: ${ids("P1", "OPEN")}.
- P2 still open: ${ids("P2", "OPEN")}.
- P3 still open: ${ids("P3", "OPEN")}.
- Hero at 390 px: [fix/close/hero-390-poster.webp](fix/close/hero-390-poster.webp).

`;
md = md.replace(/## Step 22 — resolution\n[\s\S]*?(?=## 1\. Summary)/, "");
md = md.replace(/## 1\. Summary/, `${section}## 1. Summary`);

// findings.json
for (const f of json.findings) {
  const r = result[f.id];
  f.status = r.status;
  f.resolution = {
    step: 22,
    date: "2026-10-01",
    status: r.status,
    package: r.pkg,
    note: r.line.replace(/^- \*\*(Re-verification|Reason) \(step 22\):\*\* /, ""),
  };
}
json.counts.step22 = counts;

console.log(JSON.stringify({ counts, blocksTouched: touched }, null, 0));
if (!dry) {
  fs.writeFileSync(AUDIT, md);
  fs.writeFileSync(FINDINGS, JSON.stringify(json, null, 2));
}
