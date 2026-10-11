// The Euromotors Plus by OEM Parts logo — single source of the geometry.
// Everything is computed from a handful of numbers on one grid; build.mjs turns it into files and
// board.mjs draws the construction from the same numbers.
//
// Grid: the unit is u. The mark is 16u × 20u; the cap height of EUROMOTORS is C = 20u / 1.86, so the
// mark spans the two-line wordmark block exactly (cap line of EUROMOTORS → baseline of the second line).
//
// One stroke logic, taken from the letters of EUROMOTORS (Archivo 800, expanded):
//   stem  S = 0.2974 C → the spine of the bracket                         (3.2u)
//   arm   A = 0.2170 C → the arms of the bracket and the bars of the plus (2.33u)
//   hair  S / 5        → the rule, the divider and the outline of „Parts“
import {
  bounds,
  expandStroke,
  matrix,
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

export { THEMES };

// ---------------------------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------------------------
export const U = 10; // one grid unit in SVG user units
export const STEM = 0.2974; // vertical stem of Archivo 800 / wdth 125 capitals, in cap heights (measured)
export const ARM = 0.217; // horizontal arm of the same capitals (measured)
export const MARK = {
  w: 16, // bracket width
  h: 20, // bracket height
  spine: 3.2, // = S
  arm: 2.33, // = A
  plusSpan: 9,
  plusH: 2.33, // horizontal bar = A
  plusV: 2.47, // vertical bar 6 % heavier, so both bars look the same weight
  seat: 1, // gap between the spine and the plus: the part sits against its housing
};
export const LOCKUP = {
  gapMark: 5 * U, // mark → wordmark
  line2: 0.56, // cap height of the second line, in C
  lineGap: 0.3, // baseline of line 1 → cap line of line 2, in C
  ruleGap: 0.5, // space on both sides of the hairline, in second-line cap heights
  stackGap: 6 * U, // mark → wordmark in the stacked lockup
  stackMark: 1.25, // scale of the mark in the stacked lockup
  dualGap: 0.62, // space on both sides of the divider in the dual lockup, in C
};
export const C = (MARK.h * U) / (1 + LOCKUP.lineGap + LOCKUP.line2); // cap height of EUROMOTORS: 107.53
export const HAIR = (STEM * C) / 5; // 6.4

/** Clear space on every side = the plus (9u). */
export const CLEAR = MARK.plusSpan * U;
/** Minimum heights: px on screen, mm in print. Below them use the next smaller lockup. */
export const MIN = {
  horizontal: { px: 56, mm: 14 },
  header: { px: 28, mm: 8 },
  stacked: { px: 120, mm: 30 },
  wordmark: { px: 48, mm: 12 },
  mark: { px: 16, mm: 5 },
  dual: { px: 48, mm: 14 },
  oemParts: { px: 40, mm: 12 },
};

/** Type. Archivo and Saira are OFL-1.1 (Omnibus-Type); see docs/brand/LOGO.md. */
export const TYPE = {
  euro: { family: "archivo", axes: { wght: 800, wdth: 125 }, tracking: 0.02 },
  plus: { family: "archivo", axes: { wght: 800, wdth: 125 }, tracking: 0.085 },
  // The OEM Parts signature: Saira Expanded Italic, widened and leaned further (12° → 19°) to match the
  // known logo. „Parts“ is the outline of the black weight; its outline is the lockup's hairline and its
  // letters stand at one constant distance (`air`, in outline widths), so the outlines never merge.
  by: { family: "saira-italic", axes: { wght: 500, wdth: 110 }, scale: 0.74, stretch: 1.04, lean: 7 },
  oem: { family: "saira-italic", axes: { wght: 800, wdth: 125 }, stretch: 1.1, lean: 7 },
  parts: { family: "saira-italic", axes: { wght: 900, wdth: 125 }, stretch: 1.14, lean: 7, air: 0.7 },
};
/**
 * Manual pair corrections, in em, on top of the font's own kerning. They even out the optical gaps
 * measured by lib/spacing.mjs: T is loose on both sides, M and R tight (see docs/brand/LOGO.md).
 */
export const KERN = { EU: -0.013, UR: 0.004, RO: 0.005, OM: 0.009, MO: 0.008, OT: -0.018, TO: -0.018, OR: 0.008, RS: 0.007 };
export const KERN_PLUS = { PL: 0.016, LU: -0.012, US: -0.005 };

// ---------------------------------------------------------------------------------------------
// The mark
// ---------------------------------------------------------------------------------------------

/** The bracket-E and the plus, with the top-left corner of the bracket at (x, y). `u` = unit size. */
export function mark(x = 0, y = 0, u = U) {
  const m = MARK;
  const bracket = union(
    rect(x, y, m.spine * u, m.h * u),
    rect(x, y, m.w * u, m.arm * u),
    rect(x, y + (m.h - m.arm) * u, m.w * u, m.arm * u),
  );
  const cx = x + (m.spine + m.seat + m.plusSpan / 2) * u;
  const cy = y + (m.h / 2) * u;
  const sign = union(
    rect(cx - (m.plusV / 2) * u, cy - (m.plusSpan / 2) * u, m.plusV * u, m.plusSpan * u),
    rect(cx - (m.plusSpan / 2) * u, cy - (m.plusH / 2) * u, m.plusSpan * u, m.plusH * u),
  );
  return { bracket, sign, w: m.w * u, h: m.h * u, cx, cy };
}

/**
 * Pixel-snapped marks for the small icon sizes, drawn on the pixel grid of a `px` tile. Whole pixels
 * only: the vector master would put every edge on a fraction at these sizes. An even bracket height
 * takes an even bar and an odd height an odd bar, so the plus is centred on the grid either way.
 */
export const HINTED = {
  // tile 16: bracket 10 × 12, strokes 2; plus 6 × 6 with 2 px bars, seated 1 px from the spine
  16: { x: 3, y: 2, w: 10, h: 12, s: 2, a: 2, plus: { x: 6, y: 5, span: 6, t: 2 } },
  // tile 32: bracket 18 × 23, spine 4, arms 3; plus 11 × 11 with 3 px bars
  32: { x: 7, y: 4, w: 18, h: 23, s: 4, a: 3, plus: { x: 12, y: 10, span: 11, t: 3 } },
  // tile 48: bracket 28 × 36, spine 6, arms 4; plus 16 × 16 with 4 px bars
  48: { x: 10, y: 6, w: 28, h: 36, s: 6, a: 4, plus: { x: 18, y: 16, span: 16, t: 4 } },
};
export function hintedMark(px) {
  const g = HINTED[px];
  const bracket = union(rect(g.x, g.y, g.s, g.h), rect(g.x, g.y, g.w, g.a), rect(g.x, g.y + g.h - g.a, g.w, g.a));
  const p = g.plus;
  const o = (p.span - p.t) / 2;
  const sign = union(rect(p.x + o, p.y, p.t, p.span), rect(p.x, p.y + o, p.span, p.t));
  return { bracket, sign };
}

// ---------------------------------------------------------------------------------------------
// The OEM Parts signature
// ---------------------------------------------------------------------------------------------

const restyle = (d, t) => slant(matrix(d, [t.stretch, 0, 0, 1, 0, 0]), t.lean, 0);

/** A word in a signature style, on a baseline at y = 0. */
function styled(text, t, cap) {
  return restyle(word(text, t, cap, { tracking: t.tracking ?? 0 }).d, t);
}

/**
 * Outlined „Parts“ on a baseline at y = 0, starting at x = 0. Each letter is moved so that the
 * narrowest point between it and its neighbour is exactly `air` outline widths after stroking.
 */
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

/** „by OEM Parts“ on one baseline; ink from `x` rightwards, or ending at `x` when `end` is set. */
export function signature(cap, x, y, end = false, hair = HAIR) {
  const build = (x0) => {
    let by = styled("by", TYPE.by, cap * TYPE.by.scale);
    by = translate(by, x0 - bounds(by).x1, y);
    let oem = styled("OEM", TYPE.oem, cap);
    oem = translate(oem, bounds(by).x2 + cap * 0.4 - bounds(oem).x1, y);
    const outlined = translate(outlinedParts(cap, hair), bounds(oem).x2 + cap * 0.3, y);
    return { by, oem, parts: outlined, d: by + oem + outlined, x1: x0, x2: bounds(outlined).x2 };
  };
  const probe = build(0);
  return build(end ? x - probe.x2 : x);
}

/**
 * The OEM Parts logo in its known arrangement — solid „OEM“, a hairline that overshoots on both sides,
 * outlined „Parts“ hung from its right end — fitted to a total height `h` with its top-left at (x, y).
 * Proportions follow the shop's current file (docs/brand/source/oem-parts-current.webp).
 */
export function oemParts(x, y, h) {
  const P = { ruleGap: 0.21, partsGap: 0.14, parts: 0.4, left: 0.16, right: 0.17 };
  const hair = (HAIR * h) / (MARK.h * U);
  const cap = (h - hair) / (1 + P.ruleGap + P.partsGap + P.parts);
  let oem = styled("OEM", TYPE.oem, cap);
  oem = translate(oem, x + cap * P.left - bounds(oem).x1, y + cap);
  const ruleX2 = bounds(oem).x2 + cap * P.right;
  const rule = rect(x, y + cap + cap * P.ruleGap, ruleX2 - x, hair);
  let parts = outlinedParts(cap * P.parts, hair);
  parts = translate(parts, ruleX2 - bounds(parts).x2, y + h - hair / 2);
  return { d: oem + rule + parts, w: ruleX2 - x, h, cap };
}

// ---------------------------------------------------------------------------------------------
// The wordmark block
// ---------------------------------------------------------------------------------------------

/**
 * EUROMOTORS over „PLUS ——— by OEM Parts“. (x, y) is the top-left corner: x = left edge of the ink of E,
 * y = cap line of EUROMOTORS. Without `withSignature` the hairline runs to the right edge.
 */
export function wordmark(x = 0, y = 0, { withSignature = true, cap = C } = {}) {
  const L = LOCKUP;
  const euro = wordAt("EUROMOTORS", TYPE.euro, cap, x, y + cap, { tracking: TYPE.euro.tracking, kern: KERN });
  const right = euro.bbox.x2;
  const c2 = cap * L.line2;
  const base2 = y + cap + cap * L.lineGap + c2;
  const plusWord = wordAt("PLUS", TYPE.plus, c2, x, base2, { tracking: TYPE.plus.tracking, kern: KERN_PLUS });
  const ruleH = (STEM * cap) / 5;
  const ruleX1 = plusWord.bbox.x2 + c2 * L.ruleGap;
  let ruleX2 = right;
  let sig = null;
  if (withSignature) {
    sig = signature(c2, right, base2, true, ruleH);
    ruleX2 = bounds(sig.d).x1 - c2 * L.ruleGap;
  }
  const rule = rect(ruleX1, base2 - c2 / 2 - ruleH / 2, ruleX2 - ruleX1, ruleH);
  return {
    d: euro.d + plusWord.d + rule + (sig ? sig.d : ""),
    euro,
    plusWord,
    rule,
    sig,
    x1: x,
    x2: right,
    top: y,
    bottom: base2,
    w: right - x,
    h: base2 - y,
    cap,
    c2,
    base1: y + cap,
    base2,
    ruleX1,
    ruleX2,
    ruleY: base2 - c2 / 2,
    ruleH,
  };
}

// ---------------------------------------------------------------------------------------------
// Lockups — each returns { w, h, ink, accent } in a tight box (the artwork touches the edges of the
// viewBox; clear space is the layout's job, see CLEAR).
// ---------------------------------------------------------------------------------------------

function tight(ink, accent) {
  const b = bounds(ink + accent);
  const dx = -b.x1;
  const dy = -b.y1;
  return {
    w: Number(b.w.toFixed(2)),
    h: Number(b.h.toFixed(2)),
    ink: ink ? translate(ink, dx, dy) : "",
    accent: accent ? translate(accent, dx, dy) : "",
    dx,
    dy,
  };
}

export const LOCKUPS = {
  /** Mark + two-line wordmark with the OEM Parts signature. The primary logo. */
  horizontal() {
    const m = mark(0, 0);
    const wm = wordmark(m.w + LOCKUP.gapMark, 0);
    return tight(m.bracket + wm.d, m.sign);
  },
  /** Mark + two-line wordmark, no signature: for site headers and other small uses. */
  header() {
    const m = mark(0, 0);
    const wm = wordmark(m.w + LOCKUP.gapMark, 0, { withSignature: false });
    return tight(m.bracket + wm.d, m.sign);
  },
  /** Mark above the wordmark block, left-aligned. */
  stacked() {
    const m = mark(0, 0, U * LOCKUP.stackMark);
    const wm = wordmark(0, m.h + LOCKUP.stackGap);
    return tight(m.bracket + wm.d, m.sign);
  },
  /** The wordmark block alone. */
  wordmark() {
    return tight(wordmark(0, 0).d, "");
  },
  /** The compact mark. */
  mark() {
    const m = mark(0, 0);
    return tight(m.bracket, m.sign);
  },
  /**
   * Both names at the same height, for the shop sign and the van: the header lockup, a divider, and
   * the OEM Parts logo in its known arrangement.
   */
  dual() {
    const m = mark(0, 0);
    const wm = wordmark(m.w + LOCKUP.gapMark, 0, { withSignature: false });
    const gap = C * LOCKUP.dualGap;
    const divider = rect(wm.x2 + gap, 0, HAIR, m.h);
    const shop = oemParts(wm.x2 + gap * 2 + HAIR, 0, m.h);
    return tight(m.bracket + wm.d + divider + shop.d, m.sign);
  },
  /** The shop's own logo, redrawn: for places where only „OEM Parts“ appears. */
  oemParts() {
    return tight(oemParts(0, 0, MARK.h * U).d, "");
  },
};

/** A lockup as an SVG document in a colour theme (transparent ground unless `bg`). */
export function lockupSvg(kind, theme, { bg = false, pad = 0, title } = {}) {
  const a = LOCKUPS[kind]();
  const t = typeof theme === "string" ? THEMES[theme] : theme;
  const body = fill(a.ink, t.ink) + fill(a.accent, t.accent);
  const w = Number((a.w + pad * 2).toFixed(2));
  const h = Number((a.h + pad * 2).toFixed(2));
  const inner = pad ? `<g transform="translate(${pad} ${pad})">${body}</g>` : body;
  return { svg: svgDoc({ w, h, body: inner, bg: bg ? t.bg : undefined, title }), w, h };
}

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------
export const ICON = { size: 512, radius: 0.22, markHeight: 0.5, maskableHeight: 0.42 };

/** App icon: graphite tile, ink bracket, orange plus. `rounded` = transparent corners. */
export function iconSvg({ rounded = true, markHeight = ICON.markHeight, size = ICON.size, theme = THEMES.night } = {}) {
  const u = (size * markHeight) / MARK.h;
  const m = mark((size - MARK.w * u) / 2, (size - MARK.h * u) / 2, u);
  const tile = rounded ? rrect(0, 0, size, size, size * ICON.radius) : rect(0, 0, size, size);
  return svgDoc({
    w: size,
    h: size,
    body: fill(tile, theme.bg) + fill(m.bracket, theme.ink) + fill(m.sign, theme.accent),
    title: "Euromotors Plus",
  });
}

/** Small favicon tiles on their own pixel grid. */
export function hintedIconSvg(px, theme = THEMES.night) {
  const m = hintedMark(px);
  const radius = px === 16 ? 3 : px === 32 ? 6 : 9;
  return svgDoc({
    w: px,
    h: px,
    body: fill(rrect(0, 0, px, px, radius), theme.bg) + fill(m.bracket, theme.ink) + fill(m.sign, theme.accent),
  });
}
