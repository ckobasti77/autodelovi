"""Upravljanje: steering rack with EPS, tie rods, front anti-roll bar with drop links."""

from __future__ import annotations

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, box, catmull, cylinder, lathe, polyline_fillet, tube
from lib.shapes import along, ball_joint, bellows, bushing, hex_nut

ALU = "mat_cast_alu"
DARK = "mat_steel_dark"
RUBBER = "mat_rubber"

Y, Z = VH.RACK_Y, VH.RACK_Z


def rack(lite: bool) -> Geo:
    seg = 18 if lite else 24
    g = Geo()
    # housing tube along x with end collars
    g += lathe([(0.0, -0.300), (0.024, -0.300), (0.024, 0.300), (0.0, 0.300)], seg, ALU, axis="x", hard=False)
    for x in (-0.300, 0.300):
        g += lathe([(0.0, -0.012), (0.030, -0.012), (0.030, 0.012), (0.0, 0.012)], seg, ALU, axis="x", hard=False).moved(x, 0, 0)
    # bellows boots (the tie rods leave through them)
    for s in (1, -1):
        b = bellows(0.016, 0.027, 0.075, 5, RUBBER, seg=seg)
        g += b.transform(R("z", -90 * s)).moved(s * 0.310, 0, 0)
    # pinion housing + column stub, rising up and back on the driver side (+x)
    ph = lathe([(0.0, 0.0), (0.032, 0.0), (0.032, 0.080), (0.022, 0.095), (0.022, 0.120), (0.0, 0.120)], seg, ALU, hard=False)
    g += along(ph, Vector((0.20, 0.0, 0.0)), Vector((0.20, 0.80, -0.60)) + Vector((0.20, 0, 0)) * 0)
    shaft = cylinder(0.011, 0.10, 12, DARK, center=False)
    g += along(shaft, Vector((0.20, 0.090, -0.068)), Vector((0.20, 0.170, -0.128)))
    # EPS motor parallel to the rack (dual pinion), with cooling ribs and an ECU box
    mot = lathe([(0.0, 0.0), (0.040, 0.0), (0.042, 0.010)] + [(0.040 if i % 2 else 0.043, 0.010 + 0.012 * i) for i in range(1, 12)] + [(0.036, 0.150), (0.0, 0.152)], seg, ALU, axis="x", hard=False)
    g += mot.moved(0.030, -0.045, -0.050)
    g += box(0.080, 0.050, 0.060, ALU, center=(0.105, -0.080, -0.090))
    # mounting clamps
    for x in (-0.18, 0.12):
        g += lathe([(0.026, -0.018), (0.032, -0.018), (0.032, 0.018), (0.026, 0.018), (0.026, -0.018)], seg, DARK, axis="x", hard=False).moved(x, 0, 0)
        g += box(0.036, 0.012, 0.070, DARK, center=(x, -0.030, 0.0))
    return g


def tie_rod(lite: bool) -> Geo:
    """Left tie rod, absolute coordinates: rack end (0.36) -> steering arm (0.66)."""
    g = Geo()
    x0, x1 = 0.372, 0.646
    g += lathe([(0.0, 0.0), (0.015, 0.0), (0.018, 0.012), (0.015, 0.024), (0.0, 0.026)], 16, DARK, axis="x", hard=False).moved(x0, Y, Z)
    g += cylinder(0.0072, (x1 - 0.030) - (x0 + 0.020), 12, DARK, axis="x", center=False).moved(x0 + 0.020, Y - 0.0015, Z)
    g += hex_nut(0.022, 0.012, DARK).transform(R("z", -90)).moved(x1 - 0.045, Y - 0.002, Z)
    # outer tie-rod end: forged housing + ball joint stud pointing up into the steering arm
    g += lathe([(0.0, -0.012), (0.015, -0.012), (0.012, 0.010), (0.0, 0.012)], 12, DARK, axis="x", hard=False).moved(x1 - 0.028, Y - 0.002, Z)
    g += ball_joint(0.015, DARK, RUBBER, (0, 1, 0)).moved(x1, Y - 0.020, Z)
    return g


def stabilizer(lite: bool) -> Geo:
    g = Geo()
    y0, zc = 0.262, 1.022
    pts = [(-0.560, 0.292, 1.212), (-0.485, 0.280, 1.110), (-0.36, y0, zc), (0.36, y0, zc), (0.485, 0.280, 1.110), (0.560, 0.292, 1.212)]
    path = polyline_fillet(pts, 0.07, 8)
    g += tube(path, 0.0115, 10 if lite else 12, DARK, hard=False, caps=True)
    for x in (-0.30, 0.30):
        g += bushing("x", 0.022, 0.036, RUBBER, DARK, seg=16).moved(x, y0, zc)
        g += box(0.040, 0.010, 0.060, DARK, center=(x, y0 + 0.024, zc))
    # drop links up to the strut brackets
    for s in (1, -1):
        a = Vector((s * 0.560, 0.292, 1.212))
        b = Vector((s * 0.605, 0.505, 1.222))
        # strut-side bracket tab reaching forward to the damper body
        g += box(0.012, 0.024, 0.062, DARK, center=(s * 0.618, 0.505, 1.255))
        g += along(cylinder(0.0055, (b - a).length - 0.03, 10, DARK, center=False), a + (b - a).normalized() * 0.015, b)
        g += ball_joint(0.011, DARK, RUBBER, (0, -1, 0)).moved(*b)
        g += ball_joint(0.011, DARK, RUBBER, (0, 1, 0)).moved(*a)
    return g


def build(ctx) -> None:
    lite = ctx.lite
    piv = (0.02, Y, Z)
    ctx.add_part("letva-volana", "main", piv, rack(lite).moved(0.0, 0, 0).moved(0.02 - piv[0], 0, 0), bevel=0.0015)
    tr = tie_rod(lite)
    for inst, s in (("tie-rod-l", 1), ("tie-rod-r", -1)):
        gg = tr.copy() if s > 0 else tr.mirrored_x()
        p = (s * 0.51, Y - 0.004, Z)
        ctx.add_part("spone-stabilizatori", inst, p, gg.moved(-p[0], -p[1], -p[2]), bevel=0.001)
    st = stabilizer(lite)
    p = (0.0, 0.28, 1.14)
    ctx.add_part("spone-stabilizatori", "stabilizer", p, st.moved(-p[0], -p[1], -p[2]), bevel=0.0)
