/**
 * Montage (step 27): several captures side by side in one readable image.
 *   node scripts/qa/ui-boost/montage.mjs <out.webp> [--width=360] [--height=1500] [--columns=4] <files…>
 * Each file is scaled to `width`, cropped from the top to `height` and placed left to right.
 */
import path from "node:path";

import sharp from "sharp";

const argv = process.argv.slice(2);
const flag = (name, fallback) =>
  Number(argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
const [out, ...files] = argv.filter((a) => !a.startsWith("--"));
const width = flag("width", 360);
const maxHeight = flag("height", 1500);
const columns = flag("columns", 4);
const GAP = 6;

const tiles = [];
for (const file of files) {
  const resized = await sharp(file).resize({ width }).toBuffer();
  const meta = await sharp(resized).metadata();
  const height = Math.min(meta.height, maxHeight);
  tiles.push({
    input: await sharp(resized).extract({ left: 0, top: 0, width, height }).toBuffer(),
    height,
  });
}
const rows = [];
for (let i = 0; i < tiles.length; i += columns) rows.push(tiles.slice(i, i + columns));
const rowHeights = rows.map((row) => Math.max(...row.map((t) => t.height)));
const composites = [];
let top = 0;
rows.forEach((row, r) => {
  row.forEach((tile, c) => composites.push({ input: tile.input, left: c * (width + GAP), top }));
  top += rowHeights[r] + GAP;
});
await sharp({
  create: {
    width: columns * width + (columns - 1) * GAP,
    height: top - GAP,
    channels: 4,
    background: { r: 60, g: 20, b: 80, alpha: 1 },
  },
})
  .composite(composites)
  .webp({ quality: 80 })
  .toFile(path.resolve(out));
console.log(`${out}: ${files.length} captures`);
