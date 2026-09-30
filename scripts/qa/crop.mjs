/** Split a tall screenshot into readable segments: node scripts/qa/crop.mjs <file> <segmentHeight> [outDir] */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [file, segArg, outArg] = process.argv.slice(2);
const seg = Number(segArg ?? 1400);
const out = path.resolve(outArg ?? "test-results/crops");
mkdirSync(out, { recursive: true });
const meta = await sharp(file).metadata();
const base = path.basename(file, ".png");
for (let top = 0, i = 0; top < meta.height; top += seg, i++) {
  const height = Math.min(seg, meta.height - top);
  await sharp(file).extract({ left: 0, top, width: meta.width, height }).toFile(path.join(out, `${base}-${i}.png`));
  console.log(path.join(out, `${base}-${i}.png`));
}
