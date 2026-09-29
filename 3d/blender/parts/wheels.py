"""Felne i gume — 16 x 6.5J ET46 five-twin-spoke alloy + 205/55 R16 tyre (one shared mesh x 4)."""

from __future__ import annotations

import math

from config import vehicle as VH
from lib.corner import from_extrude, place, rh_ccw
from lib.geo import Geo, circle2d, extrude, lathe, radial

ALU = "mat_brushed_alu"
BARREL = "mat_painted_black"
TYRE = "mat_tyre"


def tyre(seg: int, lite: bool) -> Geo:
    rb, rt = 0.2055, VH.TYRE_R  # bead, tread radius
    half = 0.1025
    # sidewall (inboard, going outward in r at negative h)
    side = [
        (rb, -0.0835), (0.214, -0.0905), (0.228, -0.0975), (0.248, -0.1018), (0.266, -0.1025),
        (0.282, -0.1005), (0.295, -0.0960), (0.3045, -0.0895), (0.3110, -0.0820), (0.3148, -0.0745),
    ]
    tread = [(0.3155, -0.0745), (rt, -0.0690)]
    grooves = [-0.060, -0.025, 0.025, 0.060] if not lite else []
    hs = [-0.0690]
    for gc in grooves:
        hs += [gc - 0.0055, gc - 0.0045, gc + 0.0045, gc + 0.0055]
    hs += [0.0690]
    for i, h in enumerate(hs[1:-1]):
        k = i % 4
        r = rt if k in (0, 3) else rt - 0.008
        tread.append((r, h))
    tread += [(rt, 0.0690), (0.3155, 0.0745)]
    side_out = [(r, -h) for r, h in reversed(side)]
    g = Geo()

    def v_side(profile):
        return [0.5 * (r - rb) / (0.3148 - rb) for r, _ in profile]

    g += lathe(side, seg, TYRE, hard=False, uv_u=48, v_list=v_side(side))
    tv = [0.5 + 0.5 * (h + 0.0745) / 0.149 for _, h in tread]
    g += lathe(tread, seg, TYRE, hard=False, uv_u=24, v_list=tv)
    g += lathe(side_out, seg, TYRE, hard=False, uv_u=48, v_list=v_side(side_out))
    _ = half
    return g


def lip(outboard: bool, seg: int) -> Geo:
    prof = [(0.2020, 0.0700), (0.2120, 0.0725), (0.2195, 0.0775), (0.2222, 0.0830), (0.2190, 0.0872), (0.2090, 0.0858), (0.2010, 0.0800), (0.2020, 0.0700)]
    if not outboard:
        prof = [(r, -h) for r, h in prof]
    prof = rh_ccw(prof[:-1])
    prof = prof + [prof[0]]
    return lathe(prof, seg, ALU, hard=False)


def barrel(seg: int) -> Geo:
    # visible inner surface, normals toward the axis -> profile runs from +h to -h
    prof = [(0.2010, 0.0720), (0.1960, 0.0600), (0.1900, 0.0440), (0.1790, 0.0300), (0.1780, -0.0150), (0.1840, -0.0350), (0.1930, -0.0560), (0.1985, -0.0700), (0.2020, -0.0790)]
    return lathe(prof, seg, BARREL, hard=False)


def dish(h_hub: float, h_rim: float, r0: float, r1: float):
    def f(r):
        t = min(max((r - r0) / (r1 - r0), 0.0), 1.0)
        return h_hub + (h_rim - h_hub) * (t * t * (3 - 2 * t))
    return f


def spoke_bar(a_hub: float, a_rim: float, w_hub: float, w_rim: float, r0: float = 0.070, r1: float = 0.212, n: int = 6) -> list:
    """Straight tapered spoke outline (extrude 2D coords (X, -Z)) from angle a_hub to a_rim (deg)."""
    import math as m

    left, right = [], []
    for i in range(n + 1):
        t = i / n
        r = r0 + (r1 - r0) * t
        a = m.radians(a_hub + (a_rim - a_hub) * t)
        w = (w_hub + (w_rim - w_hub) * t) / 2
        cx, cz = r * m.cos(a), r * m.sin(a)
        nx, nz = -m.sin(a), m.cos(a)
        left.append((cx + nx * w, -(cz + nz * w)))
        right.append((cx - nx * w, -(cz - nz * w)))
    return right + list(reversed(left))


def spokes(lite: bool) -> Geo:
    g = Geo()
    f = dish(0.044, 0.058, 0.088, 0.138)
    for k in range(5):
        c = 72.0 * k + 36.0
        for side in (-1, 1):
            out = spoke_bar(c + side * 4.0, c + side * 7.5, 0.030, 0.024)
            sp = from_extrude(extrude(out, 0.024, ALU))
            for v in sp.verts:
                r = math.hypot(v.x, v.z)
                top = v.y > 0.012
                v.y += f(r) + (0.0 if top else 0.0)
                if top:
                    # crown: narrow the top face slightly (draft) toward the spoke centreline
                    pass
            g += sp
    # rim face ring joining the spoke ends to the outboard lip
    ring = [(0.1840, 0.0580), (0.2130, 0.0640), (0.2140, 0.0795), (0.2070, 0.0830), (0.1890, 0.0800), (0.1830, 0.0700)]
    g += lathe(rh_ccw(ring) + [rh_ccw(ring)[0]], 72, ALU, hard=False)
    return g


def hub(seg: int) -> Geo:
    g = Geo()
    outline = circle2d(0.088, seg // 2)
    holes = []
    for k in range(5):
        a = 2 * math.pi * k / 5 + math.pi / 5
        cx, cz = 0.056 * math.cos(a), 0.056 * math.sin(a)
        holes.append(circle2d(0.0105, 16, cx, -cz))
    holes.append(circle2d(0.031, 24))
    g += from_extrude(extrude(outline, 0.017, ALU, holes=holes, z0=0.046, hard=False))
    # bolts (in the rim material) and a plain centre cap
    for k in range(5):
        a = 2 * math.pi * k / 5 + math.pi / 5
        cx, cz = 0.056 * math.cos(a), 0.056 * math.sin(a)
        b = lathe([(0.0, 0.048), (0.0085, 0.048), (0.0085, 0.058), (0.0072, 0.0605), (0.0, 0.0610)], 10, ALU, hard=False)
        g.extend(b.moved(cx, 0, cz))
    cap = lathe([(0.0, 0.050), (0.0300, 0.050), (0.0300, 0.059), (0.0270, 0.0625), (0.0150, 0.0645), (0.0, 0.0650)], 32, ALU, hard=False)
    g += cap
    return g


def wheel_axis_geo(lite: bool) -> Geo:
    seg = 48 if lite else 72
    g = Geo()
    g += tyre(seg, lite)
    g += lip(True, seg)
    g += lip(False, seg)
    g += barrel(seg)
    g += spokes(lite)
    g += hub(seg)
    return g


def build(ctx) -> None:
    g_axis = wheel_axis_geo(ctx.lite)
    for corner in ("fl", "fr", "rl", "rr"):
        front = corner[0] == "f"
        x = VH.X_WHEEL_F if front else VH.X_WHEEL_R
        z = VH.Z_FRONT_AXLE if front else VH.Z_REAR_AXLE
        left = corner[1] == "l"
        pivot = (x if left else -x, VH.WHEEL_Y, z)
        g = place(g_axis, corner, 0.0, pivot) if left else None
        # one mesh for all four: left geometry, right side = yaw 180 (non-directional tread)
        ctx.add_part(
            "felne-gume", corner, pivot, place(g_axis, "fl", 0.0, (VH.X_WHEEL_F, VH.WHEEL_Y, VH.Z_FRONT_AXLE)),
            bevel=0.0015, shared_key="wheel", yaw180=not left,
        )
        _ = g
