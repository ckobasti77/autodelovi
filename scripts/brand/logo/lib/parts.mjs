// Shared building blocks of the logo: colour variants, outlined words and the SVG wrapper.
import { simplify } from "./geo.mjs";
import { outline, sizeForCap } from "./type.mjs";

/**
 * Colour variants of the logo. One ink per variant: the logo has no accent — the orange stays the
 * site's signal colour. `navy` is the heritage colour of the company's original logo, for print,
 * documents and e-mail on white.
 */
export const THEMES = {
  night: { name: "night", ink: "#F1ECE3", bg: "#0D0F11" },
  paper: { name: "paper", ink: "#121518", bg: "#FFFFFF" },
  navy: { name: "navy", ink: "#1B2A6B", bg: "#FFFFFF" },
  black: { name: "black", ink: "#000000", bg: "#FFFFFF" },
  white: { name: "white", ink: "#FFFFFF", bg: "#0D0F11" },
};

/**
 * Outline `text` in a face at a given cap height; the origin is the left end of the baseline.
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

/** Wrap a body in an SVG document. */
export function svgDoc({ w, h, body, bg, title }) {
  const t = title ? `<title>${title}</title>` : "";
  const back = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">${t}${back}${body}</svg>`;
}

export const fill = (d, color) => (d ? `<path fill="${color}" fill-rule="evenodd" d="${d}"/>` : "");
