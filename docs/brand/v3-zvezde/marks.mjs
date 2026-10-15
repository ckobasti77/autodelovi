// Logo v3: the original Euromotors Plus star arc, modernised.
const f = (n) => Number(n.toFixed(2));
const rad = (d) => (d * Math.PI) / 180;

// Crisp geometric five-point star, softened with a hairline round join.
export function star(cx, cy, R, rotDeg = 0, fill = 'var(--ink)', inner = 0.46) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * inner : R;
    const a = rad(-90 + rotDeg + i * 36);
    pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="${f(R * 0.14)}" stroke-linejoin="round"/>`;
}

// Plus sign with soft corners, same visual weight as a star of radius R.
export function plus(cx, cy, R, fill = 'var(--acc)') {
  const w = R * 0.62, l = R * 1.0;
  return `<g fill="${fill}"><rect x="${f(cx - l)}" y="${f(cy - w / 2)}" width="${f(2 * l)}" height="${f(w)}" rx="${f(w * 0.18)}"/>` +
    `<rect x="${f(cx - w / 2)}" y="${f(cy - l)}" width="${f(w)}" height="${f(2 * l)}" rx="${f(w * 0.18)}"/></g>`;
}

// The open "C" of stars, like the original: starts top-right, sweeps round the left,
// ends bottom-right; stars grow along the sweep so the arc reads as motion.
// opts.last: 'star' | 'plus' — what sits at the end of the sweep.
export function arc({ cx, cy, rx, ry, n = 12, r0, r1, a0 = -40, sweep = 280, last = 'star', tilt = 0, accentLast = false }) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const e = t * t * 0.35 + t * 0.65; // spacing eases slightly as stars grow
    const a = a0 - sweep * e;
    const x = cx + rx * Math.cos(rad(a));
    const y = cy + ry * Math.sin(rad(a));
    const R = r0 + (r1 - r0) * t;
    const rot = a + 90 + tilt;
    if (i === n - 1 && last === 'plus') out += plus(x, y, R * 0.82);
    else out += star(x, y, R, rot, i === n - 1 && accentLast ? 'var(--acc)' : 'var(--ink)');
  }
  return out;
}
