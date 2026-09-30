/** vis-store: contact sheet of all 48 category renders on the card ground, labelled, for render-quality review. */
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const dir = path.resolve("public/images/parts");
const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
const cell = 200, cols = 8, rows = Math.ceil(files.length / cols), lab = 22;
const comps = [];
for (const [i, f] of files.entries()) {
  const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell + lab);
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell + lab}"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#1A1E23"/><stop offset="1" stop-color="#0F1114"/></radialGradient></defs><rect width="${cell}" height="${cell}" fill="url(#g)" stroke="#2a2f35"/><rect y="${cell}" width="${cell}" height="${lab}" fill="#0d0f11"/><text x="6" y="${cell + 15}" font-family="Arial" font-size="12" fill="#e8e2d6">${f.replace(".webp", "")}</text></svg>`);
  comps.push({ input: bg, left: x, top: y });
  const img = await sharp(path.join(dir, f)).resize(cell, cell).toBuffer();
  comps.push({ input: img, left: x, top: y });
}
await sharp({ create: { width: cols * cell, height: rows * (cell + lab), channels: 3, background: "#0d0f11" } })
  .composite(comps).webp({ quality: 70 }).toFile("docs/qa/audit/vis-store/renders-contact-sheet.webp");
console.log("ok", files.length);
