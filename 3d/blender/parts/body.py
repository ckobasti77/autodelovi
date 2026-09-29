"""Karoserija: X-ray panels from the master surface (hood, fenders, doors), glass, bumpers,
mirrors, wipers, and the non-clickable body__structure (roof, pillars, quarters, tailgate)."""

from __future__ import annotations

import math
from functools import lru_cache

from mathutils import Vector

from config import vehicle as VH
from lib.bodyshell import K, Master, frame, weld
from lib.geo import Geo, R, box, cylinder, extrude, loft, rounded_rect, superellipse2d
from lib.parts import add_centered
from lib.shapes import box_tube

XRAY = "mat_body_xray"
GLASS = "mat_glass_xray"
BLACK = "mat_plastic_black"
PAINT = "mat_painted_black"
RUBBER = "mat_rubber"
MIRROR = "mat_machined_steel"
DARK = "mat_steel_dark"

K0, K1, K2, K3, K4, K5, K6, K7 = K
ZF, ZB, ZR = VH.Z_DOOR_FRONT, VH.Z_B_PILLAR, VH.Z_DOOR_REAR_END


@lru_cache(maxsize=2)
def master(lite: bool) -> Master:
    return Master(step=0.06 if lite else 0.03)


def glass_inset(g: Geo, d: float = 0.003) -> Geo:
    """Push glass slightly inward (toward the car centre) to avoid coplanar faces."""
    for v in g.verts:
        v.x -= math.copysign(d, v.x) if abs(v.x) > 1e-6 else 0.0
        v.y -= d * 0.5
    return g


# --------------------------------------------------------------------------- bumpers


def _arch_clip(p: Vector) -> Vector:
    """Push a point that falls inside a wheel-arch circle (z-y plane) out onto the circle."""
    from lib.bodyshell import ARCHES

    for za, ya, r in ARCHES:
        dz, dy = p.z - za, p.y - ya
        d = math.hypot(dz, dy)
        if d < r:
            k = r / max(d, 1e-6)
            return Vector((p.x, ya + dy * k, za + dz * k))
    return p


@lru_cache(maxsize=4)
def bumper(front: bool, lite: bool) -> Geo:
    """Fascia hanging from the master's lower boundary (end station row + k0 line to the arch):
    bulges forward at the centre, flush with the side at the wing, clipped by the arch circle."""
    m = master(lite)
    zs = m.z
    i_end = 0 if front else len(zs) - 1
    top = [Vector(m.grid[i_end][j]) for j in range(len(m.grid[i_end]) - 1, -1, -1)]
    side = range(1, len(zs)) if front else range(len(zs) - 2, -1, -1)
    from lib.bodyshell import ARCH_OPEN

    z_end = VH.Z_FRONT_AXLE + math.sqrt(ARCH_OPEN ** 2 - (0.60 - VH.WHEEL_Y) ** 2) - 0.002
    for i in side:
        if (front and zs[i] < z_end) or (not front and zs[i] > -z_end):
            break
        top.append(Vector(m.grid[i][0]))
    top = [p - Vector((0, 0.002, 0)) for p in top]
    # round the plan corner where the end row meets the k0 line: resample at 1 cm, then a
    # moving average over +-9 cm in plan (x, z); heights and both ends stay put
    acc0 = [0.0]
    for k in range(1, len(top)):
        acc0.append(acc0[-1] + (top[k] - top[k - 1]).length)
    L0 = acc0[-1]
    n_rs = max(8, int(L0 / 0.01))
    rs = []
    k = 0
    for q in range(n_rs + 1):
        sq = L0 * q / n_rs
        while k < len(top) - 2 and acc0[k + 1] < sq:
            k += 1
        t = (sq - acc0[k]) / max(acc0[k + 1] - acc0[k], 1e-9)
        rs.append(top[k].lerp(top[k + 1], min(max(t, 0.0), 1.0)))
    win = 9
    top = []
    for q in range(len(rs)):
        if q < win or q > len(rs) - 1 - win:
            top.append(rs[q])
            continue
        ax = sum(rs[q + m_].x for m_ in range(-win, win + 1)) / (2 * win + 1)
        az = sum(rs[q + m_].z for m_ in range(-win, win + 1)) / (2 * win + 1)
        top.append(Vector((ax, rs[q].y, az)))
    top = top[::3] + ([top[-1]] if (len(top) - 1) % 3 else [])
    n_top = len(top)
    # plan-view outward normals and arc-length fraction
    acc = [0.0]
    for k in range(1, n_top):
        acc.append(acc[-1] + (top[k] - top[k - 1]).length)
    L = acc[-1]
    u = [0.0, 0.03, 0.10, 0.22, 0.40, 0.60, 0.78, 0.90, 0.97, 1.0]
    d = [0.0, 0.016, 0.040, 0.056, 0.062, 0.060, 0.052, 0.036, 0.012, -0.012]
    if not front:
        d = [0.0, 0.014, 0.034, 0.048, 0.052, 0.046, 0.028, 0.0, -0.032, -0.058]
    # tangents smoothed over +-5 samples so the bulge turns the corner without a crease
    raw = []
    for k in range(n_top):
        t = top[min(k + 1, n_top - 1)] - top[max(k - 1, 0)]
        raw.append(Vector((t.x, 0.0, t.z)).normalized() if t.length > 1e-9 else Vector((1, 0, 0)))
    tan = []
    for k in range(n_top):
        acc_t = Vector()
        for m_ in range(-5, 6):
            kk = min(max(k + m_, 0), n_top - 1)
            acc_t += raw[kk] * (6 - abs(m_))
        tan.append(acc_t.normalized())
    rows = []
    for k, p in enumerate(top):
        t = tan[k]
        n = Vector((-t.z, 0.0, t.x)) if front else Vector((t.z, 0.0, -t.x))
        if n.length < 1e-9 or k == 0:
            n = Vector((0, 0, 1 if front else -1))  # centre row stays on x = 0 so the halves weld
        n.normalize()
        facing = max(n.z if front else -n.z, 0.0)
        ds = 0.12 + 0.88 * facing ** 1.6
        y_bot = (0.205 if front else 0.255) + 0.05 * (acc[k] / L) ** 2
        hgt = p.y - y_bot
        rows.append([_arch_clip(p + n * (dd * ds) - Vector((0, uu * hgt, 0))) for uu, dd in zip(u, d)])
    g = Geo()
    idx = [[g.v(v) for v in r] for r in rows]
    # lower grille opening in the front fascia: |x| < 0.36 between u 0.40 and 0.78
    hole_i = [i for i in range(n_top - 1) if front and top[i + 1].x < 0.36]
    hole_j = (4, 6)
    for i in range(n_top - 1):
        for j in range(len(u) - 1):
            if i in hole_i and hole_j[0] <= j < hole_j[1]:
                continue
            a, b, c, e = idx[i][j], idx[i][j + 1], idx[i + 1][j + 1], idx[i + 1][j]
            g.f((a, b, c, e) if front else (a, e, c, b), XRAY, None, False)
    if hole_i:
        # inward flange around the opening (the half-hole is open at the centreline)
        i_last = hole_i[-1] + 1
        ring = [(i, hole_j[0]) for i in range(0, i_last + 1)] + [(i_last, hole_j[0] + 1), (i_last, hole_j[1])] + [(i, hole_j[1]) for i in range(i_last - 1, -1, -1)]
        for (i_a, j_a), (i_b, j_b) in zip(ring[:-1], ring[1:]):
            pa, pb = rows[i_a][j_a], rows[i_b][j_b]
            qa, qb = pa + Vector((0, 0, -0.035)), pb + Vector((0, 0, -0.035))
            va, vb, vc, vd = g.v(pa), g.v(pb), g.v(qb), g.v(qa)
            g.f((va, vb, vc, vd), XRAY, None, False)
    # inward return flange along the bottom edge (reads as material thickness in the rim)
    for i in range(n_top - 1):
        p0, p1 = rows[i][-1], rows[i + 1][-1]
        q0, q1 = p0 + Vector((0, 0.0, -0.05 if front else 0.05)), p1 + Vector((0, 0.0, -0.05 if front else 0.05))
        a, b, c, e = g.v(p0), g.v(p1), g.v(q1), g.v(q0)
        g.f((a, b, c, e) if front else (a, e, c, b), XRAY, None, False)
    g = weld(g.extend(g.mirrored_x()), 1e-5)
    if front:
        # upper grille strip between the lamps (nose station -> hood leading edge)
        g += m.region(2.125, 2.08, K5, K7, XRAY, hem=0.004, mirror=True)
        # lower grille: horizontal x-ray slats inside the opening + steel crash beam behind
        for y in (0.30, 0.345, 0.39, 0.435):
            g += box(0.64, 0.006, 0.014, XRAY, center=(0.0, y, 2.150))
        beam = [Vector((x, 0.46, 2.07 - 0.20 * (abs(x) / 0.72) ** 2.2)) for x in [i / 10 * 1.44 - 0.72 for i in range(11)]]
        g += box_tube(beam, 0.090, 0.040, DARK, r=0.008, fillet=0.02, hard=False)
    return g


def front_face_z(x: float, y: float, lite: bool = False) -> float:
    """z of the front fascia surface at (x, y) (ray cast from the front), for flush fittings."""
    from mathutils.geometry import intersect_ray_tri

    g = bumper(True, lite)
    o, d = Vector((x, y, 3.0)), Vector((0.0, 0.0, -1.0))
    best = None
    for f, mat in zip(g.faces, g.mats):
        if mat != XRAY:
            continue
        vs = [g.verts[i] for i in f]
        for k in range(1, len(vs) - 1):
            h = intersect_ray_tri(vs[0], vs[k], vs[k + 1], d, o, True)
            if h is not None and (best is None or h.z > best):
                best = h.z
    return best if best is not None else 2.15


# --------------------------------------------------------------------------- mirrors, wipers


def mirror_left(lite: bool) -> Geo:
    """Housing lofted outward along x (22 cm), rounded front, glass on the rear face, short arm."""
    g = Geo()
    n = 20 if lite else 28
    cy, cz = 1.035, 0.640
    secs = []
    for x, s in ((0.868, 0.55), (0.895, 0.86), (0.950, 1.0), (1.030, 1.0), (1.068, 0.86), (1.084, 0.52)):
        pts = superellipse2d(0.052 * s, 0.066 * s, 3.2, n)
        secs.append([(x, cy + py, cz + (pz if pz > 0 else pz * 0.82)) for pz, py in pts])
    g += loft(secs, XRAY, closed=True, caps=True, hard=False)
    gl = extrude(rounded_rect(0.176, 0.100, 0.024, 3), 0.004, MIRROR, z0=0.0)
    g += gl.moved(0.976, cy, cz - 0.052 * 0.82 - 0.0065)
    g += box(0.050, 0.040, 0.075, BLACK, center=(0.858, 1.004, 0.668))
    return g


def wipers(lite: bool) -> Geo:
    """Two arms parked along the base of the windshield, pointing to the passenger side."""
    g = Geo()
    ng = Vector((0.0, 0.857, 0.515))  # windshield normal near its base (31 deg rake)
    ug = Vector((0.0, 0.515, -0.857))  # up the glass
    for px, length, ang in ((0.600, 0.560, 4.0), (0.020, 0.600, 6.0)):
        base = Vector((px, 1.014, 0.792))
        dirv = (Vector((-math.cos(math.radians(ang)), 0.0, 0.0)) + ug * math.sin(math.radians(ang))).normalized()
        pts = [base + dirv * (length * t) + ng * (0.030 - 0.014 * t) for t in (0.0, 0.30, 0.65, 1.0)]
        g += cylinder(0.017, 0.024, 16, PAINT, axis="y").moved(base.x, base.y + 0.008, base.z)
        g += box_tube(pts, 0.012, 0.009, PAINT, r=0.003, fillet=0.03, up=tuple(ng))
        b0 = base + dirv * (length * 0.14) + ng * 0.010
        b1 = base + dirv * (length * 1.0) + ng * 0.008
        g += box_tube([b0, b1], 0.014, 0.011, RUBBER, r=0.003, up=tuple(ng))
    return g


# --------------------------------------------------------------------------- build


# window openings in the greenhouse frame: (z_front, z_rear, j_bottom, j_top)
WINDOWS = [
    (0.75, -0.13, K4 + 1, K6 - 1),
    (-0.23, -0.99, K4 + 1, K6 - 1),
    (-1.07, -1.30, K4 + 1, K6 - 2),
]


def build(ctx) -> None:
    lite = ctx.lite
    m = master(lite)
    # hood (full width, from the upper-grille line), fenders, doors
    hood = m.region(2.08, ZF, K5, K7, XRAY, mirror=True)
    add_centered(ctx, "hauba", "main", hood, bevel=0.0)
    fender = m.region(1.87, ZF, K0, K5, XRAY)
    add_centered(ctx, "blatobrani", "l", fender.copy(), bevel=0.0)
    add_centered(ctx, "blatobrani", "r", fender.mirrored_x(), bevel=0.0)
    fdoor = m.region(ZF, ZB, K0, K4, XRAY)
    rdoor = m.region(ZB, ZR, K0, K4, XRAY)
    for inst, g0 in (("fl", fdoor), ("rl", rdoor)):
        add_centered(ctx, "vrata", inst, g0.copy(), bevel=0.0)
        add_centered(ctx, "vrata", inst.replace("l", "r"), g0.mirrored_x(), bevel=0.0)
    # glass
    ws = glass_inset(m.region(ZF, 0.12, K6, K7, GLASS, hem=0.003, mirror=True))
    add_centered(ctx, "stakla", "windshield", ws, bevel=0.0)
    rg = glass_inset(m.region(-1.42, -1.86, K6, K7, GLASS, hem=0.003, mirror=True))
    add_centered(ctx, "stakla", "rear", rg, bevel=0.0)
    side = Geo()
    for zf, zr, ja, jb in WINDOWS:
        side += glass_inset(m.region(zf, zr, ja, jb, GLASS, hem=0.003))
    side = side.extend(side.mirrored_x())
    add_centered(ctx, "stakla", "side", side, bevel=0.0)
    # bumpers
    add_centered(ctx, "branici", "front", bumper(True, lite), bevel=0.0)
    add_centered(ctx, "branici", "rear", bumper(False, lite), bevel=0.0)
    # mirrors + wipers
    ml = mirror_left(lite)
    add_centered(ctx, "retrovizori", "l", ml, bevel=0.0015)
    add_centered(ctx, "retrovizori", "r", ml.mirrored_x(), bevel=0.0015)
    add_centered(ctx, "brisaci", "main", wipers(lite), bevel=0.0)
    # --- non-clickable structure (x-ray): roof + greenhouse frame (upper), quarters, tail
    upper = m.region(0.12, -1.42, K6, K7, XRAY, mirror=True)
    gh = frame(m, ZF, -1.86, K4, K6, WINDOWS, XRAY)
    upper += gh
    upper += gh.mirrored_x()
    ctx.add_static_empty("body__structure", "karoserija")
    ctx.add_static("body__structure__upper", "karoserija", upper, parent_name="body__structure")
    quarter = m.region(ZR, -1.86, K0, K4, XRAY)
    ctx.add_static("body__structure__left", "karoserija", quarter, parent_name="body__structure")
    ctx.add_static("body__structure__right", "karoserija", quarter.mirrored_x(), parent_name="body__structure")
    # rear end tiling around the corner lamps: tailgate centre, strip under the lamp, low corner
    tail = m.region(-1.86, -2.03, K5 + 2, K7, XRAY, mirror=True)
    for zf, zr, j0, j1 in ((-1.99, -2.03, K3, K5 + 2), (-1.86, -2.03, K0, K3)):
        piece = m.region(zf, zr, j0, j1, XRAY)
        tail += piece
        tail += piece.mirrored_x()
    ctx.add_static("body__structure__rear", "karoserija", tail, parent_name="body__structure")
