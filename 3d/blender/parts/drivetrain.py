"""Transmisija: dual-mass flywheel + clutch kit, DSG gearbox, driveshafts with CV joints."""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, S, T, box, circle2d, cylinder, extrude, gear2d, lathe, radial, rounded_rect
from lib.parts import add_centered
from lib.shapes import bellows
from parts.brakes import lathe_closed

STEEL = "mat_machined_steel"
IRON = "mat_cast_iron"
DARK = "mat_steel_dark"
RUBBER = "mat_rubber"
ALU = "mat_cast_alu"
PLASTIC = "mat_plastic_black"

CY, CZ = VH.CRANK_Y, VH.CRANK_Z


def clutch(lite: bool) -> Geo:
    g = Geo()
    seg = 40 if lite else 64
    # dual-mass flywheel body (engine side) with a machined friction face
    g += lathe([(0.0, 0.000), (0.132, 0.000), (0.138, 0.006), (0.138, 0.030), (0.120, 0.034), (0.0, 0.034)], seg, IRON, axis="x", hard=False)
    g += lathe([(0.060, 0.034), (0.118, 0.034), (0.118, 0.037), (0.060, 0.037), (0.060, 0.034)], seg, STEEL, axis="x", hard=False)
    # starter ring gear (132 teeth) as real geometry
    ring = extrude(gear2d(66 if lite else 132, 0.1435, 0.1478, 0.40, 0.30), 0.012, STEEL, holes=[circle2d(0.137, seg)])
    ring.transform(R("y", 90))
    g += ring.moved(0.004, 0, 0)
    for k in range(8):
        a = 2 * math.pi * k / 8
        g += cylinder(0.006, 0.006, 8, DARK, axis="x").moved(0.038, 0.030 * math.cos(a), 0.030 * math.sin(a))
    # clutch disc: friction lining segments + hub with torsion springs
    for k in range(6):
        seg_l = lathe([(0.075, 0.040), (0.114, 0.040), (0.114, 0.048), (0.075, 0.048), (0.075, 0.040)], 6, RUBBER, axis="x", hard=False, angle=54.0, phase=60.0 * k)
        g += seg_l
    g += lathe([(0.020, 0.041), (0.075, 0.041), (0.075, 0.047), (0.020, 0.047), (0.020, 0.041)], 32, DARK, axis="x", hard=False)
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.25
        sp = cylinder(0.006, 0.028, 10, STEEL, axis="z").transform(R("x", math.degrees(a)))
        g += sp.moved(0.046, 0.050 * math.cos(a), 0.050 * math.sin(a))
    # splined disc hub, seen through the diaphragm centre
    g += lathe_closed([(0.012, 0.036), (0.019, 0.036), (0.019, 0.078), (0.017, 0.080), (0.012, 0.080)], 24, DARK, axis="x")
    # pressure plate (cast iron ring), visible through the cover windows
    g += lathe_closed([(0.074, 0.049), (0.116, 0.049), (0.117, 0.050), (0.117, 0.062), (0.114, 0.064), (0.076, 0.064), (0.074, 0.062)], seg, IRON, axis="x")
    # stamped cover: bolted flange ring, wall with three windows, domed top with a rolled inner edge
    g += lathe_closed([(0.1215, 0.034), (0.136, 0.034), (0.137, 0.0355), (0.137, 0.0375), (0.136, 0.039), (0.1245, 0.039), (0.1245, 0.044), (0.1215, 0.044)], seg, DARK, axis="x")
    n_arc = 8 if lite else 14
    ang = [math.radians(-34.0 + 68.0 * i / n_arc) for i in range(n_arc + 1)]
    arc = [(0.1245 * math.sin(t), 0.1245 * math.cos(t)) for t in ang] + [(0.1215 * math.sin(t), 0.1215 * math.cos(t)) for t in reversed(ang)]
    wall = extrude(arc, 0.022, DARK)
    wall.transform(R("y", 90))
    g += radial(wall.moved(0.044, 0, 0), 3, "x")
    g += lathe_closed(
        [(0.1215, 0.066), (0.1245, 0.066), (0.1245, 0.072), (0.121, 0.079), (0.112, 0.084), (0.082, 0.089), (0.074, 0.091), (0.071, 0.089),
         (0.072, 0.086), (0.081, 0.0865), (0.111, 0.0815), (0.1195, 0.0765), (0.1215, 0.071)],
        seg, DARK, axis="x",
    )
    # drive straps with rivets in each window (pressure plate lugs to the cover)
    strap = box(0.012, 0.0025, 0.034, DARK, center=(0.056, 0.1185, 0.0))
    for dz in (-0.013, 0.013):
        strap += cylinder(0.0032, 0.004, 10, STEEL, axis="y").moved(0.056, 0.1205, dz)
    g += radial(strap, 3, "x", phase=60.0)
    # cover bolts on the flange, fulcrum rivets on the top
    for k in range(6):
        a = math.radians(30 + 60 * k)
        g += _bolt_x(0.042, 0.131 * math.cos(a), 0.131 * math.sin(a), af=0.010, h=0.006)
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.17
        g += cylinder(0.0034, 0.003, 10, STEEL, axis="x").moved(0.0876, 0.095 * math.cos(a), 0.095 * math.sin(a))
    # diaphragm spring: ring on the rolled edge + tapered fingers with open slots
    g += lathe_closed([(0.064, 0.091), (0.079, 0.091), (0.079, 0.0935), (0.064, 0.0935)], seg, STEEL, axis="x")
    finger = extrude([(0.020, -0.0026), (0.070, -0.0094), (0.070, 0.0094), (0.020, 0.0026)], 0.0025, STEEL)
    finger.transform(R("y", 90))
    g += radial(finger.moved(0.091, 0, 0), 12 if lite else 18, "x")
    return g.moved(0.070, CY, CZ)


def _bolt_x(x: float, y: float, z: float, af: float = 0.012, h: float = 0.007, sign: float = 1.0) -> Geo:
    """Hex bolt head with its axis along vehicle x."""
    from lib.shapes import hex_nut

    return hex_nut(af, h, STEEL).transform(R("z", -90 * sign)).moved(x, y, z)


def _bolt_y(x: float, y: float, z: float, af: float = 0.012, h: float = 0.007) -> Geo:
    from lib.shapes import hex_nut

    return hex_nut(af, h, STEEL).moved(x, y, z)


def gearbox(lite: bool) -> Geo:
    """Transaxle (DSG-like): ribbed bellhousing with a bolted mating flange, lofted main case with
    rib bands, bolted end cover, differential housing with a bolted split flange and output flanges,
    top mount pad with studs, torque-rod lug, starter boss, mechatronic unit with connector,
    drain and fill plugs, speed sensor and breather."""
    from lib.geo import loft, superellipse2d
    from lib.shapes import hex_nut

    g = Geo()
    seg = 36 if lite else 64
    bx = 0.060  # bellhousing mating face (engine side)
    bell = [(0.200, 0.0), (0.206, 0.0), (0.212, 0.012), (0.198, 0.060), (0.172, 0.110), (0.150, 0.140), (0.0, 0.142),
            (0.0, 0.128), (0.140, 0.126), (0.162, 0.098), (0.186, 0.056), (0.198, 0.012), (0.200, 0.0)]
    g += lathe(bell, seg, ALU, axis="x", hard=False).moved(bx, CY, CZ)
    # input shaft with splines and the release bearing guide inside the bell
    g += lathe([(0.0, 0.0), (0.012, 0.0), (0.012, 0.128), (0.0, 0.128)], 16, STEEL, axis="x", hard=False).moved(bx - 0.020, CY, CZ)
    g += lathe([(0.018, 0.070), (0.032, 0.070), (0.034, 0.080), (0.034, 0.110), (0.018, 0.112), (0.018, 0.070)], 28, DARK, axis="x", hard=False).moved(bx, CY, CZ)
    g += lathe([(0.196, 0.0), (0.221, 0.0), (0.223, 0.004), (0.223, 0.016), (0.196, 0.016), (0.196, 0.0)], seg, ALU, axis="x", hard=False).moved(bx, CY, CZ)
    # radial ribs following the bellhousing cone
    prof_r = [(0.018, 0.211), (0.060, 0.198), (0.110, 0.172), (0.136, 0.153)]
    outer = [(x, r + 0.011 - 0.002 * i) for i, (x, r) in enumerate(prof_r)]
    rib2d = [(x, r - 0.004) for x, r in prof_r] + list(reversed(outer))
    n_ribs = 8 if lite else 14
    for k in range(n_ribs):
        ang = 360.0 * k / n_ribs + 11.0
        if 150.0 < ang % 360.0 < 205.0:
            continue  # starter boss region
        rib = extrude(rib2d, 0.007, ALU, z0=-0.0035)
        g += rib.transform(R("x", ang)).moved(bx, CY, CZ)
    # bolt bosses + bolts around the mating flange
    n_b = 8 if lite else 12
    for k in range(n_b):
        a = math.radians(360.0 * k / n_b + 15.0)
        yy, zz = CY + 0.229 * math.cos(a), CZ + 0.229 * math.sin(a)
        g += cylinder(0.011, 0.020, 12, ALU, axis="x", center=False).moved(bx, yy, zz)
        if not lite:
            g += _bolt_x(bx + 0.024, yy, zz)
    # starter mounting boss
    g += lathe([(0.0, 0.0), (0.034, 0.0), (0.034, 0.030), (0.030, 0.036), (0.0, 0.036)], 28, ALU, axis="x", hard=False).moved(0.105, 0.296, 1.668)
    # main case: lofted superellipse sections tapering toward the end cover
    table = ((0.195, 0.205, 0.180, 0.425, 1.425, 3.4), (0.300, 0.212, 0.186, 0.420, 1.420, 3.2), (0.430, 0.205, 0.182, 0.415, 1.405, 3.0),
             (0.530, 0.170, 0.155, 0.410, 1.395, 2.8), (0.575, 0.120, 0.112, 0.410, 1.390, 2.4), (0.592, 0.060, 0.060, 0.410, 1.390, 2.0))
    ns = 32 if lite else 48
    secs = []
    for x, aa, bb, cy_, cz_, ex in table:
        pts = superellipse2d(aa, bb, ex, ns)
        secs.append([(x, cy_ + py, cz_ + pz) for pz, py in pts])
    g += loft(secs, ALU, closed=True, caps=True, hard=False)

    def section_at(x: float, scale: float):
        for (x0, a0, b0, cy0, cz0, e0), (x1, a1, b1, cy1, cz1, e1) in zip(table[:-1], table[1:]):
            if x0 <= x <= x1:
                t = (x - x0) / (x1 - x0)
                aa, bb = a0 + (a1 - a0) * t, b0 + (b1 - b0) * t
                cy_, cz_, ex = cy0 + (cy1 - cy0) * t, cz0 + (cz1 - cz0) * t, e0 + (e1 - e0) * t
                pts = superellipse2d(aa * scale, bb * scale, ex, ns)
                return [(x, cy_ + py, cz_ + pz) for pz, py in pts], (cy_, cz_, aa, bb)
        raise ValueError(x)

    # rib bands around the case (closed ring profiles, 8 mm wide)
    for xr in ((0.262, 0.345, 0.405, 0.500) if not lite else (0.300, 0.450)):
        s0, _ = section_at(xr, 1.0)
        s1, _ = section_at(xr, 1.035)
        s2, _ = section_at(xr + 0.008, 1.035)
        s3, _ = section_at(xr + 0.008, 1.0)
        g += loft([s0, s1, s2, s3, s0], ALU, closed=True, caps=False, hard=False)
    # longitudinal ribs on the top of the case
    for dz in (-0.075, 0.0, 0.075):
        g += box(0.300, 0.012, 0.007, ALU, center=(0.385, 0.600 - abs(dz) * 0.10, 1.412 + dz))
    # end cover flange ring + bolts
    e0, (cy_e, cz_e, ae, be) = section_at(0.566, 1.0)
    e1, _ = section_at(0.566, 1.06)
    e2, _ = section_at(0.574, 1.06)
    e3, _ = section_at(0.574, 1.0)
    g += loft([e0, e1, e2, e3, e0], ALU, closed=True, caps=False, hard=False)
    if not lite:
        for k in range(10):
            a = 2 * math.pi * k / 10 + 0.2
            g += _bolt_x(0.577, cy_e + be * 1.03 * math.sin(a), cz_e + ae * 1.03 * math.cos(a), af=0.010, h=0.006)
    # differential housing: bulge, bolted split flange, output flanges, drain plug
    g += lathe([(0.0, 0.220), (0.092, 0.220), (0.098, 0.240), (0.098, 0.420), (0.090, 0.440), (0.0, 0.440)], seg, ALU, axis="x", hard=False).moved(0.0, 0.330, 1.310)
    g += lathe([(0.092, 0.0), (0.110, 0.0), (0.110, 0.012), (0.092, 0.012), (0.092, 0.0)], seg, ALU, axis="x", hard=False).moved(0.300, 0.330, 1.310)
    if not lite:
        for k in range(10):
            a = 2 * math.pi * k / 10
            g += _bolt_x(0.314, 0.330 + 0.103 * math.cos(a), 1.310 + 0.103 * math.sin(a), af=0.010, h=0.006)
    for x, sgn in ((0.440, 1), (0.090, -1)):
        fl = lathe([(0.0, 0.0), (0.040, 0.0), (0.045, 0.008), (0.045, 0.018), (0.0, 0.020)], 24, DARK, axis="x" if sgn > 0 else "-x", hard=False)
        g += fl.moved(x, 0.330, 1.310)
    g += hex_nut(0.019, 0.010, STEEL).moved(0.250, 0.228, 1.310)
    g += hex_nut(0.019, 0.010, STEEL).transform(R("x", 90)).moved(0.420, 0.430, 1.228)
    # top mount pad (to the left gearbox mount) with three studs and nuts
    g += extrude(rounded_rect(0.090, 0.110, 0.016, 3), 0.026, ALU, z0=0.0).transform(R("x", -90)).moved(0.470, 0.590, 1.440)
    for dx, dz in ((-0.028, -0.034), (0.028, -0.034), (0.0, 0.036)):
        g += cylinder(0.005, 0.030, 8, STEEL, axis="y", center=False).moved(0.470 + dx, 0.614, 1.440 + dz)
        if not lite:
            g += _bolt_y(0.470 + dx, 0.622, 1.440 + dz, af=0.013, h=0.008)
    # torque-rod lug cast under the differential housing / case bottom (rear side)
    g += box(0.040, 0.034, 0.060, ALU, center=(0.245, 0.240, 1.228))
    g += cylinder(0.008, 0.052, 12, STEEL, axis="x").moved(0.245, 0.232, 1.214)
    # mechatronic unit: ribbed cover with bolts and a connector
    g += extrude(rounded_rect(0.220, 0.160, 0.015, 3), 0.070, PLASTIC, z0=0.0).transform(R("x", -90)).moved(0.400, 0.535, 1.520)
    for k in range(5):
        g += box(0.200, 0.008, 0.006, PLASTIC, center=(0.400, 0.609, 1.460 + k * 0.030))
    if not lite:
        for dx in (-0.100, 0.100):
            for dz in (-0.070, 0.070):
                g += _bolt_y(0.400 + dx, 0.607, 1.520 + dz, af=0.010, h=0.006)
    g += box(0.040, 0.030, 0.026, PLASTIC, center=(0.525, 0.575, 1.575))
    g += box(0.018, 0.012, 0.030, PLASTIC, center=(0.525, 0.594, 1.575))
    # speed sensor and breather
    g += cylinder(0.009, 0.030, 12, PLASTIC, axis="z", center=False).moved(0.500, 0.380, 1.590)
    g += box(0.018, 0.014, 0.016, PLASTIC, center=(0.500, 0.380, 1.628))
    g += cylinder(0.006, 0.040, 8, DARK, axis="y").moved(0.300, 0.625, 1.300)
    g += cylinder(0.010, 0.012, 12, PLASTIC, axis="y").moved(0.300, 0.648, 1.300)
    return g


def driveshaft(x_in: float, x_out: float, lite: bool, damper: bool = False) -> Geo:
    """Shaft along +x from the inner joint (x_in) to the outer CV (x_out) at the axle height."""
    g = Geo()
    seg = 20 if lite else 28
    L = x_out - x_in
    y, z = VH.CRANK_Y - 0.100, VH.Z_FRONT_AXLE
    g += lathe([(0.0, 0.0), (0.042, 0.0), (0.046, 0.012), (0.046, 0.050), (0.030, 0.062), (0.0, 0.064)], seg, DARK, axis="x", hard=False)
    b1 = bellows(0.016, 0.034, 0.080, 5, RUBBER, seg=seg)
    g += b1.transform(R("z", -90)).moved(0.062, 0, 0)
    g += cylinder(0.0135, L - 0.26, 14, STEEL, axis="x", center=False).moved(0.140, 0, 0)
    if damper:
        g += lathe([(0.0135, -0.030), (0.030, -0.030), (0.030, 0.030), (0.0135, 0.030)], 18, DARK, axis="x", hard=False).moved(L * 0.45, 0, 0)
    b2 = bellows(0.017, 0.038, 0.085, 5, RUBBER, seg=seg)
    g += b2.transform(R("z", 90)).moved(L - 0.068, 0, 0)
    g += lathe([(0.0, 0.0), (0.030, 0.0), (0.047, 0.020), (0.048, 0.045), (0.036, 0.068), (0.0, 0.070)], seg, DARK, axis="x", hard=False).moved(L - 0.070, 0, 0)
    return g.moved(x_in, VH.WHEEL_Y + 0.014, z)


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "kvacilo-zamajac", "main", clutch(lite), bevel=0.0)
    add_centered(ctx, "menjac", "main", gearbox(lite), bevel=0.003, segments=2, profile=0.6)
    add_centered(ctx, "poluosovine", "l", driveshaft(0.450, 0.715, lite), bevel=0.0)
    # right shaft: built along +x from 0 to 0.805, mirrored to -x, inner joint at x +0.09
    add_centered(ctx, "poluosovine", "r", driveshaft(0.0, 0.805, lite, damper=True).transform(S(-1, 1, 1)).moved(0.090, 0, 0), bevel=0.0)
