// Step 25 — turns the logo kit in public/brand into the files the site itself needs.
//
// Usage: node scripts/brand/logo/site.mjs   (after build.mjs)
// Output:
//   components/brand/logoPaths.ts   path data of the lockups for the inline <Logo> components
//   app/icon.svg                    512 master tile that switches to the pixel-drawn marks at tab sizes
//   app/favicon.ico                 copy of public/brand/favicon.ico (16, 32, 48 — drawn per pixel)
//   app/apple-icon.png              copy of public/brand/apple-touch-icon.png (180, opaque)
//
// The lockups with the signature are composed from two parts (mark + wordmark block) so the page ships
// the 12 KB of signature outlines once. The composition is checked here against the kit's own files:
// a difference of more than a rounding error stops the build.
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { svgToPng } from "./lib/render.mjs";
import { LOCKUP, MARK, U, hintedIconSvg, iconSvg } from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLIC = path.join(ROOT, "public/brand");
const INK = "#f1ece3";
const ACCENT = "#ff6b1a";

/** `{ w, h, ink, accent }` of a night-variant kit file (two paths at most: ink, then the plus). */
async function read(name) {
  const svg = await readFile(path.join(PUBLIC, `${name}-night.svg`), "utf8");
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!box) throw new Error(`${name}: no viewBox`);
  const paths = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})"[^>]*? d="([^"]+)"\/>/g)];
  const d = (color) => paths.find((p) => p[1] === color)?.[2] ?? "";
  if (!d(INK)) throw new Error(`${name}: no ink path`);
  return { w: Number(box[1]), h: Number(box[2]), ink: d(INK), accent: d(ACCENT) };
}

const header = await read("logo-header");
const mark = await read("mark");
const wordmark = await read("logo-wordmark");
const horizontal = await read("logo-horizontal");
const stacked = await read("logo-stacked");

// Where the two parts sit in each composed lockup (kit units; see LOCKUPS in logo.mjs).
/** The round letters rise above the cap line by this much, so the mark starts that far down. */
const rise = Number(/^M0 ([\d.]+)h/.exec(horizontal.ink)?.[1] ?? "NaN");
if (!Number.isFinite(rise)) throw new Error("horizontal lockup: cannot read the mark offset");
const LAYOUT = {
  horizontal: {
    w: horizontal.w,
    h: horizontal.h,
    mark: { x: 0, y: rise, scale: 1 },
    wordmark: { x: MARK.w * U + LOCKUP.gapMark, y: 0 },
  },
  stacked: {
    w: stacked.w,
    h: stacked.h,
    mark: { x: 0, y: 0, scale: LOCKUP.stackMark },
    wordmark: {
      x: 0,
      y: Number((MARK.h * U * LOCKUP.stackMark + LOCKUP.stackGap - rise).toFixed(2)),
    },
  },
};

// ---------------------------------------------------------------------------------------------
// Check: composed lockups == kit files
// ---------------------------------------------------------------------------------------------
const p = (d, color) => `<path fill="${color}" fill-rule="evenodd" d="${d}"/>`;
function composed(layout) {
  const m = layout.mark;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.w} ${layout.h}">` +
    `<g transform="translate(${m.x} ${m.y}) scale(${m.scale})">${p(mark.ink, INK)}${p(mark.accent, ACCENT)}</g>` +
    `<g transform="translate(${layout.wordmark.x} ${layout.wordmark.y})">${p(wordmark.ink, INK)}</g></svg>`
  );
}
/** Largest channel difference and the share of pixels that differ visibly (more than 32 of 255). */
async function compare(a, b, width) {
  const raw = (svg) =>
    sharp(svgToPng(svg, width, "#0d0f11")).raw().toBuffer({ resolveWithObject: true });
  const [x, y] = await Promise.all([raw(a), raw(b)]);
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return { worst: 255, share: 1 };
  let worst = 0;
  let off = 0;
  for (let i = 0; i < x.data.length; i++) {
    const d = Math.abs(x.data[i] - y.data[i]);
    if (d > worst) worst = d;
    if (d > 32) off++;
  }
  return { worst, share: off / x.data.length };
}
for (const [name, layout] of Object.entries(LAYOUT)) {
  const kit = await readFile(path.join(PUBLIC, `logo-${name}-night.svg`), "utf8");
  // 2× the largest size the site shows. The kit files store relative coordinates rounded to three
  // decimals, so the same edge may land a tenth of a unit apart: faint anti-aliasing differences on a
  // handful of pixels are expected, a misplaced part (hundreds of fully different pixels) is not.
  const { worst, share } = await compare(composed(layout), kit, 1600);
  if (worst > 64 || share > 0.0001)
    throw new Error(`${name}: composed lockup differs from the kit file (max ${worst}, ${share})`);
  console.log(
    `${name}: composed == kit (max channel difference ${worst} of 255, ${(share * 100).toFixed(4)} % of pixels over 32)`,
  );
}

// ---------------------------------------------------------------------------------------------
// components/brand/logoPaths.ts
// ---------------------------------------------------------------------------------------------
const ts = `/**
 * Path data of the Euromotors Plus by OEM Parts logo for the inline components in
 * \`components/brand/Logo.tsx\`. Generated by \`node scripts/brand/logo/site.mjs\` from the kit in
 * \`public/brand/\` — do not edit; change \`scripts/brand/logo/logo.mjs\` and rebuild.
 *
 * Units are the kit's own. \`ink\` takes \`currentColor\`, \`accent\` is the orange plus.
 */

/** Mark + EUROMOTORS / PLUS + rule, no signature (\`logo-header-*\`). */
export const LOGO_HEADER = {
  w: ${header.w},
  h: ${header.h},
  ink: "${header.ink}",
  accent: "${header.accent}",
} as const;

/** The bracket-E with the plus (\`mark-*\`). */
export const LOGO_MARK = {
  w: ${mark.w},
  h: ${mark.h},
  ink: "${mark.ink}",
  accent: "${mark.accent}",
} as const;

/** EUROMOTORS / PLUS — rule — by OEM Parts (\`logo-wordmark-*\`). */
export const LOGO_WORDMARK = {
  w: ${wordmark.w},
  h: ${wordmark.h},
  ink: "${wordmark.ink}",
} as const;

/** Placement of the mark and the wordmark block in the lockups that carry the signature. */
export const LOGO_LAYOUT = ${JSON.stringify(LAYOUT, null, 2).replace(/"(\w+)":/g, "$1:")} as const;
`;
await writeFile(path.join(ROOT, "components/brand/logoPaths.ts"), ts);
console.log(`components/brand/logoPaths.ts ${(Buffer.byteLength(ts) / 1024).toFixed(1)} KB`);

// ---------------------------------------------------------------------------------------------
// app/icon.svg, app/favicon.ico, app/apple-icon.png
// ---------------------------------------------------------------------------------------------
/** Shapes of a generated icon document, without the wrapper and the title. */
const shapes = (svg) => (svg.match(/<path\b[^>]*\/>/g) ?? []).join("");
const SIZE = 512;
const hinted = (px) =>
  `<g class="h${px}" transform="scale(${Number((SIZE / px).toFixed(4))})">${shapes(hintedIconSvg(px))}</g>`;
// A browser draws the icon into a tab-sized viewport, so the media queries see 16, 32 or 48 px and
// swap the vector master for the mark drawn on that pixel grid (same switch as the old icon, D53).
const iconSvgFile = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">`,
  `  <!-- Generated by scripts/brand/logo/site.mjs from scripts/brand/logo/logo.mjs. Do not edit. -->`,
  `  <title>Euromotors Plus</title>`,
  `  <style>.h16,.h32,.h48{display:none}@media (max-width:56px){.m{display:none}.h48{display:inline}}@media (max-width:40px){.h48{display:none}.h32{display:inline}}@media (max-width:24px){.h32{display:none}.h16{display:inline}}</style>`,
  `  <g class="m">${shapes(iconSvg())}</g>`,
  `  ${hinted(16)}`,
  `  ${hinted(32)}`,
  `  ${hinted(48)}`,
  `</svg>`,
  ``,
].join("\n");
await writeFile(path.join(ROOT, "app/icon.svg"), iconSvgFile);
await copyFile(path.join(PUBLIC, "favicon.ico"), path.join(ROOT, "app/favicon.ico"));
await copyFile(path.join(PUBLIC, "apple-touch-icon.png"), path.join(ROOT, "app/apple-icon.png"));
console.log("app/icon.svg, app/favicon.ico, app/apple-icon.png written");
