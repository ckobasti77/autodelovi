// QA part close-ups (docs/3d/QA.md): renders the fixed close-up list from 3d/build/car.blend
// with render.py --set closeup (solo, box-fit framing) and builds two contact sheets.
// Usage: node 3d/scripts/qa-closeups.mjs [--only f04,f08] [--prefix final]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BLENDER = process.env.BLENDER_EXE;
if (!BLENDER) throw new Error("BLENDER_EXE is not set");

// [tag, nodes, azimuth, elevation]
const SHOTS = [
  ["f01-turbina", "part__turbina__main", 150, 20],
  [
    "f02-brake-corner",
    "part__kocioni-diskovi__fl,part__kocione-celjusti__fl,part__kocione-plocice__fl,part__lezaj-glavcina__fl,part__abs-senzori__fl,chassis__knuckle__fl,part__amortizeri-opruge__fl,part__ramena-selen-blokovi__fl",
    55,
    15,
  ],
  ["f03-strut", "part__amortizeri-opruge__fl", 35, 12],
  ["f04-clutch", "part__kvacilo-zamajac__main", 70, 18],
  [
    "f05-belts",
    "part__zupcasti-kais-vodena-pumpa__belt,part__zupcasti-kais-vodena-pumpa__water-pump,part__kais-alternatora__belt",
    -70,
    16,
  ],
  ["f06-radiator-fan", "part__hladnjak-ventilator__radiator,part__hladnjak-ventilator__fan", 150, 18],
  ["f07-alternator", "part__alternator__main", -150, 18],
  ["f08-starter", "part__anlaser__main", 40, 18],
  ["f09-battery", "part__akumulator__main", 35, 22],
  ["f10-headlamp", "part__farovi__l", 25, 12],
  ["f11-wheel", "part__felne-gume__fl", 70, 10],
  ["f12-gearbox", "part__menjac__main", 60, 20],
  ["f13-engine", "part__motor__block,part__motor__head,part__karter-dihtunzi__sump,part__paljenje-grejaci__coils", 25, 20],
  ["f14-intercooler", "part__interkuler__main,part__interkuler__pipes", 35, 22],
  ["f15-dpf", "part__dpf-katalizator__main,part__senzori__lambda", 60, 18],
  ["f16-rack-tierods", "part__letva-volana__main,part__spone-stabilizatori__tie-rod-l,part__spone-stabilizatori__tie-rod-r", 30, 28],
  ["f17-caliper", "part__kocione-celjusti__fl", 200, 25],
  ["f18-bellhousing", "part__menjac__main", -120, 20],
];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt("--only")?.split(",");
const prefix = opt("--prefix") ?? "final";

for (const [tag, nodes, az, el] of SHOTS) {
  if (only && !only.some((o) => tag.startsWith(o))) continue;
  const t = Date.now();
  const r = spawnSync(
    BLENDER,
    [
      "-b",
      "--factory-startup",
      path.join(ROOT, "3d/build/car.blend"),
      "--python-exit-code",
      "1",
      "-P",
      path.join(ROOT, "3d/blender/render.py"),
      "--",
      "--set",
      "closeup",
      "--solo",
      "--res",
      "1000x700",
      "--samples",
      "48",
      "--nodes",
      nodes,
      "--az",
      String(az),
      "--el",
      String(el),
      "--fill",
      "0.8",
      "--tag",
      tag,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    console.error(r.stdout.slice(-3000), r.stderr.slice(-3000));
    throw new Error(`close-up ${tag} failed`);
  }
  console.log(`${tag}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

// contact sheets: 3 x 3 tiles of 640 x 448
const outDir = path.join(ROOT, "3d/renders/preview");
mkdirSync(outDir, { recursive: true });
const tags = SHOTS.map((s) => s[0]);
for (const [si, set] of [
  [0, tags.slice(0, 9)],
  [1, tags.slice(9)],
]) {
  const tiles = [];
  for (const [i, tag] of set.entries()) {
    const file = path.join(ROOT, `3d/renders/qa/${tag}/closeup-${tag}-p0.png`);
    if (!existsSync(file)) continue;
    tiles.push({
      input: await sharp(file).resize(640, 448).toBuffer(),
      left: (i % 3) * 640,
      top: Math.floor(i / 3) * 448,
    });
  }
  const out = path.join(outDir, `${prefix}-closeups-${si}.png`);
  await sharp({ create: { width: 1920, height: 1344, channels: 3, background: "#0d0f11" } })
    .composite(tiles)
    .png()
    .toFile(out);
  console.log(`sheet ${path.relative(ROOT, out)}`);
}
