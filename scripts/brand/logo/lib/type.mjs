// Outlines text with fontkit: a string set in a variable-font instance becomes SVG path data
// (y down, origin at the left end of the baseline), so the logo files never contain live text.
//
// Fonts (both OFL-1.1, Omnibus-Type): Archivo and Saira, read from the @fontsource-variable packages
// (devDependencies). The `wdth` files carry both axes (wdth + wght). fontkit cannot instantiate a
// variation from a WOFF2 container, so the files are decompressed to TTF first (wawoff2).
import * as fontkit from "fontkit";
import { readFileSync } from "node:fs";
import path from "node:path";
import wawoff2 from "wawoff2";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const FILES = {
  archivo: "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
  "archivo-italic":
    "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-italic.woff2",
  saira: "node_modules/@fontsource-variable/saira/files/saira-latin-wdth-normal.woff2",
  "saira-italic": "node_modules/@fontsource-variable/saira/files/saira-latin-wdth-italic.woff2",
};

const base = new Map();
const instances = new Map();

for (const [family, file] of Object.entries(FILES)) {
  const ttf = Buffer.from(await wawoff2.decompress(readFileSync(path.join(ROOT, file))));
  base.set(family, fontkit.create(ttf));
}

/** A variable-font instance, cached. */
export function font(family, axes) {
  const key = `${family}|${JSON.stringify(axes)}`;
  if (!instances.has(key)) instances.set(key, base.get(family).getVariation(axes));
  return instances.get(key);
}

export const r = (n, p = 3) => {
  const v = Number(n.toFixed(p));
  return Object.is(v, -0) ? 0 : v;
};

/** Glyph path commands → SVG path data, scaled, flipped to y-down and translated. */
function glyphD(glyph, scale, dx, dy, p) {
  let d = "";
  for (const c of glyph.path.commands) {
    const a = c.args;
    const X = (v) => r(dx + v * scale, p);
    const Y = (v) => r(dy - v * scale, p);
    if (c.command === "moveTo") d += `M${X(a[0])} ${Y(a[1])}`;
    else if (c.command === "lineTo") d += `L${X(a[0])} ${Y(a[1])}`;
    else if (c.command === "quadraticCurveTo") d += `Q${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])}`;
    else if (c.command === "bezierCurveTo")
      d += `C${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])} ${X(a[4])} ${Y(a[5])}`;
    else if (c.command === "closePath") d += "Z";
  }
  return d;
}

/**
 * Outline `text`.
 * @param {string} text
 * @param {object} o
 * @param {string} o.family   key of FILES
 * @param {object} o.axes     e.g. { wght: 800, wdth: 125 }
 * @param {number} o.size     font size in output units (em = size)
 * @param {number} [o.tracking]  extra advance per glyph, in em
 * @param {Record<string, number>} [o.kern]  manual pair corrections in em, keyed "AV" (added to font kerning)
 * @param {number} [o.x] [o.y]  baseline origin
 * @returns {{ d: string, glyphs: {char:string,d:string,x:number,advance:number}[], width: number, advance: number,
 *             capHeight: number, xHeight: number, bbox: {x1:number,y1:number,x2:number,y2:number} }}
 */
export function outline(text, o) {
  const f = font(o.family, o.axes);
  const scale = o.size / f.unitsPerEm;
  const tracking = (o.tracking ?? 0) * o.size;
  const run = f.layout(text);
  const chars = [...text];
  let pen = o.x ?? 0;
  const y0 = o.y ?? 0;
  const glyphs = [];
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const pair = i > 0 ? (o.kern?.[chars[i - 1] + chars[i]] ?? 0) * o.size : 0;
    pen += pair;
    const gx = pen + pos.xOffset * scale;
    const d = glyphD(g, scale, gx, y0 - pos.yOffset * scale, o.precision ?? 3);
    const bb = g.bbox;
    if (d) {
      x1 = Math.min(x1, gx + bb.minX * scale);
      x2 = Math.max(x2, gx + bb.maxX * scale);
      y1 = Math.min(y1, y0 - bb.maxY * scale);
      y2 = Math.max(y2, y0 - bb.minY * scale);
    }
    glyphs.push({ char: chars[i], d, x: gx, advance: pos.xAdvance * scale });
    pen += pos.xAdvance * scale + (i < run.glyphs.length - 1 ? tracking : 0);
  });
  return {
    d: glyphs.map((g) => g.d).join(""),
    glyphs,
    advance: pen - (o.x ?? 0),
    width: x2 - x1,
    capHeight: f.capHeight * scale,
    xHeight: f.xHeight * scale,
    bbox: { x1, y1, x2, y2 },
  };
}

/** Font size that gives the requested cap height. */
export function sizeForCap(family, axes, cap) {
  const f = font(family, axes);
  return (cap * f.unitsPerEm) / f.capHeight;
}
