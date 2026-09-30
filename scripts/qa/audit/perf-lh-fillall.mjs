// perf-lh (step 21 audit): second pass — fills the runs the first batch lost to the runner's
// NO_NAVSTART crashes and to CPU contention (benchmarkIndex < 3000), and adds two more
// applied-throttling runs for every secondary template so every miss is backed by 3 runs.
// One Lighthouse run at a time (perf-lh-fill.mjs wraps tests/lighthouse/run.mjs --runs 1).
//
//   node scripts/qa/audit/perf-lh-fillall.mjs
import { spawnSync } from "node:child_process";

const FILL = "scripts/qa/audit/perf-lh-fill.mjs";
const HOME = "/";
const CAT = "/delovi/kocioni-diskovi";
const PROD = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const OTHERS = ["/delovi", "/pretraga?q=disk", "/vozila/volkswagen/golf/golf-7", "/delovi/kocioni-diskovi/volkswagen/golf", "/za-majstore", "/upit", "/ponuda/kocione-plocice-golf", "/kontakt"];
const MISSING_SIM = ["/delovi/kocioni-diskovi/volkswagen/golf", "/za-majstore", "/upit", "/ponuda/kocione-plocice-golf", "/kontakt"];

const plan = [
  ["home-dt", 5, "--throttling", "devtools", HOME],
  ["prod-dt", 2, "--throttling", "devtools", PROD],
  ["cat-dt", 1, "--throttling", "devtools", CAT],
  ...MISSING_SIM.map((p) => [`sim${p.replace(/\W+/g, "_")}`, 1, "--throttling", "simulate", p]),
  ...OTHERS.map((p) => [`dt${p.replace(/\W+/g, "_")}`, 2, "--throttling", "devtools", p]),
  // The runner drops a path that directly follows the boolean --desktop flag (it is read as the
  // flag's value), so the first batch lost `/` and `/delovi` on desktop: keep a value flag last.
  ["home-desk", 3, "--desktop", "--throttling", "simulate", HOME],
  ["delovi-desk", 1, "--desktop", "--throttling", "simulate", "/delovi"],
];
for (const [label, need, ...args] of plan) {
  spawnSync(process.execPath, [FILL, label, String(need), ...args], { stdio: "inherit" });
}
console.log("FILLALL DONE");
