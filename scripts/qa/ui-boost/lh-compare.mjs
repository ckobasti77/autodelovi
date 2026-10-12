/**
 * Lighthouse, old build against new build, under the same load (step 27, UI-BOOST §9):
 *   node scripts/qa/ui-boost/lh-compare.mjs [--rounds=5] [--old=http://localhost:3200] [--new=http://localhost:3100] [/ /delovi/…]
 *
 * A shared machine makes two separate Lighthouse batches incomparable: the load changes from
 * minute to minute. This script interleaves them — for each round and each path one run against
 * the old build, then one against the new — through tests/lighthouse/run.mjs (mobile, applied
 * throttling), and prints the medians side by side. In Git Bash run with MSYS_NO_PATHCONV=1.
 *
 * The old build is served from a side directory: copy `.next` of the old commit to
 * `.playwright/base-app/.next`, link `node_modules`, `public` and `lib` into it, copy
 * `package.json`, `next.config.ts`, `tsconfig.json` and `.env.local`, then
 * `next start .playwright/base-app -p 3200`.
 */
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (name, fallback) =>
  argv
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? fallback;
const rounds = Number(flag("rounds", "5"));
const builds = {
  old: flag("old", "http://localhost:3200"),
  new: flag("new", "http://localhost:3100"),
};
const paths = argv.filter((a) => a.startsWith("/"));
if (!paths.length) paths.push("/");

const METRICS = ["perf", "LCP", "TBT", "FCP", "JS", "benchmarkIndex"];
const samples = {};

function run(base, path) {
  const out = spawnSync(
    process.execPath,
    ["tests/lighthouse/run.mjs", "--base", base, "--runs", "1", "--throttling", "devtools", path],
    { encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" }, timeout: 300_000 },
  );
  const line = (out.stdout ?? "").split("\n").find((l) => / run 1: /.test(l));
  if (!line) return null;
  const pick = (name) => Number(new RegExp(`${name} (\\d+(?:\\.\\d+)?)`).exec(line)?.[1] ?? NaN);
  return Object.fromEntries(METRICS.map((m) => [m, pick(m)]));
}

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : NaN;
};

for (let round = 1; round <= rounds; round++) {
  for (const path of paths) {
    for (const [name, base] of Object.entries(builds)) {
      const result = run(base, path);
      const key = `${path} ${name}`;
      (samples[key] ??= []).push(result);
      console.log(
        `round ${round} ${name.padEnd(3)} ${path}: ${result ? METRICS.map((m) => `${m} ${result[m]}`).join(" · ") : "no valid run"}`,
      );
    }
  }
}

console.log("\nMEDIANS");
for (const path of paths) {
  for (const name of Object.keys(builds)) {
    const list = (samples[`${path} ${name}`] ?? []).filter(Boolean);
    const tbt = list.map((r) => r.TBT).sort((a, b) => a - b);
    console.log(
      `${name.padEnd(3)} ${path}: ${METRICS.map((m) => `${m} ${median(list.map((r) => r[m]))}`).join(" · ")} · TBT runs ${tbt.join(" / ")} (${list.length} runs)`,
    );
  }
}
