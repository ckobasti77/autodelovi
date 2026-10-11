// Path geometry for the logo work, on Skia's PathKit (WASM): boolean operations, stroke → outline
// expansion, affine transforms and tight bounds. Everything goes in and out as SVG path data so the
// build scripts stay plain string composition.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, "../../../..");
const init = require("pathkit-wasm/bin/pathkit.js");
const loaded = init({ wasmBinary: readFileSync(path.join(ROOT, "node_modules/pathkit-wasm/bin/pathkit.wasm")) });
const PK = await (typeof loaded.ready === "function" ? loaded.ready() : loaded);

const fmt = (n, p) => {
  const v = Number(Number(n).toFixed(p));
  return String(Object.is(v, -0) ? 0 : v);
};

/** Round every number in a path string. */
export const roundD = (d, p = 2) => d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (m) => fmt(m, p));

function use(d, fn) {
  const p = PK.FromSVGString(d);
  try {
    return fn(p);
  } finally {
    p.delete();
  }
}
const out = (p, precision = 2) => roundD(p.toSVGString(), precision);

const OPS = { union: "UNION", difference: "DIFFERENCE", intersect: "INTERSECT", xor: "XOR" };
function op(a, b, kind) {
  const pa = PK.FromSVGString(a);
  const pb = PK.FromSVGString(b);
  const res = PK.MakeFromOp(pa, pb, PK.PathOp[OPS[kind]]);
  pa.delete();
  pb.delete();
  if (!res) throw new Error(`path op ${kind} failed`);
  const d = out(res);
  res.delete();
  return d;
}

export const union = (...ds) => ds.filter(Boolean).reduce((acc, d) => op(acc, d, "union"));
export const difference = (a, ...bs) => bs.reduce((acc, b) => op(acc, b, "difference"), a);
export const intersect = (a, b) => op(a, b, "intersect");

/** Resolve overlaps and winding so the result fills the same with nonzero and evenodd. */
export const simplify = (d) => use(d, (p) => out(p.simplify()));

/** A stroke of `width` centred on the contour, as a filled outline. */
export function expandStroke(d, width, { join = "miter", cap = "butt", miterLimit = 4 } = {}) {
  return use(d, (p) => {
    p.stroke({
      width,
      join: PK.StrokeJoin[join.toUpperCase()],
      cap: PK.StrokeCap[cap.toUpperCase()],
      miter_limit: miterLimit,
    });
    return out(p.simplify());
  });
}

/** Grow (delta > 0) or shrink (delta < 0) a filled shape by |delta|. */
export function offset(d, delta, opts) {
  if (delta === 0) return d;
  const band = expandStroke(d, Math.abs(delta) * 2, opts);
  return delta > 0 ? union(simplify(d), band) : difference(simplify(d), band);
}

/** Outlined lettering: the band of `width` that lies inside the glyph contour (the letter keeps its size). */
export const innerOutline = (d, width, opts) => difference(simplify(d), offset(d, -width, opts));

/** SVG matrix(a b c d e f). */
export function matrix(d, [a, b, c, dd, e, f]) {
  return use(d, (p) => out(p.transform(a, c, e, b, dd, f, 0, 0, 1), 3));
}
export const translate = (d, tx, ty) => matrix(d, [1, 0, 0, 1, tx, ty]);
export const scale = (d, sx, sy = sx, cx = 0, cy = 0) => matrix(d, [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy]);
export function rotate(d, deg, cx = 0, cy = 0) {
  const t = (deg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return matrix(d, [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy]);
}
/** Shear along x so that a vertical becomes a line leaning `deg` to the right; `y0` stays in place. */
export function slant(d, deg, y0 = 0) {
  const k = Math.tan((deg * Math.PI) / 180);
  return matrix(d, [1, 0, -k, 1, k * y0, 0]);
}

export function bounds(d) {
  return use(d, (p) => {
    const b = p.computeTightBounds();
    const x1 = b.fLeft;
    const y1 = b.fTop;
    const x2 = b.fRight;
    const y2 = b.fBottom;
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  });
}

// ---------------------------------------------------------------------------------------------
// Primitives (clockwise in screen space)
// ---------------------------------------------------------------------------------------------
const n = (v) => fmt(v, 3);

export const rect = (x, y, w, h) => `M${n(x)} ${n(y)}H${n(x + w)}V${n(y + h)}H${n(x)}Z`;

export function rrect(x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  if (r <= 0) return rect(x, y, w, h);
  const k = r * 0.5522847498;
  return (
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}C${n(x + w - r + k)} ${n(y)} ${n(x + w)} ${n(y + r - k)} ${n(x + w)} ${n(y + r)}` +
    `V${n(y + h - r)}C${n(x + w)} ${n(y + h - r + k)} ${n(x + w - r + k)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}C${n(x + r - k)} ${n(y + h)} ${n(x)} ${n(y + h - r + k)} ${n(x)} ${n(y + h - r)}` +
    `V${n(y + r)}C${n(x)} ${n(y + r - k)} ${n(x + r - k)} ${n(y)} ${n(x + r)} ${n(y)}Z`
  );
}

export function circle(cx, cy, r) {
  const k = r * 0.5522847498;
  return (
    `M${n(cx)} ${n(cy - r)}C${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)}` +
    `C${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)}` +
    `C${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)}` +
    `C${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)}Z`
  );
}

export const ring = (cx, cy, rOuter, rInner) => difference(circle(cx, cy, rOuter), circle(cx, cy, rInner));

export const poly = (pts) => `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;

/** Regular star / polygon: `points` tips at rOuter, notches at rInner, first tip at `rot` degrees (0 = up). */
export function star(cx, cy, rOuter, rInner, points, rot = 0) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? rOuter : rInner;
    const a = ((rot - 90 + (i * 180) / points) * Math.PI) / 180;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return poly(pts);
}

/** A plus sign: overall `span`, arm thickness `t`. */
export function plus(cx, cy, span, t) {
  const a = span / 2;
  const h = t / 2;
  return poly([
    [cx - h, cy - a],
    [cx + h, cy - a],
    [cx + h, cy - h],
    [cx + a, cy - h],
    [cx + a, cy + h],
    [cx + h, cy + h],
    [cx + h, cy + a],
    [cx - h, cy + a],
    [cx - h, cy + h],
    [cx - a, cy + h],
    [cx - a, cy - h],
    [cx - h, cy - h],
  ]);
}

/** Point on a circle; angle in degrees, 0 = right, counter-clockwise positive (maths convention). */
export const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];

/** Annular sector between two radii from angle a0 to a1 (maths convention, a1 > a0). */
export function sector(cx, cy, rOuter, rInner, a0, a1) {
  const steps = Math.max(2, Math.ceil((a1 - a0) / 3));
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    outer.push(polar(cx, cy, rOuter, a));
    inner.unshift(polar(cx, cy, rInner, a));
  }
  return intersect(poly([...outer, ...inner]), ring(cx, cy, rOuter, rInner));
}

/**
 * Points along the contours of a path, at most `step` apart (curves are flattened). For measuring.
 */
export function samplePoints(d, step = 1) {
  return use(d, (p) => {
    const cmds = p.toCmds();
    const pts = [];
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    const line = (x1, y1, x2, y2) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let i = 1; i <= n; i++) pts.push([x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n]);
    };
    const curve = (fn, len) => {
      const n = Math.max(2, Math.ceil(len / step));
      let px = cx;
      let py = cy;
      for (let i = 1; i <= n; i++) {
        const [x, y] = fn(i / n);
        line(px, py, x, y);
        px = x;
        py = y;
      }
    };
    for (const c of cmds) {
      const [verb, ...a] = c;
      if (verb === PK.MOVE_VERB) {
        [cx, cy] = a;
        [sx, sy] = a;
        pts.push([cx, cy]);
      } else if (verb === PK.LINE_VERB) {
        line(cx, cy, a[0], a[1]);
        [cx, cy] = a;
      } else if (verb === PK.QUAD_VERB || verb === PK.CONIC_VERB) {
        const [x1, y1, x2, y2] = a;
        const x0 = cx;
        const y0 = cy;
        curve(
          (t) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2],
          Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1),
        );
        cx = x2;
        cy = y2;
      } else if (verb === PK.CUBIC_VERB) {
        const [x1, y1, x2, y2, x3, y3] = a;
        const x0 = cx;
        const y0 = cy;
        curve(
          (t) => [
            (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 * x3,
            (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3 * y3,
          ],
          Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2),
        );
        cx = x3;
        cy = y3;
      } else if (verb === PK.CLOSE_VERB) {
        line(cx, cy, sx, sy);
        cx = sx;
        cy = sy;
      }
    }
    return pts;
  });
}
