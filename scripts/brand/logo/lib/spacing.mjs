// Optical spacing check for a set word. For every pair of neighbouring glyphs the white space between
// them is measured row by row between the cap line and the baseline; each row is capped (an open
// shape such as T, L or the bowl of P does not count as endlessly wide) and the rows are averaged.
// The result is the "optical gap" of the pair in units of the cap height — equal numbers look equal.
import sharp from "sharp";
import { svgToPng } from "./render.mjs";

const PX = 240; // raster cap height

async function profile(d, x1, x2, capTop, baseline) {
  const scale = PX / (baseline - capTop);
  const w = Math.ceil((x2 - x1) * scale) + 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x1} ${capTop} ${w / scale} ${baseline - capTop}" width="${w}" height="${PX}"><path fill-rule="nonzero" d="${d}" fill="#000"/></svg>`;
  const { data, info } = await sharp(svgToPng(svg, w, "#FFFFFF"))
    .flatten({ background: "#FFFFFF" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const left = new Array(info.height).fill(null);
  const right = new Array(info.height).fill(null);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * ch] < 128) {
        if (left[y] === null) left[y] = x;
        right[y] = x + 1;
      }
    }
  }
  return { left, right, scale, x1 };
}

/**
 * @param {{ glyphs: {char:string,d:string}[], bbox: {x1:number,x2:number}, capHeight: number }} run  result of type.outline()
 * @param {number} baseline  y of the baseline the run was set on
 * @param {number} [clamp]   row cap, in cap heights
 * @returns {Promise<{ pair: string, gap: number }[]>}
 */
export async function opticalGaps(run, baseline, clamp = 0.32) {
  const capTop = baseline - run.capHeight;
  const x1 = run.bbox.x1 - 1;
  const x2 = run.bbox.x2 + 1;
  const glyphs = run.glyphs.filter((g) => g.d);
  const profiles = [];
  for (const g of glyphs) profiles.push(await profile(g.d, x1, x2, capTop, baseline));
  const out = [];
  for (let i = 0; i < glyphs.length - 1; i++) {
    const a = profiles[i];
    const b = profiles[i + 1];
    // skip the first and last 4 % of rows: anti-aliased edges of the cap line and the baseline
    const y0 = Math.round(PX * 0.04);
    const y1 = Math.round(PX * 0.96);
    let sum = 0;
    let n = 0;
    const aMax = Math.max(...a.right.filter((v) => v !== null));
    const bMin = Math.min(...b.left.filter((v) => v !== null));
    for (let y = y0; y < y1; y++) {
      const r = a.right[y] ?? aMax - clamp * PX;
      const l = b.left[y] ?? bMin + clamp * PX;
      sum += Math.min(Math.max(l - r, 0), clamp * PX);
      n++;
    }
    out.push({ pair: glyphs[i].char + glyphs[i + 1].char, gap: sum / n / PX });
  }
  return out;
}

/**
 * Smallest horizontal distance between two shapes, measured row by row (rows where either shape has
 * no ink are ignored). Used to set outlined letters at one constant distance from each other.
 * Synchronous: profiles come from sampling the flattened contours, not from a raster.
 */
export function rowMinGap(pointsA, pointsB, step) {
  const span = (pts) => {
    const rows = new Map();
    for (const [x, y] of pts) {
      const k = Math.round(y / step);
      const r = rows.get(k);
      if (!r) rows.set(k, [x, x]);
      else {
        if (x < r[0]) r[0] = x;
        if (x > r[1]) r[1] = x;
      }
    }
    return rows;
  };
  const a = span(pointsA);
  const b = span(pointsB);
  let min = Infinity;
  for (const [k, ra] of a) {
    const rb = b.get(k);
    if (rb) min = Math.min(min, rb[0] - ra[1]);
  }
  return min;
}
