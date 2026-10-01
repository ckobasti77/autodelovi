/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as an easing function p → eased p — the same curve the
 * browser draws for the `--ease-sk-*` tokens. Replaces GSAP's CustomEase for the four SKLOP
 * eases (PERF-10): Newton–Raphson on x(t) with a bisection fallback, as browsers do.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (p: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) return t;
      if (x > value) lo = t;
      else hi = t;
      if (hi - lo < 1e-7) break;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    return sampleY(solveT(p));
  };
}

/** Parses an `"x1,y1,x2,y2"` control-point string (constants/motion EASE_CURVES). */
export function cubicBezierFromString(curve: string): (p: number) => number {
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = curve.split(",").map((part) => Number(part.trim()));
  return cubicBezier(x1, y1, x2, y2);
}
