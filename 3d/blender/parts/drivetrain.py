"""Transmisija: dual-mass flywheel + clutch kit, DSG gearbox, driveshafts with CV joints."""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, S, T, box, circle2d, cylinder, extrude, gear2d, lathe, radial, rounded_rect
from lib.parts import add_centered
from lib.shapes import bellows

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
    # pressure plate cover + diaphragm fingers
    g += lathe([(0.030, 0.050), (0.126, 0.050), (0.130, 0.056), (0.126, 0.078), (0.100, 0.090), (0.070, 0.094), (0.030, 0.094), (0.030, 0.050)], seg, DARK, axis="x", hard=False)
    finger = extrude([(0.018, -0.006), (0.066, -0.010), (0.066, 0.010), (0.018, 0.006)], 0.003, STEEL)
    finger.transform(R("y", 90))
    g += radial(finger.moved(0.094, 0, 0), 12 if lite else 18, "x")
    return g.moved(0.070, CY, CZ)


def gearbox(lite: bool) -> Geo:
    g = Geo()
    seg = 36 if lite else 56
    # bellhousing concentric with the crank axis
    g += lathe([(0.0, 0.0), (0.206, 0.0), (0.212, 0.012), (0.198, 0.060), (0.172, 0.110), (0.150, 0.140), (0.0, 0.142)], seg, ALU, axis="x", hard=False).moved(0.060, CY, CZ)
    # main case: lofted superellipse sections (casting look), tapering toward the end cover
    from lib.geo import loft, superellipse2d

    secs = []
    for x, a, b, cy, cz, ex in ((0.195, 0.205, 0.180, 0.425, 1.425, 3.4), (0.300, 0.212, 0.186, 0.420, 1.420, 3.2),
                                (0.430, 0.205, 0.182, 0.415, 1.405, 3.0), (0.530, 0.170, 0.155, 0.410, 1.395, 2.8),
                                (0.575, 0.120, 0.112, 0.410, 1.390, 2.4), (0.592, 0.060, 0.060, 0.410, 1.390, 2.0)):
        pts = superellipse2d(a, b, ex, 44 if not lite else 32)
        secs.append([(x, cy + py, cz + pz) for pz, py in pts])
    g += loft(secs, ALU, closed=True, caps=True, hard=False)
    # ribs, diff bulge with output flanges, mechatronic unit, breather
    g += lathe([(0.0, 0.220), (0.092, 0.220), (0.098, 0.240), (0.098, 0.420), (0.090, 0.440), (0.0, 0.440)], seg, ALU, axis="x", hard=False).moved(0.0, 0.330, 1.310)
    for x, sgn in ((0.440, 1), (0.090, -1)):
        fl = lathe([(0.0, 0.0), (0.040, 0.0), (0.045, 0.008), (0.045, 0.018), (0.0, 0.020)], 24, DARK, axis="x" if sgn > 0 else "-x", hard=False)
        g += fl.moved(x, 0.330, 1.310)
    g += extrude(rounded_rect(0.220, 0.160, 0.015, 3), 0.090, PLASTIC, z0=0.0).transform(R("x", -90)).moved(0.400, 0.520, 1.520)
    g += box(0.030, 0.030, 0.040, PLASTIC, center=(0.520, 0.625, 1.560))
    g += cylinder(0.006, 0.040, 8, DARK, axis="y").moved(0.300, 0.625, 1.300)
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
