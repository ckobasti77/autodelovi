/**
 * Rebuilds the step 21 audit result ({ results, reviews, critic, synthesis }) from a workflow
 * journal.jsonl, applying the same verification rules as the workflow script. Used when the
 * workflow's own return value is unavailable (stopped early or truncated).
 *
 *   node scripts/qa/audit/from-journal.mjs <journal.jsonl> > result.json
 */
import { readFileSync } from "node:fs";

const TRACKS = {
  "perf-lh": ["PERF", "perf", "Performance — Lighthouse lab per template"],
  "perf-3d": ["PERF", "perf", "Performance — 3D runtime on a throttled profile"],
  "perf-bundle": ["PERF", "perf", "Performance — static bundle and asset analysis"],
  seo: ["SEO", "seo", "SEO — crawl of the local production build"],
  copy: ["COPY", "copy", "Copy — Serbian language, tone and formats"],
  backend: ["BE", "backend", "Backend — quality gates, authorization, data integrity, logged errors"],
  "vis-store": ["VIS", "visual", "Visual design — storefront catalog templates"],
  "vis-commerce": ["VIS", "visual", "Visual design — transactional, account, mechanics and secondary templates"],
  "vis-admin": ["VIS", "visual", "Visual design — admin panel"],
  "motion-3d": ["MOT", "motion", "Interaction and motion — text reveal, GSAP, 3D explorer, reduced motion"],
  "a11y-store": ["A11Y", "a11y", "Accessibility — storefront (WCAG 2.2 AA)"],
  "a11y-app": ["A11Y", "a11y", "Accessibility — auth, account, mechanic portal, registration, admin (WCAG 2.2 AA)"],
  xbrowser: ["XB", "xbrowser", "Cross-browser — Chromium, Firefox, WebKit"],
  "flows-shop": ["FLOW", "flows", "Flows and edge cases — ordering, inquiries, search, states"],
  "flows-admin": ["FLOW", "flows", "Flows and edge cases — admin back office"],
  "flows-import-mech": ["FLOW", "flows", "Flows and edge cases — Excel import/export, mechanics portal, notifications"],
  e2e: ["E2E", "backend", "E2E suite triage"],
};
const baseTrack = (key) => key.replace(/-g\d+$/, "");

const SEV = ["P0", "P1", "P2", "P3"];
const sevIdx = (s) => (SEV.indexOf(s) < 0 ? 2 : SEV.indexOf(s));
const medianSev = (list) => SEV[list.map(sevIdx).sort((a, b) => a - b)[Math.floor(list.length / 2)]];
const trim = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s || "");

const lines = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const label = Object.fromEntries(lines.filter((l) => l.type === "started").map((l) => [l.agentId, l.label]));
const res = lines.filter((l) => l.type === "result" && l.result).map((l) => ({ label: label[l.agentId] ?? "", r: l.result }));

// Reviews (a retry replaces a failed first attempt).
const reviewByTrack = new Map();
for (const { label: lb, r } of res) {
  const m = lb.match(/^review:(.+?)(:retry)?$/);
  if (m && r.findings) reviewByTrack.set(m[1], r);
}

// Votes per finding key, in journal order.
const votes = new Map();
for (const { label: lb, r } of res) {
  if (!lb.startsWith("verify:") || !r.verdicts) continue;
  const parts = lb.split(":");
  const last = parts.at(-1);
  const lens = last === "measure" ? "perf" : parts.at(-2) === "tie" ? "tiebreak" : last;
  for (const v of r.verdicts) {
    if (!votes.has(v.key)) votes.set(v.key, []);
    votes.get(v.key).push({
      lens,
      verdict: v.verdict,
      reproduced: !!v.reproduced,
      severity: v.severity,
      notes: trim(v.notes, 900),
      evidence: v.evidence ?? [],
      corrected_steps: v.corrected_steps ?? [],
    });
  }
}

const results = [];
const reviews = [];
for (const [track, r] of reviewByTrack) {
  const [prefix, group, title] = TRACKS[baseTrack(track)] ?? ["GEN", "backend", track];
  reviews.push({
    track, group, prefix, title, ok: true,
    scorecard: r.scorecard, coverage: r.coverage, not_covered: r.not_covered, metrics: r.metrics, skills_used: r.skills_used,
  });
  for (const f of r.findings) {
    const vs = votes.get(f.key) ?? [];
    const yes = vs.filter((v) => v.reproduced);
    const no = vs.filter((v) => !v.reproduced);
    const status = vs.length === 0 ? "unverified" : yes.length > no.length ? "confirmed" : "rejected";
    let severity = f.severity;
    if (status === "confirmed") severity = yes.length === 1 ? yes[0].severity : medianSev([f.severity, ...yes.map((v) => v.severity)]);
    results.push({ ...f, track, group, prefix, status, reported_severity: f.severity, severity, votes: vs });
  }
}
const critic = res.find((x) => x.label === "critic")?.r ?? null;
const synthesis = res.find((x) => x.label === "synthesis")?.r ?? null;
process.stdout.write(JSON.stringify({ results, reviews, critic, synthesis }, null, 1));
