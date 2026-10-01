// Step 22 (hero-stage, MOT-01): poster ↔ canvas parity of the stage box at phone/tablet sizes.
// Runs hero-stage-framing.mjs --raw for the poster and the live canvas (p = 0), then compares
// the two stage images: mean absolute difference per channel and the car bounding boxes.
// usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-stage-parity.mjs 390x844 768x1024
import { execFileSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const out = "docs/qa/fix/hero-stage/parity";
const sizes = process.argv.slice(2).length ? process.argv.slice(2) : ["390x844"];
const script = "scripts/qa/fix/hero-stage-framing.mjs";
for (const size of sizes) {
  const run = (extra) =>
    JSON.parse(execFileSync("node", [script, "--raw", "--out", out, ...extra, size], { encoding: "utf8" }).trim().split("\n").pop());
  const poster = run([]);
  const live = run(["--canvas"]);
  const a = await sharp(path.join(out, `stage-${size}-poster.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(path.join(out, `stage-${size}-canvas-p0.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  const n = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < n; i++) sum += Math.abs(a.data[i] - b.data[i]);
  console.log(JSON.stringify({ size, tier: live.state?.tier, posterCar: poster.car, canvasCar: live.car, meanAbsDiff: +(sum / n).toFixed(2) }));
}
