// The Euromotors Plus · OEM Parts logo — single source of the geometry (step 33, concept A „Venac
// zvezda“, approved by the owner from docs/brand/v3-zvezde/). build.mjs turns it into files, site.mjs
// into the site's path data, board.mjs draws the construction from the same numbers.
//
// The idea, from the company's original logo (docs/brand/source/euromotors-plus-current.jpg): an open
// arc of stars around the name. It starts top right, sweeps round the left and ends bottom right; the
// stars grow along the sweep, so the arc reads as motion. Under the name: a rule, PLUS, a rule, and
// „OEM Parts“ in the manner of the shop's own logo (solid OEM, outlined Parts).
//
// Units are the pixels of the approved concept board (docs/brand/v3-zvezde/build.mjs): the stacked
// lockup is drawn on its 860 × 470 field, the horizontal lockup at the size the board shows it.
// Every lockup comes out in a tight box; clear space is the layout's job (CLEAR).
import {
  bounds,
  expandStroke,
  matrix,
  poly,
  rect,
  rrect,
  samplePoints,
  simplify,
  slant,
  translate,
  union,
} from "./lib/geo.mjs";
import { THEMES, fill, svgDoc, word, wordAt } from "./lib/parts.mjs";
import { rowMinGap } from "./lib/spacing.mjs";
import { font } from "./lib/type.mjs";

export { THEMES };

// ---------------------------------------------------------------------------------------------
// The star
// ---------------------------------------------------------------------------------------------

/**
 * A crisp geometric five-point star: notches at `inner` of the tip radius, the contour softened by
 * a hairline round join (`join` × R wide, centred on the contour), so no tip is needle sharp.
 */
export const STAR = { inner: 0.46, join: 0.14 };

const rad = (deg) => (deg * Math.PI) / 180;
const num = (v) => {
  const s = Number(v.toFixed(3));
  return String(Object.is(s, -0) ? 0 : s);
};

/**
 * Star with its first tip pointing at `tipDeg` (screen angle: 0 = right, 90 = down), as path data.
 *
 * The outline is written out exactly rather than computed by a stroke expansion: the polygon grown
 * by half the join width, each tip rounded by an arc of that radius about the tip (the outer edge of
 * a round join), each notch at the point where the grown edges meet (the inner side of the join
 * lies inside the star). Ten lines and five arcs; a stroke expansion gives the same shape in about
 * four times the path data.
 */
export function star(cx, cy, R, tipDeg = -90, { inner = STAR.inner, join = STAR.join } = {}) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * inner : R;
    const a = rad(tipDeg + i * 36);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const d = (R * join) / 2;
  // Points run clockwise on screen, so (ey, −ex) is the outward normal of an edge.
  const normal = (p, q) => {
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const len = Math.hypot(ex, ey);
    return [ey / len, -ex / len];
  };
  let path = "";
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const n1 = normal(pts[(i + 9) % 10], p);
    const n2 = normal(p, pts[(i + 1) % 10]);
    const cmd = i === 0 ? "M" : "L";
    if (i % 2 === 0) {
      // tip: arc from the end of the incoming grown edge to the start of the outgoing one
      path += `${cmd}${num(p[0] + d * n1[0])} ${num(p[1] + d * n1[1])}`;
      path += `A${num(d)} ${num(d)} 0 0 1 ${num(p[0] + d * n2[0])} ${num(p[1] + d * n2[1])}`;
    } else {
      // notch: the grown edges meet at p + d (n1 + n2) / (1 + n1·n2)
      const k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
      path += `${cmd}${num(p[0] + k * (n1[0] + n2[0]))} ${num(p[1] + k * (n1[1] + n2[1]))}`;
    }
  }
  return `${path}Z`;
}

/** The same star by stroke expansion (Skia), kept to check the exact outline against. */
export function starByStroke(
  cx,
  cy,
  R,
  tipDeg = -90,
  { inner = STAR.inner, join = STAR.join } = {},
) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * inner : R;
    const a = rad(tipDeg + i * 36);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const shape = poly(pts);
  return union(shape, expandStroke(shape, R * join, { join: "round" }));
}

// ---------------------------------------------------------------------------------------------
// The arc
// ---------------------------------------------------------------------------------------------

/**
 * Where the stars of an arc sit. The sweep starts at `a0` (screen degrees: −50 is up and to the
 * right) and runs `sweep` degrees counter-clockwise, round the left, so the arc is open on the
 * right. Star i of n grows linearly from r0 to r1; the spacing eases open a little as the stars
 * grow (e = 0.65 t + 0.35 t²), so the gaps keep pace with the stars. Each star points away from
 * the centre: it is rotated to follow the arc.
 * @returns {{ x: number, y: number, R: number, tip: number, t: number }[]}
 */
export function arcStars({ cx, cy, rx, ry = rx, n, r0, r1, a0, sweep }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const e = t * t * 0.35 + t * 0.65;
    const a = a0 - sweep * e;
    out.push({
      x: cx + rx * Math.cos(rad(a)),
      y: cy + ry * Math.sin(rad(a)),
      R: r0 + (r1 - r0) * t,
      tip: a,
      t,
    });
  }
  return out;
}

/** Path data of a list of stars. The stars of an arc never touch, so no boolean union is needed. */
export const starsInk = (stars, opts) =>
  stars.map((s) => star(s.x, s.y, s.R, s.tip, opts)).join("");

/** An arc spec drawn at `size` (of its 120 box) with the box's top-left at (x, y). */
export const placeArc = (spec, x, y, size) => {
  const k = size / MARK_BOX;
  return {
    ...spec,
    cx: x + spec.cx * k,
    cy: y + spec.cy * k,
    rx: spec.rx * k,
    ry: (spec.ry ?? spec.rx) * k,
    r0: spec.r0 * k,
    r1: spec.r1 * k,
  };
};

/**
 * The arcs. `stacked` is the primary logo's arc on the board's field. The others are drawn on a
 * 120 box: `compact` is the mark of the horizontal lockup (10 stars, from 64 px), `medium` the
 * 48 px icon (7 stars) and `small` the simplified mark for 32 px and below (5 stars). Fewer stars
 * buy size: each smaller form keeps the open ring and the growth, and gives every star room to stay
 * a star instead of a dot.
 */
export const ARCS = {
  stacked: { cx: 400, cy: 236, rx: 318, ry: 212, n: 12, r0: 11, r1: 24, a0: -50, sweep: 268 },
  compact: { cx: 62, cy: 60, rx: 48, n: 10, r0: 5.5, r1: 10, a0: -44, sweep: 272 },
  medium: { cx: 61.25, cy: 60, rx: 43.75, n: 7, r0: 9.75, r1: 15, a0: -46, sweep: 262 },
  small: { cx: 61.875, cy: 60, rx: 43.125, n: 5, r0: 15, r1: 19.5, a0: -46, sweep: 256 },
};
/** The box the compact and small marks are drawn on. */
export const MARK_BOX = 120;

// ---------------------------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------------------------

/**
 * Archivo and Saira are OFL-1.1 (Omnibus-Type); see docs/brand/LOGO.md. EUROMOTORS and PLUS are
 * Archivo 800 at width 125. „OEM Parts“ is Saira Expanded Italic, black: widened and leaned a
 * further 7° (12° → 19°) to match the shop's known logo (docs/brand/source/oem-parts-current.webp);
 * „Parts“ is the outline of the same weight, its letters set at one constant distance (`air`, in
 * outline widths) so the outlines never merge.
 */
export const TYPE = {
  euro: { family: "archivo", axes: { wght: 800, wdth: 125 } },
  plus: { family: "archivo", axes: { wght: 800, wdth: 125 } },
  oem: { family: "saira-italic", axes: { wght: 900, wdth: 125 }, stretch: 1.06, lean: 7 },
  parts: {
    family: "saira-italic",
    axes: { wght: 900, wdth: 125 },
    stretch: 1.1,
    lean: 7,
    air: 0.7,
  },
};
/**
 * Manual pair corrections for EUROMOTORS and PLUS, in em, on top of the font's own kerning. They
 * even out the optical gaps measured by lib/spacing.mjs: T is loose on both sides, M and R tight.
 */
export const KERN = {
  EU: -0.013,
  UR: 0.004,
  RO: 0.005,
  OM: 0.009,
  MO: 0.008,
  OT: -0.018,
  TO: -0.018,
  OR: 0.008,
  RS: 0.007,
};
export const KERN_PLUS = { PL: 0.016, LU: -0.012, US: -0.005 };

/** Cap height of a face set at a font size (the board gives sizes; the geometry works in caps). */
export const capOf = (face, size) => {
  const f = font(face.family, face.axes);
  return (size * f.capHeight) / f.unitsPerEm;
};

const restyle = (d, t) => slant(matrix(d, [t.stretch, 0, 0, 1, 0, 0]), t.lean, 0);

/** Outlined „Parts“ on a baseline at y = 0, ink starting at x = 0. */
function outlinedParts(cap, stroke) {
  const t = TYPE.parts;
  const target = stroke * (1 + t.air);
  const glyphs = word("Parts", t, cap).glyphs.map((g) => simplify(restyle(g.d, t)));
  const step = cap / 160;
  const placed = [glyphs[0]];
  for (let i = 1; i < glyphs.length; i++) {
    const gap = rowMinGap(samplePoints(placed[i - 1], step), samplePoints(glyphs[i], step), step);
    // later glyphs keep their font position relative to the one just moved
    for (let j = i; j < glyphs.length; j++) glyphs[j] = translate(glyphs[j], target - gap, 0);
    placed.push(glyphs[i]);
  }
  const outlined = expandStroke(placed.join(""), stroke, { miterLimit: 3 });
  return translate(outlined, -bounds(outlined).x1, 0);
}

/**
 * „OEM Parts“ on one baseline, OEM solid and Parts outlined. `cap` is the cap height, `stroke` the
 * outline of Parts, `space` the word space in caps. Ink from x = 0, baseline at y = 0.
 */
export function oemPartsLine(cap, stroke, space = OEM_SPACE) {
  let oem = word("OEM", TYPE.oem, cap).d;
  oem = restyle(oem, TYPE.oem);
  oem = translate(oem, -bounds(oem).x1, 0);
  const parts = translate(outlinedParts(cap, stroke), bounds(oem).x2 + cap * space, 0);
  const d = oem + parts;
  const b = bounds(d);
  return { d, oem, parts, w: b.x2, top: b.y1 };
}
const OEM_SPACE = 0.34;

/** A word centred on x, on a baseline at y. */
function centred(text, face, cap, x, y, opts) {
  const probe = word(text, face, cap, opts);
  return word(text, face, cap, {
    ...opts,
    x: x - probe.bbox.x1 - (probe.bbox.x2 - probe.bbox.x1) / 2,
    y,
  });
}

// ---------------------------------------------------------------------------------------------
// The stacked lockup (primary): the arc of 12 stars around the name
// ---------------------------------------------------------------------------------------------

/**
 * The board's layout. The text block is centred on `x`, 80 units right of the arc's centre, as in
 * the original logo; the two rules frame PLUS and stop short of the ends of EUROMOTORS.
 */
export const STACKED = {
  arc: ARCS.stacked,
  x: 480,
  euro: { size: 60, base: 250, tracking: 0.02 },
  rule: { y: 284, h: 3, inner: 92, outer: 262 },
  plus: { size: 32, base: 299, tracking: 0.156 },
  oemParts: { size: 36, base: 352, outline: 0.085 },
};

export function stacked() {
  const L = STACKED;
  const euro = centred("EUROMOTORS", TYPE.euro, capOf(TYPE.euro, L.euro.size), L.x, L.euro.base, {
    tracking: L.euro.tracking,
    kern: KERN,
  });
  const plus = centred("PLUS", TYPE.plus, capOf(TYPE.plus, L.plus.size), L.x, L.plus.base, {
    tracking: L.plus.tracking,
    kern: KERN_PLUS,
  });
  const r = L.rule;
  const rules =
    rect(L.x - r.outer, r.y, r.outer - r.inner, r.h) +
    rect(L.x + r.inner, r.y, r.outer - r.inner, r.h);
  const cap = capOf(TYPE.oem, L.oemParts.size);
  const line = oemPartsLine(cap, cap * L.oemParts.outline);
  const sig = translate(line.d, L.x - line.w / 2, L.oemParts.base);
  return { stars: arcStars(L.arc), text: euro.d + rules + plus.d + sig, euro, plus };
}

// ---------------------------------------------------------------------------------------------
// The horizontal lockup (header): the compact mark beside a two-line block
// ---------------------------------------------------------------------------------------------

/**
 * EUROMOTORS over „PLUS — rule — OEM Parts“. The board sets the name at 46 px beside a 112 px mark,
 * PLUS and OEM Parts at 21 px, a 2 px rule with 10 px of air on each side, the second line flush
 * with both ends of the name. In caps of EUROMOTORS (C): second line 0.4565 C, baseline 1 → cap line
 * 2 = 0.431 C (the board's line boxes: line height 0.82, 7 px between the lines). The block's ink
 * is centred on the ring of the mark.
 */
export const HORIZONTAL = {
  arc: ARCS.compact,
  mark: 112, // drawn size of the 120 box
  gap: 14, // from the mark's box to the name's origin
  euro: { size: 46, tracking: 0.02 },
  line2: 21 / 46,
  lineGap: 0.431,
  plusTracking: 0.06,
  rule: 2, // board px
  ruleGap: 10, // board px, both sides
  outline: 0.085, // outline of Parts, in second-line caps
};

/**
 * The two-line block with its top-left at (x, y): x = left edge of the ink of E, y = cap line of
 * EUROMOTORS.
 */
export function wordBlock(x = 0, y = 0) {
  const H = HORIZONTAL;
  const C = capOf(TYPE.euro, H.euro.size);
  const euro = wordAt("EUROMOTORS", TYPE.euro, C, x, y + C, {
    tracking: H.euro.tracking,
    kern: KERN,
  });
  const right = euro.bbox.x2;
  const c2 = C * H.line2;
  const base2 = y + C + C * H.lineGap + c2;
  const plus = wordAt("PLUS", TYPE.plus, c2, x, base2, {
    tracking: H.plusTracking,
    kern: KERN_PLUS,
  });
  const line = oemPartsLine(c2, c2 * H.outline);
  const sig = translate(line.d, right - line.w, base2);
  const ruleX1 = plus.bbox.x2 + H.ruleGap;
  const ruleX2 = right - line.w - H.ruleGap;
  const rule = rect(ruleX1, base2 - c2 / 2 - H.rule / 2, ruleX2 - ruleX1, H.rule);
  return {
    d: euro.d + plus.d + rule + sig,
    euro,
    plus,
    C,
    c2,
    x1: x,
    x2: right,
    top: y,
    bottom: base2,
    h: base2 - y,
    base1: y + C,
    base2,
  };
}

/**
 * The stars of a mark — `compact` (10), `medium` (7) or `small` (5) — drawn at `size` with the
 * 120 box's top-left at (x, y).
 */
export const markStars = (kind, x = 0, y = 0, size = MARK_BOX) =>
  arcStars(placeArc(ARCS[kind], x, y, size));

export function horizontal() {
  const H = HORIZONTAL;
  const C = capOf(TYPE.euro, H.euro.size);
  // the name starts at its origin, H.gap after the mark's box: the E keeps its side bearing
  const lsb = word("EUROMOTORS", TYPE.euro, C, { tracking: H.euro.tracking, kern: KERN }).bbox.x1;
  const block = wordBlock(H.mark + H.gap + lsb, 0);
  // the block's ink (cap line 1 → baseline 2) centred on the ring's centre
  const ringCy = (ARCS.compact.cy * H.mark) / MARK_BOX;
  return { stars: markStars("compact", 0, block.h / 2 - ringCy, H.mark), text: block.d, block };
}

// ---------------------------------------------------------------------------------------------
// Lockups — each returns { w, h, ink } in a tight box
// ---------------------------------------------------------------------------------------------

/**
 * A drawing is type as path data plus stars as numbers; the stars are written out only at their
 * final place, so a move never runs their arcs through a path library (which would turn each arc
 * into a run of quadratic segments).
 */
function tight({ text = "", stars = [] }) {
  const b = bounds(text + starsInk(stars));
  const moved = stars.map((s) => ({ ...s, x: s.x - b.x1, y: s.y - b.y1 }));
  return {
    w: Number(b.w.toFixed(2)),
    h: Number(b.h.toFixed(2)),
    ink: (text ? translate(text, -b.x1, -b.y1) : "") + starsInk(moved),
    stars: moved,
    dx: -b.x1,
    dy: -b.y1,
  };
}

/**
 * The shop's own logo, redrawn: solid OEM over a hairline that overshoots on both sides, outlined
 * Parts hung from its right end (proportions of docs/brand/source/oem-parts-current.webp). For
 * places where only „OEM Parts“ appears.
 */
export function oemParts(h = 120) {
  const P = { ruleGap: 0.21, partsGap: 0.14, parts: 0.4, left: 0.16, right: 0.17, hair: 0.05 };
  const hair = h * P.hair;
  const cap = (h - hair) / (1 + P.ruleGap + P.partsGap + P.parts);
  let oem = restyle(word("OEM", TYPE.oem, cap).d, TYPE.oem);
  oem = translate(oem, cap * P.left - bounds(oem).x1, cap);
  const ruleX2 = bounds(oem).x2 + cap * P.right;
  const rule = rect(0, cap + cap * P.ruleGap, ruleX2, hair);
  let parts = outlinedParts(cap * P.parts, hair * 0.6);
  parts = translate(parts, ruleX2 - bounds(parts).x2, h - hair / 2);
  return oem + rule + parts;
}

export const LOCKUPS = {
  /** The primary logo: the arc of 12 stars around EUROMOTORS / — PLUS — / OEM Parts. */
  stacked() {
    return tight(stacked());
  },
  /** Compact mark + two-line block: site header, admin, e-mail, OG, documents. */
  horizontal() {
    return tight(horizontal());
  },
  /** The two-line block alone, for places where the mark already stands beside it. */
  wordmark() {
    return tight({ text: wordBlock(0, 0).d });
  },
  /** The compact mark: 10 stars. 48 px and up. */
  mark() {
    return tight({ stars: markStars("compact") });
  },
  /** The simplified mark: 5 stars. 32 px and below (favicon, phone header, admin rail). */
  markSmall() {
    return tight({ stars: markStars("small") });
  },
  /** „OEM Parts“ alone, in the shop's known arrangement. */
  oemParts() {
    return tight({ text: oemParts() });
  },
};

/**
 * Clear space on every side, in the lockup's own units: the height of its largest star (r1 × 2);
 * for the forms without stars, the cap height of their second line.
 */
export const CLEAR = {
  stacked: ARCS.stacked.r1 * 2,
  horizontal: (ARCS.compact.r1 * 2 * HORIZONTAL.mark) / MARK_BOX,
  wordmark: capOf(TYPE.euro, HORIZONTAL.euro.size) * HORIZONTAL.line2,
  mark: ARCS.compact.r1 * 2,
  markSmall: ARCS.small.r1 * 2,
  oemParts: 24,
};

/** Minimum heights: px on screen, mm in print. Below them use the next smaller lockup. */
export const MIN = {
  stacked: { px: 128, mm: 32 },
  horizontal: { px: 44, mm: 12 },
  wordmark: { px: 28, mm: 8 },
  mark: { px: 48, mm: 12 },
  markSmall: { px: 16, mm: 4 },
  oemParts: { px: 40, mm: 12 },
};

/** A lockup as an SVG document in a colour theme (transparent ground unless `bg`). */
export function lockupSvg(kind, theme, { bg = false, pad = 0, title } = {}) {
  const a = LOCKUPS[kind]();
  const t = typeof theme === "string" ? THEMES[theme] : theme;
  const body = fill(a.ink, t.ink);
  const w = Number((a.w + pad * 2).toFixed(2));
  const h = Number((a.h + pad * 2).toFixed(2));
  const inner = pad ? `<g transform="translate(${pad} ${pad})">${body}</g>` : body;
  return { svg: svgDoc({ w, h, body: inner, bg: bg ? t.bg : undefined, title }), w, h };
}

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------

/**
 * App icon tile: the night field, the compact mark (10 stars) with its ring's centre on the tile's
 * centre. `markHeight` is the share of the tile the mark's 120 box takes. Home screens show these
 * at 60 pt and more, where ten stars hold.
 */
export const ICON = { size: 512, radius: 0.22, markHeight: 0.74, maskableHeight: 0.6 };

function centredMark(size, share, kind = "compact") {
  const box = size * share;
  const arc = ARCS[kind];
  const k = box / MARK_BOX;
  // the ring's centre, not the ink's: the open side would pull the stars to the right
  return starsInk(markStars(kind, size / 2 - arc.cx * k, size / 2 - arc.cy * k, box));
}

export function iconSvg({
  rounded = true,
  markHeight = ICON.markHeight,
  size = ICON.size,
  theme = THEMES.night,
  kind = "compact",
} = {}) {
  const tile = rounded ? rrect(0, 0, size, size, size * ICON.radius) : rect(0, 0, size, size);
  return svgDoc({
    w: size,
    h: size,
    body: fill(tile, theme.bg) + fill(centredMark(size, markHeight, kind), theme.ink),
    title: "Euromotors Plus",
  });
}

/**
 * The tab icons, each drawn for its pixel grid, on the night tile.
 *
 * - 16 px: five stars drawn pixel by pixel. A vector star 5 px across is a blur; the 5 × 5 star
 *   (spike, arms, two legs) is the smallest shape still read as a star. Four of them and a 6 × 6
 *   last one, so the growth survives too. Upright: at this size a turn cannot be drawn. Placed so
 *   that no two stars touch, not even corner to corner, and the ring stays open on the right.
 * - 32 px: the small mark (5 stars), every centre on a pixel centre.
 * - 48 px: the medium mark (7 stars), every centre on a pixel centre.
 */
export const PIXEL_STARS = {
  s5: ["..#..", "..#..", "#####", ".###.", ".#.#."],
  s6: ["..##..", "..##..", "######", ".####.", ".#..#.", "#....#"],
};
export const HINTED = {
  16: {
    radius: 3.5,
    pixels: [
      ["s5", 10, 1],
      ["s5", 4, 0],
      ["s5", 1, 4],
      ["s5", 2, 11],
      ["s6", 9, 9],
    ],
  },
  32: { radius: 7, arc: "small" },
  48: { radius: 10.5, arc: "medium" },
};

/** Star centres and radii of a vector tab icon, every centre snapped to a pixel centre. */
export function hintedStars(px) {
  const k = px / MARK_BOX;
  const snap = (v) => Math.round(v - 0.5) + 0.5;
  return arcStars(ARCS[HINTED[px].arc]).map((s) => ({
    x: snap(s.x * k),
    y: snap(s.y * k),
    R: s.R * k,
    tip: s.tip,
  }));
}

/** The ink of a tab icon on its pixel grid. */
export function hintedInk(px) {
  const g = HINTED[px];
  if (!g.pixels) return starsInk(hintedStars(px));
  let d = "";
  for (const [mask, x0, y0] of g.pixels)
    PIXEL_STARS[mask].forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === "#") d += rect(x0 + x, y0 + y, 1, 1);
      }),
    );
  return union(d);
}

export function hintedIconSvg(px, theme = THEMES.night) {
  return svgDoc({
    w: px,
    h: px,
    body: fill(rrect(0, 0, px, px, HINTED[px].radius), theme.bg) + fill(hintedInk(px), theme.ink),
  });
}
