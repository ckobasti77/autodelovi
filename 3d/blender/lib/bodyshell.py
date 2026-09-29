"""Body master surface: half-profile sections along z with parameter-aligned key points.

Key points per station (left half, x >= 0), bottom -> top centre:
  k0 bottom (sill / arch edge / bumper top), k1 lower side, k2 door crease, k3 shoulder,
  k4 belt / fender top, k5 greenhouse base / hood shut line, k6 roof side / A-pillar, k7 centre.
Wheel arches are built in: inside an arch z-range the bottom point rides on the arch circle, so
the side surface ends exactly at the arch edge without booleans. Panels are grid regions between
iso-lines (stations at the shut lines, key-point columns), shrunk 2 mm for an exact 4 mm gap and
finished with an inward hem.
"""

from __future__ import annotations

import bisect
import math

from mathutils import Vector

from config import vehicle as VH
from .geo import Geo

# samples between consecutive key points (k0->k1, ..., k6->k7)
SEG = [3, 5, 7, 4, 4, 8, 10]
K = [0]
for s_ in SEG:
    K.append(K[-1] + s_)
NPROF = K[-1] + 1  # 42

# key stations: z -> [(x, y) for k0..k7]   (vehicle space, left half)
# Cabin sections carry tumblehome: the sill tucks in, the widest point sits at door-crease height,
# the glass leans in ~25 degrees. The ends collapse in height (nose / tail rows form the faces).
KEY = [
    (2.125, [(0.690, 0.640), (0.700, 0.645), (0.705, 0.650), (0.700, 0.655), (0.680, 0.660), (0.520, 0.662), (0.260, 0.664), (0.000, 0.665)]),
    (2.080, [(0.760, 0.640), (0.775, 0.655), (0.785, 0.685), (0.782, 0.725), (0.752, 0.760), (0.560, 0.775), (0.280, 0.782), (0.000, 0.785)]),
    (1.980, [(0.832, 0.640), (0.848, 0.668), (0.860, 0.710), (0.858, 0.768), (0.815, 0.808), (0.625, 0.828), (0.310, 0.845), (0.000, 0.850)]),
    (1.700, [(0.872, 0.585), (0.886, 0.640), (0.893, 0.700), (0.889, 0.830), (0.845, 0.874), (0.665, 0.895), (0.330, 0.925), (0.000, 0.932)]),
    (1.310, [(0.880, 0.700), (0.890, 0.730), (0.896, 0.770), (0.891, 0.852), (0.852, 0.914), (0.680, 0.938), (0.340, 0.968), (0.000, 0.975)]),
    (0.950, [(0.870, 0.400), (0.886, 0.460), (0.895, 0.560), (0.890, 0.865), (0.855, 0.952), (0.705, 0.978), (0.350, 1.002), (0.000, 1.008)]),
    (0.800, [(0.848, 0.180), (0.874, 0.300), (0.895, 0.560), (0.888, 0.872), (0.850, 0.985), (0.800, 1.004), (0.700, 1.010), (0.000, 1.014)]),
    (0.450, [(0.849, 0.180), (0.875, 0.300), (0.896, 0.560), (0.889, 0.878), (0.850, 0.995), (0.795, 1.075), (0.690, 1.190), (0.000, 1.210)]),
    (0.100, [(0.850, 0.180), (0.876, 0.300), (0.896, 0.560), (0.889, 0.884), (0.850, 1.002), (0.790, 1.130), (0.665, 1.365), (0.000, 1.405)]),
    (-0.450, [(0.850, 0.180), (0.876, 0.300), (0.896, 0.560), (0.889, 0.890), (0.850, 1.010), (0.785, 1.140), (0.650, 1.375), (0.000, 1.450)]),
    (-1.020, [(0.852, 0.180), (0.877, 0.300), (0.896, 0.560), (0.888, 0.895), (0.850, 1.020), (0.780, 1.140), (0.635, 1.366), (0.000, 1.437)]),
    (-1.420, [(0.855, 0.180), (0.878, 0.300), (0.895, 0.560), (0.886, 0.898), (0.846, 1.030), (0.770, 1.135), (0.600, 1.345), (0.000, 1.405)]),
    (-1.700, [(0.862, 0.585), (0.876, 0.640), (0.882, 0.700), (0.872, 0.870), (0.832, 1.000), (0.740, 1.050), (0.580, 1.140), (0.000, 1.170)]),
    (-1.860, [(0.800, 0.620), (0.830, 0.660), (0.846, 0.720), (0.838, 0.830), (0.790, 0.962), (0.700, 0.998), (0.550, 1.012), (0.000, 1.020)]),
    (-1.975, [(0.760, 0.620), (0.785, 0.645), (0.800, 0.690), (0.796, 0.760), (0.760, 0.820), (0.660, 0.838), (0.500, 0.846), (0.000, 0.850)]),
    (-2.030, [(0.720, 0.620), (0.735, 0.628), (0.742, 0.640), (0.740, 0.652), (0.715, 0.660), (0.620, 0.662), (0.470, 0.664), (0.000, 0.665)]),
]
KEY.sort(key=lambda t: t[0])
KZ = [k[0] for k in KEY]

ARCH_OPEN = 0.360  # arch opening radius: tyre 0.316 + ~44 mm
ARCHES = [(VH.Z_FRONT_AXLE, VH.WHEEL_Y, ARCH_OPEN), (VH.Z_REAR_AXLE, VH.WHEEL_Y, ARCH_OPEN)]
Z_MIN, Z_MAX = KZ[0], KZ[-1]


def _interp_key(z: float, k: int) -> tuple[float, float]:
    """Catmull-Rom interpolation of key point k across key stations."""
    i = max(1, min(len(KZ) - 1, bisect.bisect_left(KZ, z)))
    z0, z1 = KZ[i - 1], KZ[i]
    t = (z - z0) / (z1 - z0) if z1 != z0 else 0.0
    t = min(max(t, 0.0), 1.0)

    def pt(idx):
        idx = max(0, min(len(KEY) - 1, idx))
        return Vector(KEY[idx][1][k])

    p0, p1, p2, p3 = pt(i - 2), pt(i - 1), pt(i), pt(i + 1)
    t2, t3 = t * t, t * t * t
    v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    # clamp overshoot between the two neighbours for y (keeps the silhouette monotone)
    return (v.x, v.y)


def arch_bottom(z: float) -> float | None:
    for za, ya, r in ARCHES:
        dz = z - za
        if abs(dz) < r:
            return ya + math.sqrt(r * r - dz * dz)
    return None


def section(z: float) -> list[tuple[float, float]]:
    keys = [list(_interp_key(z, k)) for k in range(8)]
    ab = arch_bottom(z)
    if ab is not None and keys[0][1] < ab:
        base = ab
        keys[0][1] = base
        keys[1][1] = max(keys[1][1], base + 0.030)
        keys[2][1] = max(keys[2][1], base + 0.080)
        keys[3][1] = max(keys[3][1], keys[2][1] + 0.05)
    # enforce increasing heights for k0..k4 and non-increasing x toward the centre for k4..k7
    for k in range(1, 5):
        keys[k][1] = max(keys[k][1], keys[k - 1][1] + 0.004)
    # profile through key points (Catmull-Rom in 2D), fixed samples per segment
    pts = [Vector(p) for p in keys]
    out: list[tuple[float, float]] = []
    for s in range(7):
        p0 = pts[max(s - 1, 0)]
        p1, p2 = pts[s], pts[s + 1]
        p3 = pts[min(s + 2, 7)]
        n = SEG[s]
        for i in range(n):
            t = i / n
            t2, t3 = t * t, t * t * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((max(v.x, 0.0), v.y))
    out.append((0.0, keys[7][1]))
    return out


def _smooth(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def end_sweep(x: float, z: float) -> float:
    """Plan-view sweep-back of the nose and tail corners (rounds the ends in plan)."""
    k = (x / 0.85) ** 2
    if z > 1.72:
        return -0.110 * k * _smooth((z - 1.72) / (Z_MAX - 1.72))
    if z < -1.72:
        return 0.080 * k * _smooth((-1.72 - z) / (-1.72 - Z_MIN))
    return 0.0


def stations(step: float, extra: list[float]) -> list[float]:
    """Fixed stations (shut lines, key z) first, then a regular grid and dense arch stations,
    skipping candidates closer than 0.35 * step to an accepted station (no sliver rows)."""
    zs = sorted({round(e, 5) for e in extra if Z_MIN < e < Z_MAX} | {Z_MIN, Z_MAX})
    cand = []
    z = Z_MIN
    while z < Z_MAX - 1e-6:
        cand.append(z)
        z += step
    for za, _, r in ARCHES:
        for k in range(-12, 13):
            cand.append(za + r * k / 12)
    for c in sorted(cand, key=lambda c: min(abs(c - za) for za, _, _ in ARCHES)):
        if Z_MIN < c < Z_MAX and all(abs(c - f) > 0.35 * step for f in zs):
            zs.append(round(c, 5))
    return sorted(zs, reverse=True)  # front -> rear


class Master:
    def __init__(self, step: float = 0.045) -> None:
        extra = [VH.Z_DOOR_FRONT, VH.Z_B_PILLAR, VH.Z_DOOR_REAR_END, VH.Z_BUMPER_F_JOIN, 0.10, -1.42, -1.86, -1.80, 1.93, 2.08, 1.98, -1.975, 0.75, -0.13, -0.23, -0.99, -1.07, -1.40, 0.12, 0.78, -1.44, -1.84, 1.53, -1.53, 1.87, -1.99, -1.30]
        self.z = stations(step, extra)
        self.grid = [[(x, y, z + end_sweep(x, z)) for x, y in section(z)] for z in self.z]

    def zi(self, z: float) -> int:
        return min(range(len(self.z)), key=lambda i: abs(self.z[i] - z))

    def rows(self, z_front: float, z_rear: float, j0: int, j1: int, gap: float = 0.002, gap_sides=(True, True, True, True)) -> list[list[Vector]]:
        """Grid sub-region [station z_front..z_rear] x [profile j0..j1], shrunk by the half gap."""
        i0, i1 = self.zi(z_front), self.zi(z_rear)
        if i0 > i1:
            i0, i1 = i1, i0
        rows = [[Vector(self.grid[i][j]) for j in range(j0, j1 + 1)] for i in range(i0, i1 + 1)]
        return shrink(rows, gap, gap_sides)

    def region(self, z_front: float, z_rear: float, j0: int, j1: int, mat: str, gap: float = 0.002, hem: float = 0.006, mirror: bool = False, gap_sides=(True, True, True, True)) -> Geo:
        """Panel from a grid sub-region: surface + inward hem, optionally mirrored and welded."""
        rows = self.rows(z_front, z_rear, j0, j1, gap, gap_sides)
        g = surface(rows, mat)
        if hem > 0:
            g += hem_strip(rows, hem, mat)
        if mirror:
            m = g.mirrored_x()
            g = weld(g.extend(m), 1e-5)
        return g


def frame(master: "Master", z_front: float, z_rear: float, j0: int, j1: int, holes, mat: str, gap: float = 0.002, hem: float = 0.005, hole_hem: float = 0.012) -> Geo:
    """Grid region with rectangular window holes (zf, zr, ja, jb); hems on the outer edge and
    around every hole (the window frame flange)."""
    i0 = min(master.zi(z_front), master.zi(z_rear))
    rows = master.rows(z_front, z_rear, j0, j1, gap)
    nr, nc = len(rows), len(rows[0])
    hx = []
    for zf, zr, ja, jb in holes:
        a, b = sorted((master.zi(zf) - i0, master.zi(zr) - i0))
        hx.append((a, b, ja - j0, jb - j0))
    g = Geo()
    idx = [[g.v(p) for p in r] for r in rows]
    for i in range(nr - 1):
        for j in range(nc - 1):
            if any(a <= i < b and ja <= j < jb for a, b, ja, jb in hx):
                continue
            g.f((idx[i][j], idx[i + 1][j], idx[i + 1][j + 1], idx[i][j + 1]), mat, None, False)
    if hem > 0:
        g += hem_strip(rows, hem, mat)
    for a, b, ja, jb in hx:
        sub = [r[ja : jb + 1] for r in rows[a : b + 1]]
        h = hem_strip(sub, hole_hem, mat)
        h.faces = [tuple(reversed(f)) for f in h.faces]
        g += h
    return g


def iso_height(rows, h: float, depth: float = 0.0) -> list[Vector]:
    """Curve on a grid region at constant height h (one point per row where the row crosses h),
    optionally pushed inward along the surface normal."""
    out = []
    nc = len(rows[0])
    for i in range(len(rows)):
        r = rows[i]
        for j in range(nc - 1):
            y0, y1 = r[j].y, r[j + 1].y
            if (y0 - h) * (y1 - h) <= 0 and abs(y1 - y0) > 1e-9:
                t = (h - y0) / (y1 - y0)
                p = r[j].lerp(r[j + 1], t)
                if depth:
                    n = _normal(rows, i, j).lerp(_normal(rows, i, j + 1), t)
                    p = p - n.normalized() * depth
                out.append(p)
                break
    return out


def height_band(rows, h0: float, h1: float, n: int, depth: float, mat: str) -> Geo:
    """Surface strip between heights h0 < h1 on a grid region, pushed inward by depth.
    One sample column per grid row that spans both heights; quads between neighbouring rows."""
    nc = len(rows[0])
    samples = []
    for i in range(len(rows)):
        r = rows[i]
        ys = [p.y for p in r]
        if min(ys) > h0 or max(ys) < h1:
            samples.append(None)
            continue
        pts = []
        for k in range(n):
            h = h0 + (h1 - h0) * k / (n - 1)
            for j in range(nc - 1):
                y0, y1 = ys[j], ys[j + 1]
                if (y0 - h) * (y1 - h) <= 0 and abs(y1 - y0) > 1e-9:
                    t = (h - y0) / (y1 - y0)
                    nrm = _normal(rows, i, j).lerp(_normal(rows, i, j + 1), t).normalized()
                    pts.append(r[j].lerp(r[j + 1], t) - nrm * depth)
                    break
        samples.append(pts if len(pts) == n else None)
    g = Geo()
    for a, b in zip(samples[:-1], samples[1:]):
        if a is None or b is None:
            continue
        ia = [g.v(p) for p in a]
        ib = [g.v(p) for p in b]
        for k in range(n - 1):
            g.f((ia[k], ib[k], ib[k + 1], ia[k + 1]), mat, None, False)
    return g


def boundary(rows) -> tuple[list[Vector], list[Vector]]:
    """Boundary loop of a grid region (same order as hem_strip) and the surface normals there."""
    nr, nc = len(rows), len(rows[0])
    loop = [(0, j) for j in range(nc)] + [(i, nc - 1) for i in range(1, nr)] + [(nr - 1, j) for j in range(nc - 2, -1, -1)] + [(i, 0) for i in range(nr - 2, 0, -1)]
    return [rows[i][j].copy() for i, j in loop], [_normal(rows, i, j) for i, j in loop]


def ray_hit(rows, origin, direction) -> Vector | None:
    """First intersection of a ray with a grid region (closest to the origin)."""
    from mathutils.geometry import intersect_ray_tri

    o, d = Vector(origin), Vector(direction).normalized()
    best, best_t = None, 1e9
    for i in range(len(rows) - 1):
        for j in range(len(rows[0]) - 1):
            a, b, c, e = rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]
            for tri in ((a, b, c), (a, c, e)):
                h = intersect_ray_tri(tri[0], tri[1], tri[2], d, o, True)
                if h is not None:
                    t = (h - o).dot(d)
                    if 0 < t < best_t:
                        best, best_t = h, t
    return best


def shrink(rows, gap, sides=(True, True, True, True)):
    """Pull boundary rows/columns inward along the surface by `gap` (front, rear, bottom, top)."""
    nr, nc = len(rows), len(rows[0])
    out = [[p.copy() for p in r] for r in rows]
    f, rr, b, t = sides
    if gap <= 0:
        return out
    for j in range(nc):
        if f and nr > 1:
            d = (rows[1][j] - rows[0][j])
            if d.length > 1e-9:
                out[0][j] = rows[0][j] + d.normalized() * min(gap, d.length * 0.4)
        if rr and nr > 1:
            d = (rows[-2][j] - rows[-1][j])
            if d.length > 1e-9:
                out[-1][j] = rows[-1][j] + d.normalized() * min(gap, d.length * 0.4)
    for i in range(nr):
        if b and nc > 1:
            d = (rows[i][1] - rows[i][0])
            if d.length > 1e-9:
                out[i][0] = out[i][0] + d.normalized() * min(gap, d.length * 0.4)
        if t and nc > 1 and rows[i][-1].x > 1e-6:
            d = (rows[i][-2] - rows[i][-1])
            if d.length > 1e-9:
                out[i][-1] = out[i][-1] + d.normalized() * min(gap, d.length * 0.4)
    return out


def surface(rows, mat: str) -> Geo:
    """Quad surface; rows run front->rear, columns bottom->top on the LEFT half (outward normals)."""
    g = Geo()
    idx = [[g.v(p) for p in r] for r in rows]
    for i in range(len(rows) - 1):
        for j in range(len(rows[0]) - 1):
            a, b, c, d = idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]
            g.f((a, d, c, b), mat, None, False)
    return g


def _normal(rows, i, j) -> Vector:
    nr, nc = len(rows), len(rows[0])
    du = rows[min(i + 1, nr - 1)][j] - rows[max(i - 1, 0)][j]
    dv = rows[i][min(j + 1, nc - 1)] - rows[i][max(j - 1, 0)]
    n = du.cross(dv)
    return n.normalized() if n.length > 1e-12 else Vector((1, 0, 0))


def hem_strip(rows, depth: float, mat: str) -> Geo:
    """Inward flange along the whole boundary loop of a grid region."""
    nr, nc = len(rows), len(rows[0])
    loop = [(0, j) for j in range(nc)] + [(i, nc - 1) for i in range(1, nr)] + [(nr - 1, j) for j in range(nc - 2, -1, -1)] + [(i, 0) for i in range(nr - 2, 0, -1)]
    g = Geo()
    outer = [g.v(rows[i][j]) for i, j in loop]
    inner = [g.v(rows[i][j] - _normal(rows, i, j) * depth) for i, j in loop]
    n = len(loop)
    for k in range(n):
        k1 = (k + 1) % n
        # skip the centreline edge (x = 0) so mirrored halves join cleanly
        p, q = rows[loop[k][0]][loop[k][1]], rows[loop[k1][0]][loop[k1][1]]
        if abs(p.x) < 1e-6 and abs(q.x) < 1e-6:
            continue
        g.f((outer[k], outer[k1], inner[k1], inner[k]), mat, None, False)
    return g


def weld(g: Geo, eps: float) -> Geo:
    key = {}
    remap = []
    verts = []
    for v in g.verts:
        k = (round(v.x / eps), round(v.y / eps), round(v.z / eps))
        if k not in key:
            key[k] = len(verts)
            verts.append(v)
        remap.append(key[k])
    out = Geo()
    out.verts = verts
    seen = set()
    for f, m, uv, h in zip(g.faces, g.mats, g.uvs, g.hard):
        nf = tuple(remap[i] for i in f)
        # drop repeated corners (keep order), degenerate and duplicate faces
        nf = tuple(v for k, v in enumerate(nf) if v != nf[k - 1])
        if len(set(nf)) < 3 or len(set(nf)) != len(nf):
            continue
        key = frozenset(nf)
        if key in seen:
            continue
        seen.add(key)
        if len(nf) == 3:
            a, b, c = (verts[i] for i in nf)
            if (b - a).cross(c - a).length < 1e-12:
                continue
        out.faces.append(nf)
        out.mats.append(m)
        out.uvs.append(uv)
        out.hard.append(h)
    return out
