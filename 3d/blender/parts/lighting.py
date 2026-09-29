"""Svetla: headlamps and tail lamps. Lenses are master-surface patches (so they continue the body
exactly), housings are the lens outline lofted back and tapered, internals sit behind the lens."""

from __future__ import annotations

from mathutils import Vector

from lib.bodyshell import K, boundary, height_band, hem_strip, iso_height, ray_hit, surface
from lib.geo import Geo, R, catmull, lathe, loft, sweep, rounded_rect
from lib.parts import add_centered
from parts.body import master

LENS = "mat_glass_lens"
PLASTIC = "mat_plastic_black"
ALU = "mat_brushed_alu"
LED = "mat_emissive_led"
TAIL = "mat_emissive_tail"

K0, K1, K2, K3, K4, K5, K6, K7 = K
Z_LAMP_F = (2.125, 1.87)
Z_LAMP_R = (-1.86, -1.99)
J_LAMP_R = (K3, K5 + 2)


def lens_geo(rows) -> Geo:
    return surface(rows, LENS).extend(hem_strip(rows, 0.003, LENS))


def housing(rows, back: Vector, scale: float, mat: str = PLASTIC) -> Geo:
    """Lens outline (inset 4 mm) lofted to a tapered back ring and capped."""
    loop, nrm = boundary(rows)
    ring0 = [p - n * 0.004 for p, n in zip(loop, nrm)]
    c = sum(ring0, Vector()) / len(ring0)
    ring1 = [c + (p - c) * scale + back for p in ring0]
    g = loft([ring0, ring1], mat, closed=True, caps=False, hard=False)
    cb = g.v(sum(ring1, Vector()) / len(ring1))
    n0 = len(ring0)
    for j in range(n0):
        j1 = (j + 1) % n0
        g.f((n0 + j, n0 + j1, cb), mat, None, False)
    # orient outward: faces should point away from the housing centre
    centre = (c + sum(ring1, Vector()) / len(ring1)) / 2
    score = 0.0
    for f in g.faces[: n0]:
        a, b, cc = g.verts[f[0]], g.verts[f[1]], g.verts[f[2]]
        nrm_f = (b - a).cross(cc - a)
        score += nrm_f.dot((a + b + cc) / 3 - centre)
    if score < 0:
        g.faces = [tuple(reversed(f)) for f in g.faces]
    return g


def inset_curve(rows, j: int, depth: float, i_range=None) -> list[Vector]:
    """Curve along column j of a region, pushed inward along the surface normal."""
    from lib.bodyshell import _normal

    idx = range(len(rows)) if i_range is None else i_range
    return [rows[i][j] - _normal(rows, i, j) * depth for i in idx]


def iso_height_column(rows, p: Vector, span: float = 0.065) -> list[Vector]:
    """Points rising from p along the nearest grid row (constant station), inset 13 mm."""
    from lib.bodyshell import _normal

    i = min(range(len(rows)), key=lambda k: min((q - p).length for q in rows[k]))
    out = []
    for j in range(len(rows[i])):
        q = rows[i][j]
        if p.y - 1e-4 <= q.y <= p.y + span:
            out.append(q - _normal(rows, i, j) * 0.013)
    return out


def guide(path: list[Vector], w: float, h: float, mat: str) -> Geo:
    if len(path) < 2:
        return Geo()
    pts = catmull(path, 3) if len(path) > 2 else path
    return sweep(pts, rounded_rect(w, h, min(w, h) * 0.45, 2), mat, up_hint=Vector((0, 1, 0)), hard=False, caps=True)


def headlamp_left(lite: bool) -> Geo:
    m = master(lite)
    rows = m.rows(*Z_LAMP_F, K0, K5)
    g = lens_geo(rows)
    g += housing(rows, Vector((-0.015, 0.012, -0.105)), 0.72)
    # brushed inner bezel 18 mm behind the lens: the projector and the reflector bowl sit in it
    from lib.bodyshell import _normal

    nr, nc = len(rows), len(rows[0])
    bezel = [[rows[i][j] - _normal(rows, i, j) * 0.018 for j in range(1, nc - 1)] for i in range(1, nr - 1)]
    if len(bezel) > 1 and len(bezel[0]) > 1:
        g += surface(bezel, ALU)
    seg = 28 if lite else 40
    # projector (inner) and high-beam reflector (outer), both facing +z behind the lens
    for (x, y, r, kind) in ((0.585, 0.700, 0.029, "proj"), (0.700, 0.690, 0.031, "refl")):
        hit = ray_hit(rows, (x, y, 3.0), (0, 0, -1))
        zf = (hit.z if hit is not None else 2.05) - 0.014
        if kind == "proj":
            # lens dome, bezel ring and barrel
            g += lathe([(0.0, 0.006), (r * 0.6, 0.004), (r, 0.0), (r, -0.006), (0.0, -0.006)], seg, LENS, axis="z", hard=False).moved(x, y, zf)
            g += lathe([(r, 0.002), (r + 0.010, -0.004), (r + 0.010, -0.012), (r, -0.012), (r, 0.002)], seg, ALU, axis="z", hard=False).moved(x, y, zf)
            g += lathe([(r * 0.95, -0.012), (r * 1.05, -0.030), (r * 0.9, -0.080), (0.0, -0.085)], seg, PLASTIC, axis="z", hard=False).moved(x, y, zf)
        else:
            bowl = [(0.004, -0.040), (r * 0.45, -0.034), (r * 0.75, -0.020), (r, 0.0), (r + 0.004, 0.0), (r + 0.004, -0.004)]
            g += lathe(bowl, seg, ALU, axis="z", hard=False).moved(x, y, zf)
            g += lathe([(0.0, -0.030), (0.006, -0.030), (0.006, -0.018), (0.0, -0.016)], 12, LED, axis="z", hard=False).moved(x, y, zf)
    # DRL light guide (generic L): a bar along the lower lens edge wrapping the corner, plus a
    # short rising leg at its inner (front) end
    low = iso_height(rows, 0.676, 0.013)
    if len(low) > 2:
        g += guide(low, 0.009, 0.006, LED)
        start = low[0]
        leg = [p for p in iso_height_column(rows, start) if p.y >= start.y - 1e-4]
        g += guide(leg, 0.009, 0.006, LED)
    return g


def taillamp_left(lite: bool) -> Geo:
    """Corner lamp wrapping from the rear quarter onto the rear face: clear lens, black housing,
    red lamp body 12 mm behind the lens."""
    from lib.bodyshell import _normal

    m = master(lite)
    rows = m.rows(*Z_LAMP_R, *J_LAMP_R)
    g = lens_geo(rows)
    g += housing(rows, Vector((-0.030, 0.0, 0.060)), 0.84)
    nr, nc = len(rows), len(rows[0])
    inner = [[rows[i][j] - _normal(rows, i, j) * 0.012 for j in range(1, nc - 1)] for i in range(1, nr - 1)]
    if len(inner) > 1 and len(inner[0]) > 1:
        g += surface(inner, TAIL)
    return g


def build(ctx) -> None:
    lite = ctx.lite
    hl = headlamp_left(lite)
    add_centered(ctx, "farovi", "l", hl, bevel=0.0)
    add_centered(ctx, "farovi", "r", hl.mirrored_x(), bevel=0.0)
    tl = taillamp_left(lite)
    add_centered(ctx, "stop-svetla", "l", tl, bevel=0.0)
    add_centered(ctx, "stop-svetla", "r", tl.mirrored_x(), bevel=0.0)
