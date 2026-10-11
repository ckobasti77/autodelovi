// Shared building blocks of the logo: themes, type presets and the pieces several lockups reuse.
import { bounds, expandStroke, poly, rect, simplify, union } from "./geo.mjs";
import { outline, sizeForCap } from "./type.mjs";

export const THEMES = {
  night: { name: "night", ink: "#F1ECE3", accent: "#FF6B1A", bg: "#0D0F11" },
  paper: { name: "paper", ink: "#121518", accent: "#FF6B1A", bg: "#FFFFFF" },
  black: { name: "black", ink: "#000000", accent: "#000000", bg: "#FFFFFF" },
  white: { name: "white", ink: "#FFFFFF", accent: "#FFFFFF", bg: "#0D0F11" },
  orange: { name: "orange", ink: "#FF6B1A", accent: "#FF6B1A", bg: "#0D0F11" },
};

/** Type presets. Archivo = the site's display face; Saira Expanded Italic = the voice of the known OEM Parts logo. */
export const FACE = {
  display: { family: "archivo", axes: { wght: 800, wdth: 125 } },
  displayItalic: { family: "archivo-italic", axes: { wght: 800, wdth: 125 } },
  oem: { family: "saira-italic", axes: { wght: 800, wdth: 125 } },
  parts: { family: "saira-italic", axes: { wght: 700, wdth: 125 } },
  by: { family: "archivo-italic", axes: { wght: 500, wdth: 105 } },
};

/**
 * Outline `text` in a preset at a given cap height; the origin is the left end of the baseline.
 * Variable-font glyphs are built from overlapping contours, so the outline is resolved into simple,
 * non-overlapping shapes: every path the logo emits fills identically with evenodd and nonzero.
 */
export function word(text, face, cap, opts = {}) {
  const res = outline(text, { ...face, size: sizeForCap(face.family, face.axes, cap), ...opts });
  return { ...res, d: res.d ? simplify(res.d) : "" };
}

/** Same, but placed so that the ink starts exactly at `x` (side bearing removed). */
export function wordAt(text, face, cap, x, y, opts = {}) {
  const probe = word(text, face, cap, opts);
  return word(text, face, cap, { ...opts, x: x - probe.bbox.x1, y });
}

/**
 * The endorsement, on one line: „by“ + solid italic „OEM“ + outlined italic „Parts“.
 * `x` is the left edge of the ink, or the right edge when anchor = "end". Returns filled paths only.
 */
export function endorsement({ cap, x, y, anchor = "start", by = true, outlineWeight = 0.085 }) {
  const gapBy = cap * 0.42;
  const gapWord = cap * 0.3;
  const stroke = cap * outlineWeight;
  const build = (x0) => {
    let pen = x0;
    const solid = [];
    if (by) {
      const b = wordAt("by", FACE.by, cap * 0.74, pen, y);
      solid.push(b.d);
      pen = b.bbox.x2 + gapBy;
    }
    const o = wordAt("OEM", FACE.oem, cap, pen, y, { tracking: 0.01 });
    solid.push(o.d);
    pen = o.bbox.x2 + gapWord;
    const p = wordAt("Parts", FACE.parts, cap, pen + stroke / 2, y, { tracking: 0.045 });
    const outlined = expandStroke(p.d, stroke, { join: "miter", miterLimit: 3 });
    return { solid: solid.join(""), outlined, x1: x0, x2: bounds(outlined).x2 };
  };
  const first = build(0);
  const width = first.x2 - first.x1;
  const res = build(anchor === "end" ? x - width : x);
  return { ...res, width };
}

/**
 * The plus with one arm lifted out — the brand sign. The assembled plus would span `span` from `top`
 * down; the upper arm is raised by `lift` and is the only accent-coloured piece.
 * @returns {{ body: string, part: string, width: number, x1: number, x2: number, top: number, bottom: number }}
 */
export function liftedPlus({ cx, top, span, t = span * 0.32, lift = span * 0.14 }) {
  const a = (span - t) / 2;
  const x1 = cx - span / 2;
  const body = union(rect(x1, top + a, span, t), rect(cx - t / 2, top + a + t, t, a));
  const part = rect(cx - t / 2, top - lift, t, a);
  return { body, part, width: span, x1, x2: x1 + span, top: top - lift, bottom: top + span, arm: a, t, lift };
}

/** A parallelogram rule: a hairline with the italic's slant on both ends. */
export function slantedRule(x1, x2, y, h, slantDeg = 0) {
  const k = Math.tan((slantDeg * Math.PI) / 180) * h;
  return poly([
    [x1 + k, y],
    [x2 + k, y],
    [x2, y + h],
    [x1, y + h],
  ]);
}

/** Wrap a body in an SVG document. */
export function svgDoc({ w, h, body, bg, title }) {
  const t = title ? `<title>${title}</title>` : "";
  const back = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${t}${back}${body}</svg>`;
}

export const fill = (d, color) => (d ? `<path fill="${color}" fill-rule="evenodd" d="${d}"/>` : "");
