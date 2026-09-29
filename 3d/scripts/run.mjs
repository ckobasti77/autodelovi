// SKLOP 3D pipeline runner: rebuilds every 3D deliverable from the versioned scripts.
//
//   node 3d/scripts/run.mjs            all stages
//   node 3d/scripts/run.mjs build export optimize validate
//
// Stages: taxonomy, build, explode, export, optimize, posters, images, thumbs, validate.
// Blender runs headless from $BLENDER_EXE (pipeline/env/ENVIRONMENT.md). Each stage stops the run
// on a non-zero exit code.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BLENDER = process.env.BLENDER_EXE;
const blend = (file) => resolve(ROOT, "3d/build", file);
const py = (script) => resolve(ROOT, "3d/blender", script);

const blender = (args) => {
  if (!BLENDER) throw new Error("BLENDER_EXE is not set");
  return [BLENDER, ["-b", "--factory-startup", ...args]];
};
const node = (script, ...args) => [
  process.execPath,
  [resolve(ROOT, "3d/scripts", script), ...args],
];

const STAGES = {
  taxonomy: [node("taxonomy-json.mjs")],
  build: [
    blender(["--python-exit-code", "1", "-P", py("build.py"), "--", "--quality", "desktop"]),
    blender([
      "--python-exit-code",
      "1",
      "-P",
      py("build.py"),
      "--",
      "--quality",
      "lite",
      "--skip-textures",
    ]),
  ],
  explode: [
    blender([
      blend("car.blend"),
      "--python-exit-code",
      "1",
      "-P",
      py("explode.py"),
      "--",
      "--solve",
      "--audit",
      "--samples",
      "81",
    ]),
  ],
  export: [
    blender([
      blend("car.blend"),
      "--python-exit-code",
      "1",
      "-P",
      py("export.py"),
      "--",
      "--quality",
      "desktop",
    ]),
    blender([
      blend("car-lite.blend"),
      "--python-exit-code",
      "1",
      "-P",
      py("export.py"),
      "--",
      "--quality",
      "lite",
    ]),
  ],
  optimize: [node("optimize.mjs")],
  posters: [
    blender([
      blend("car.blend"),
      "--python-exit-code",
      "1",
      "-P",
      py("posters.py"),
      "--",
      "--set",
      "all",
    ]),
  ],
  images: [node("images.mjs")],
  thumbs: [
    blender([blend("car.blend"), "--python-exit-code", "1", "-P", py("thumbs.py")]),
    node("thumbs.mjs"),
  ],
  validate: [node("validate.mjs")],
};

const wanted = process.argv.slice(2);
const order = wanted.length ? wanted : Object.keys(STAGES);
for (const name of order) {
  const steps = STAGES[name];
  if (!steps) throw new Error(`unknown stage ${name}`);
  for (const [cmd, args] of steps) {
    const t = Date.now();
    console.log(
      `\n[3d] ${name}: ${[cmd, ...args].map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`,
    );
    const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
    if (r.status !== 0) {
      console.error(`[3d] ${name} failed (exit ${r.status})`);
      process.exit(r.status ?? 1);
    }
    console.log(`[3d] ${name} ok in ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
}
