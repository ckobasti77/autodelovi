// perf-3d-01 skeptic verifier (analysis only, no browser): re-reads the finder's and the
// measurement verifier's JSON evidence and splits the 3D-start long tasks into the first run
// of each browser launch (cold GPU program cache) and the later runs (same browser = warm cache;
// perf-3d-frames.mjs and perf-3d-profile.mjs launch ONE browser and open a new context per run).
//
//   node scripts/qa/audit/perf-3d-01-perfskeptic.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const A = "docs/qa/audit";
const out = [];
const log = (s = "") => out.push(s);

const frames = [
  ["finder desktop 1x", `${A}/perf-3d/frames-desktop-cpu1-gpu.json`],
  ["finder desktop 4x", `${A}/perf-3d/frames-desktop-cpu4-gpu.json`],
  ["finder mobile 4x", `${A}/perf-3d/frames-mobile-cpu4-gpu.json`],
  ["finder mobile 6x", `${A}/perf-3d/frames-mobile-cpu6-gpu.json`],
  ["verifier desktop 4x", `${A}/verify/perf-lh/3d/frames-verify-desktop-cpu4-gpu.json`],
  ["verifier mobile 4x", `${A}/verify/perf-lh/3d/frames-verify-mobile-cpu4-gpu.json`],
];

log("# perf-3d-01 skeptic — start long tasks per run (one browser per series: run 0 = cold GPU program cache, runs 1-2 = warm)");
log("# order of tasks = chronological; position ~3 at 4x = canvas chunk evaluation (turbopack H), the big run-0 task = PMREM GGX compile");
for (const [label, file] of frames) {
  const runs = JSON.parse(readFileSync(file, "utf8"));
  log(`\n## ${label}  (${file})`);
  for (const r of runs) {
    const s = r.start ?? {};
    const tasks = (s.longTasks ?? []).map((t) => Math.round(t.d));
    const worst = tasks.length ? Math.max(...tasks) : 0;
    const cache = r.run === 0 ? "COLD" : "warm";
    log(
      `run ${r.run} [${cache}] intent→firstDraw ${s.firstDrawAfterIntent ?? "-"} ms · intent→ready ${s.readyAfterIntent ?? "-"} ms · tasks ${tasks.join(",")} · worst ${worst} · tbt ${s.tbt ?? "-"}`,
    );
  }
}

const cold = JSON.parse(readFileSync(`${A}/perf-3d/frames-mobile-cpu4-gpu-cold.json`, "utf8"));
log("\n## finder mobile 4x, first scroll = intent (main-thread rAF gaps, not compositor scroll)");
for (const r of cold) {
  log(`run ${r.run} [${r.run === 0 ? "COLD" : "warm"}] worst rAF gap ${r.worst} ms · worst long task while scrolling ${r.worstLongScroll} ms · long tasks ${r.longTasksScroll} · >33 ms ${r.over33pct} %`);
}

const profiles = [
  ["finder desktop 1x (3 separate launches)", `${A}/perf-3d/profile-start-desktop-cpu1-gpu.json`],
  ["finder desktop 4x", `${A}/perf-3d/profile-start-desktop-cpu4-gpu.json`],
  ["finder mobile 4x", `${A}/perf-3d/profile-start-mobile-cpu4-gpu.json`],
  ["verifier desktop 1x", `${A}/verify/perf-lh/3d/profile-start-desktop-cpu1-gpu.json`],
  ["verifier desktop 4x", `${A}/verify/perf-lh/3d/profile-start-desktop-cpu4-gpu.json`],
];
log("\n## CPU profiles: getProgramParameter self time inside fromEquirectangular (PMREM) and inside the first frame (compileAsync/render)");
for (const [label, file] of profiles) {
  let runs;
  try {
    runs = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    log(`${label}: missing ${file}`);
    continue;
  }
  for (const r of runs) {
    for (const st of r.summary ?? []) {
      const gpp = (st.self ?? []).find((x) => x.includes("getProgramParameter"));
      const incl = st.inclusiveNamed ?? [];
      const pmrem = incl.some((x) => x.includes("fromEquirectangular"));
      const compile = incl.some((x) => x.includes("compileAsync"));
      const chunk = (st.self ?? []).find((x) => x.includes("turbopack"));
      if (!gpp && !chunk) continue;
      const gppMs = gpp ? parseInt(gpp, 10) : 0;
      if (gppMs < 40 && !chunk) continue;
      const what = pmrem ? "PMREM" : compile ? "first frame/compile" : chunk ? "chunk eval" : "render";
      log(`${label} run ${r.run} cpu${r.cpu}: stretch +${st.at} ms ${st.ms} ms · ${what} · ${gpp ?? "-"}${chunk ? " · " + chunk : ""}`);
    }
  }
}

mkdirSync(`${A}/verify/perf-3d`, { recursive: true });
writeFileSync(`${A}/verify/perf-3d/perf-3d-01-perfskeptic.txt`, out.join("\n") + "\n");
console.log(out.join("\n"));
