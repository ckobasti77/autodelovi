// perf-lh (step 21 audit): resilient wrapper around the project's Lighthouse runner
// (tests/lighthouse/run.mjs). Runs ONE Lighthouse run per invocation of the runner (the runner
// aborts the whole batch when a run returns a runtime error such as NO_NAVSTART), renames the
// report so later runs never overwrite it, and retries until it has `need` valid runs whose CPU
// benchmarkIndex shows an uncontended machine (the audit machine is shared).
//
//   node scripts/qa/audit/perf-lh-fill.mjs <label> <need> <runner flags…> <path>
//   e.g. node scripts/qa/audit/perf-lh-fill.mjs home-dt 3 --throttling devtools /
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const RUNNER = path.join(ROOT, "tests/lighthouse/run.mjs");
const WORK = path.join(ROOT, ".lighthouse/perf-lh-audit/fill");
const KEEP = path.join(ROOT, ".lighthouse/perf-lh-audit/kept");
const LOG = path.join(ROOT, "docs/qa/audit/perf-lh/lh-fill.log");
const MIN_BENCH = Number(process.env.MIN_BENCH ?? 3000);
const [label, needStr, ...rest] = process.argv.slice(2);
const need = Number(needStr);
const maxAttempts = need * 3 + 2;
mkdirSync(WORK, { recursive: true });
mkdirSync(KEEP, { recursive: true });
const log = (s) => {
  appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${s}\n`);
  console.log(s);
};

let ok = 0;
for (let attempt = 1; attempt <= maxAttempts && ok < need; attempt++) {
  const workOut = path.join(WORK, ".lighthouse");
  mkdirSync(workOut, { recursive: true });
  for (const f of readdirSync(workOut)) renameSync(path.join(workOut, f), path.join(WORK, `stale-${Date.now()}-${f}`));
  const res = spawnSync(process.execPath, [RUNNER, "--base", "http://localhost:3200", "--runs", "1", ...rest], {
    cwd: WORK,
    encoding: "utf8",
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  const files = readdirSync(workOut).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    log(`${label} attempt ${attempt}: no report (exit ${res.status}) ${String(res.stderr).slice(0, 200)}`);
    continue;
  }
  const f = files[0];
  const j = JSON.parse(readFileSync(path.join(workOut, f), "utf8"));
  const bench = j.environment?.benchmarkIndex ?? 0;
  const err = j.runtimeError?.code ?? null;
  const tag = err ? "error" : bench < MIN_BENCH ? "contended" : "ok";
  const dest = `${label}-${Date.now()}-${tag}-${f}`;
  renameSync(path.join(workOut, f), path.join(KEEP, dest));
  const tbt = j.audits["total-blocking-time"]?.numericValue;
  const lcp = j.audits["largest-contentful-paint"]?.numericValue;
  log(`${label} attempt ${attempt}: ${tag} bench ${bench} perf ${Math.round((j.categories.performance.score ?? 0) * 100)} LCP ${Math.round(lcp ?? -1)} TBT ${Math.round(tbt ?? -1)} → ${dest}`);
  if (tag === "ok") ok++;
}
log(`${label}: ${ok}/${need} valid runs`);
