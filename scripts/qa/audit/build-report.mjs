/**
 * Builds docs/qa/AUDIT.md and docs/qa/audit/findings.json from the step 21 workflow result
 * (the JSON object returned by the audit workflow: { results, reviews, critic, synthesis }).
 *
 *   node scripts/qa/audit/build-report.mjs <workflow-result.json> [extra.json]
 *
 * extra.json (optional): { date, environment: string[], e2e: string, lighthouse: string,
 *   knownItems: [{ item, owner }], notes: string[] } — hand-written context for the header.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [inPath, extraPath] = process.argv.slice(2);
if (!inPath) throw new Error("usage: build-report.mjs <workflow-result.json> [extra.json]");
const data = JSON.parse(readFileSync(inPath, "utf8"));
const extra = extraPath ? JSON.parse(readFileSync(extraPath, "utf8")) : {};

const SEV = ["P0", "P1", "P2", "P3"];
const sevIdx = (s) => (SEV.indexOf(s) < 0 ? 2 : SEV.indexOf(s));
const GROUPS = [
  { group: "visual", name: "1. Visual design & consistency" },
  { group: "motion", name: "2. Interaction & motion" },
  { group: "a11y", name: "3. Accessibility" },
  { group: "xbrowser", name: "4. Cross-browser" },
  { group: "perf", name: "5. Performance" },
  { group: "seo", name: "6. SEO" },
  { group: "copy", name: "7. Copy" },
  { group: "flows", name: "8. Flows & edge cases" },
  { group: "backend", name: "9. Backend & reliability" },
];
const TRACK_ORDER = [
  "vis-store", "vis-commerce", "vis-admin", "motion-3d", "a11y-store", "a11y-app", "xbrowser",
  "perf-lh", "perf-bundle", "perf-3d", "seo", "copy", "flows-shop", "flows-admin", "flows-import-mech",
  "backend", "e2e",
];
const trackRank = (t) => {
  const base = TRACK_ORDER.findIndex((k) => t === k || t.startsWith(`${k}-g`));
  return base < 0 ? 99 : base;
};

const results = data.results ?? [];
const synthesis = data.synthesis ?? { duplicates: [], scorecards: [], quick_wins: [], executive_summary: "" };
const reviews = data.reviews ?? [];

// ---- duplicates: merge into the kept finding (most severe severity wins)
const byKey = new Map(results.map((r) => [r.key, r]));
const mergedInto = new Map();
for (const d of synthesis.duplicates ?? []) {
  const keep = byKey.get(d.keep);
  if (!keep || keep.status !== "confirmed") continue;
  for (const k of d.merge ?? []) {
    const other = byKey.get(k);
    if (!other || other.status !== "confirmed" || k === d.keep || mergedInto.has(k)) continue;
    mergedInto.set(k, d.keep);
    keep.alsoReported = [...(keep.alsoReported ?? []), { key: k, title: other.title, route: other.route, reason: d.reason }];
    if (sevIdx(other.severity) < sevIdx(keep.severity)) keep.severity = other.severity;
  }
}
const confirmed = results.filter((r) => r.status === "confirmed" && !mergedInto.has(r.key));
const rejected = results.filter((r) => r.status !== "confirmed");

// ---- stable IDs per prefix: severity, then track order, then key
const counters = {};
confirmed
  .sort((a, b) => sevIdx(a.severity) - sevIdx(b.severity) || trackRank(a.track) - trackRank(b.track) || a.key.localeCompare(b.key))
  .forEach((f) => {
    counters[f.prefix] = (counters[f.prefix] ?? 0) + 1;
    f.id = `${f.prefix}-${String(counters[f.prefix]).padStart(2, "0")}`;
  });
const idOf = (key) => byKey.get(mergedInto.get(key) ?? key)?.id ?? key;

// ---- helpers
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const link = (e) => {
  const s = String(e).trim();
  const m = s.match(/^(docs\/qa\/)(audit\/[^\s)]+)(.*)$/);
  if (m) return `[${m[2]}](${m[2]})${m[3]}`;
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
};
const short = (s, n) => { const t = String(s ?? "").replace(/s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const bullet = (xs) => (xs ?? []).map((x) => `- ${x}`).join("\n");
const groupName = (g) => GROUPS.find((x) => x.group === g)?.name ?? g;

// ---- document
const out = [];
const date = extra.date ?? "2026-09-30";
out.push(`# SKLOP — QA audit (step 21)`);
out.push("");
out.push(
  `> Date: ${date} · Production build (\`next build\` with \`NEXT_PUBLIC_TEST_HOOKS=1\`) served by \`next start\` on :3100 (reviewers) and :3200 (isolated performance runs) · Convex dev deployment with demo data · Windows 11, 16 logical CPUs. Method: specialist reviewers per track in parallel (multi-agent workflow), then **every finding reproduced by independent verifiers** before it was recorded (P0/P1: a reproducer and a skeptic, a third tie-breaker on disagreement; P2/P3: an independent reproducer; performance timing claims re-measured on the quiet machine). Evidence: \`docs/qa/audit/\`. Scripts: \`scripts/qa/audit/\`. Findings as data: [audit/findings.json](audit/findings.json).`,
);
out.push("");
out.push(
  "Step 22 works through this list in priority order: change **Status** from `OPEN` to `FIXED` (with a re-verification note citing a command output or screenshot path) or `WONTFIX` (with a reason consistent with `pipeline/BRIEF.md`).",
);
out.push("");

// Summary
const count = (arr, s) => arr.filter((f) => f.severity === s).length;
out.push("## 1. Summary");
out.push("");
out.push(
  `**${confirmed.length} confirmed findings** — P0 ${count(confirmed, "P0")} · P1 ${count(confirmed, "P1")} · P2 ${count(confirmed, "P2")} · P3 ${count(confirmed, "P3")}. ${results.length} findings were reported; ${rejected.length} did not survive verification (Appendix A)${mergedInto.size ? ` and ${mergedInto.size} were merged into duplicates` : ""}.`,
);
out.push("");
if (synthesis.executive_summary) {
  out.push(synthesis.executive_summary);
  out.push("");
}
if (extra.notes?.length) {
  out.push(bullet(extra.notes));
  out.push("");
}
out.push("| Track | P0 | P1 | P2 | P3 | Total |");
out.push("|---|---|---|---|---|---|");
for (const g of GROUPS) {
  const fs = confirmed.filter((f) => f.group === g.group);
  out.push(`| ${g.name} | ${count(fs, "P0")} | ${count(fs, "P1")} | ${count(fs, "P2")} | ${count(fs, "P3")} | ${fs.length} |`);
}
out.push(`| **All** | **${count(confirmed, "P0")}** | **${count(confirmed, "P1")}** | **${count(confirmed, "P2")}** | **${count(confirmed, "P3")}** | **${confirmed.length}** |`);
out.push("");

if (extra.environment?.length) {
  out.push("### Setup and baseline");
  out.push("");
  out.push(bullet(extra.environment));
  out.push("");
}

// Scorecards
out.push("## 2. Scorecards");
out.push("");
out.push("| Track | Score (0–10) | Verdict |");
out.push("|---|---|---|");
for (const g of GROUPS) {
  const s = (synthesis.scorecards ?? []).find((x) => x.group === g.group);
  out.push(`| ${g.name} | ${s ? s.score : "—"} | ${esc(s?.verdict ?? "")} |`);
}
out.push("");
for (const g of GROUPS) {
  const s = (synthesis.scorecards ?? []).find((x) => x.group === g.group);
  if (!s) continue;
  out.push(`### ${g.name} — ${s.score}/10`);
  out.push("");
  out.push(`${s.verdict}`);
  out.push("");
  out.push("**Drivers**");
  out.push(bullet(s.drivers));
  out.push("");
  out.push("**Strengths**");
  out.push(bullet(s.strengths));
  out.push("");
  out.push("**Biggest gaps**");
  out.push(bullet(s.gaps));
  out.push("");
  const rs = reviews.filter((r) => r.group === g.group && r.scorecard);
  if (rs.length) {
    out.push(
      `Reviewer scores: ${rs.map((r) => `${r.track} ${r.scorecard.score}/10`).join(" · ")}.`,
    );
    out.push("");
  }
}

// Quick wins
out.push("## 3. Top 10 quick wins");
out.push("");
out.push("| # | Finding | Severity | Effort | Why |");
out.push("|---|---|---|---|---|");
(synthesis.quick_wins ?? []).slice(0, 10).forEach((q, i) => {
  const f = byKey.get(mergedInto.get(q.key) ?? q.key);
  out.push(`| ${i + 1} | [${idOf(q.key)}](#${idOf(q.key).toLowerCase()}) ${esc(f?.title ?? q.key)} | ${f?.severity ?? ""} | ${q.effort} | ${esc(q.why)} |`);
});
out.push("");

// Known items
if (extra.knownItems?.length) {
  out.push("## 4. Known open items (verified)");
  out.push("");
  out.push("| Known item | Result |");
  out.push("|---|---|");
  for (const k of extra.knownItems) {
    const matches = results.filter((r) => (r.known_item ?? "").toLowerCase().includes(k.match.toLowerCase()));
    const cells = matches.map((m) =>
      m.status === "confirmed" && !mergedInto.has(m.key)
        ? `[${m.id}](#${m.id.toLowerCase()}) ${m.severity} — ${esc(m.title)}`
        : m.status === "confirmed"
          ? `merged into ${idOf(m.key)}`
          : `not confirmed (${m.key}, Appendix A)`,
    );
    out.push(`| ${esc(k.item)} | ${cells.length ? cells.join("<br>") : esc(k.fallback ?? "see findings")} |`);
  }
  out.push("");
}

// Findings
out.push("## 5. Findings");
out.push("");
for (const s of SEV) {
  const fs = confirmed.filter((f) => f.severity === s);
  if (!fs.length) continue;
  const label = { P0: "P0 — blockers", P1: "P1 — major", P2: "P2 — minor", P3: "P3 — polish" }[s];
  out.push(`### ${label} (${fs.length})`);
  out.push("");
  for (const f of fs) {
    out.push(`#### ${f.id}`);
    out.push("");
    out.push(`**${f.title}**`);
    out.push("");
    out.push(`- **Severity:** ${f.severity}${f.reported_severity !== f.severity ? ` (reported ${f.reported_severity}, adjusted by verification)` : ""} · **Area:** ${groupName(f.group)} — ${f.area} · **Status:** OPEN`);
    out.push(`- **Route:** ${f.route}`);
    out.push(`- **Context:** ${f.context}`);
    if (f.standard) out.push(`- **Standard:** ${f.standard}`);
    if (f.known_item) out.push(`- **Known item:** ${f.known_item}`);
    out.push(`- **Reproduction:**`);
    (f.steps ?? []).forEach((st, i) => out.push(`  ${i + 1}. ${st}`));
    const corrected = (f.votes ?? []).find((v) => v.reproduced && v.corrected_steps?.length);
    if (corrected) {
      out.push(`- **Corrected reproduction (verifier):**`);
      corrected.corrected_steps.forEach((st, i) => out.push(`  ${i + 1}. ${st}`));
    }
    out.push(`- **Expected:** ${f.expected}`);
    out.push(`- **Actual:** ${f.actual}`);
    out.push(`- **Evidence:** ${(f.evidence ?? []).map(link).join(" · ")}`);
    out.push(`- **Suggested fix:** ${f.suggested_fix}`);
    out.push(
      `- **Verification:** ${(f.votes ?? [])
        .map((v) => `${v.lens} → ${v.verdict} (${v.severity}): ${short(v.notes, 320)}${v.evidence?.length ? ` [${v.evidence.slice(0, 2).map((e) => link(short(e, 160))).join(", ")}]` : ""}`)
        .join(" — ")}`,
    );
    if (f.alsoReported?.length) {
      out.push(`- **Also reported as:** ${f.alsoReported.map((a) => `${a.key} (${a.title} @ ${a.route})`).join("; ")}`);
    }
    out.push(`- _Reviewer key: ${f.key}_`);
    out.push("");
  }
}

// Appendix A
out.push("## Appendix A — reported but not confirmed");
out.push("");
out.push("Kept for transparency; step 22 does not need to act on these.");
out.push("");
out.push("| Reviewer key | Reported | Title | Outcome |");
out.push("|---|---|---|---|");
for (const r of rejected.sort((a, b) => trackRank(a.track) - trackRank(b.track) || a.key.localeCompare(b.key))) {
  const why = (r.votes ?? []).map((v) => `${v.lens}: ${v.verdict} — ${v.notes}`).join(" / ") || "no verifier verdict";
  out.push(`| ${r.key} | ${r.reported_severity} | ${esc(r.title)} | ${esc(r.status)}: ${esc(short(why, 420))} |`);
}
out.push("");

// Appendix B
out.push("## Appendix B — coverage per reviewer");
out.push("");
for (const r of [...reviews].sort((a, b) => trackRank(a.track) - trackRank(b.track))) {
  out.push(`### ${r.track} — ${r.title ?? ""}`);
  out.push("");
  if (!r.ok) {
    out.push("Review failed (no result).");
    out.push("");
    continue;
  }
  out.push(`Skills invoked: ${(r.skills_used ?? []).join(", ") || "—"}. Reviewer score: ${r.scorecard?.score ?? "—"}/10 — ${r.scorecard?.summary ?? ""}`);
  out.push("");
  out.push(bullet((r.coverage ?? []).map((c) => `**${c.target}** — ${c.detail}`)));
  out.push("");
  if (r.not_covered?.length) {
    out.push("Not covered:");
    out.push(bullet(r.not_covered));
    out.push("");
  }
}
if (data.critic) {
  out.push("### Completeness critic");
  out.push("");
  out.push(data.critic.rationale ?? "");
  out.push("");
  out.push(bullet((data.critic.gaps ?? []).map((g) => `**${g.track}** — ${g.title}: ${g.focus}`)));
  out.push("");
}

// Appendix C
out.push("## Appendix C — measurements reported by reviewers");
out.push("");
for (const r of [...reviews].sort((a, b) => trackRank(a.track) - trackRank(b.track))) {
  if (!r.ok || !r.metrics) continue;
  out.push(`### ${r.track}`);
  out.push("");
  out.push(r.metrics);
  out.push("");
}

const md = `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
writeFileSync(path.resolve("docs/qa/AUDIT.md"), md);
writeFileSync(
  path.resolve("docs/qa/audit/findings.json"),
  JSON.stringify(
    {
      generated: date,
      counts: {
        confirmed: confirmed.length,
        bySeverity: Object.fromEntries(SEV.map((s) => [s, count(confirmed, s)])),
        notConfirmed: rejected.length,
        merged: mergedInto.size,
      },
      findings: confirmed
        .sort((a, b) => sevIdx(a.severity) - sevIdx(b.severity) || a.id.localeCompare(b.id))
        .map(({ votes, ...f }) => ({ ...f, status: "OPEN", verification: votes })),
      notConfirmed: rejected,
      merged: Object.fromEntries(mergedInto),
    },
    null,
    2,
  ),
);
console.log(`AUDIT.md: ${confirmed.length} confirmed (${SEV.map((s) => `${s} ${count(confirmed, s)}`).join(", ")}), ${rejected.length} not confirmed, ${mergedInto.size} merged`);
