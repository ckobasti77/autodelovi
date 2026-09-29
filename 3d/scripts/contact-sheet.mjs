// QA helper: lays thumbnail masters on the DS card background (#1A1E23) in a grid for review.
// Usage: node 3d/scripts/contact-sheet.mjs <out.png> <cols> <slug> [slug...]
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [out, colsArg, ...slugs] = process.argv.slice(2);
const cols = Number(colsArg);
const cell = 320;
const rows = Math.ceil(slugs.length / cols);
const tiles = [];
for (const [i, slug] of slugs.entries()) {
  const p = resolve(ROOT, "3d/renders/thumbs", `${slug}.png`);
  if (!existsSync(p)) continue;
  tiles.push({
    input: await sharp(p)
      .resize(cell - 8, cell - 8)
      .toBuffer(),
    left: (i % cols) * cell + 4,
    top: Math.floor(i / cols) * cell + 4,
  });
}
await sharp({
  create: { width: cols * cell, height: rows * cell, channels: 4, background: "#1A1E23" },
})
  .composite(tiles)
  .png()
  .toFile(resolve(ROOT, out));
console.log(`sheet ${out}: ${tiles.length} tiles`);
