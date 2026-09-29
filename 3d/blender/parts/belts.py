"""Zupčasti kaiš + vodena pumpa (timing drive, x = TIMING_X, upright engine frame) and
kaiš alternatora (poly-V drive with crank damper and automatic tensioner, x = ACC_X)."""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, belt_path, box, circle2d, cylinder, extrude, lathe
from lib.parts import add_centered
from lib.shapes import belt_mesh, hex_nut
from parts.brakes import lathe_closed
from parts.engine import CAM_Y, CAM_Z, ENGINE_M, gear_r, sprocket

RUBBER = "mat_rubber"
DARK = "mat_steel_dark"
ALU = "mat_cast_alu"
STEEL = "mat_machined_steel"

# timing drive circles in the upright frame (u = z, v = y), CCW around the loop
PUMP = (-0.078, 0.150)
TENS = (0.072, 0.175)


def timing_circles():
    return [
        (0.0, 0.0, gear_r(18)),
        (TENS[0], TENS[1], 0.030),
        (CAM_Z, CAM_Y, gear_r(36)),
        (-CAM_Z, CAM_Y, gear_r(36)),
        (PUMP[0], PUMP[1], gear_r(19)),
    ]


def timing_belt(lite: bool) -> Geo:
    g = Geo()
    path = belt_path(timing_circles(), samples_per_rad=14)
    x = VH.TIMING_X

    def to3d(u, v, w):
        return (x + w, v, u)

    g += belt_mesh(path, to3d, 0.024, 0.0035, RUBBER, tooth_h=0.0 if lite else 0.0022, pitch=0.009525)
    # tensioner roller + eccentric backplate, idler hint
    tr = lathe([(0.008, -0.013), (0.030, -0.013), (0.030, 0.013), (0.008, 0.013), (0.008, -0.013)], 28, STEEL, axis="x", hard=False)
    g += tr.moved(x, TENS[1], TENS[0])
    plate = extrude([(-0.030, -0.020), (0.045, -0.018), (0.052, 0.0), (0.045, 0.018), (-0.030, 0.020)], 0.006, DARK)
    plate.transform(R("y", 90))
    g += plate.moved(x + 0.018, TENS[1] - 0.02, TENS[0] - 0.01)
    g += cylinder(0.009, 0.020, 12, DARK, axis="x").moved(x + 0.010, TENS[1], TENS[0])
    # eccentric adjuster with pointer + centre bolt on the outboard face of the roller
    g += cylinder(0.012, 0.004, 20, DARK, axis="x", center=False).moved(x - 0.017, TENS[1] + 0.003, TENS[0])
    g += box(0.003, 0.012, 0.004, DARK, center=(x - 0.0155, TENS[1] + 0.017, TENS[0]))
    g += hex_nut(0.013, 0.007, DARK).transform(R("z", -90)).moved(x - 0.0205, TENS[1] + 0.003, TENS[0])
    return g.transform(ENGINE_M)


def water_pump(lite: bool) -> Geo:
    g = Geo()
    x = VH.TIMING_X
    g += sprocket(19, 0.022, DARK, hub_r=0.016).moved(x - 0.011, PUMP[1], PUMP[0])
    # pump body behind the sprocket (toward the block end face) + flange lugs + impeller hub
    g += lathe([(0.0, 0.0), (0.040, 0.0), (0.044, 0.006), (0.044, 0.030), (0.036, 0.036), (0.0, 0.036)], 28, ALU, axis="x", hard=False).moved(x + 0.012, PUMP[1], PUMP[0])
    fl = extrude([(-0.052, -0.030), (0.050, -0.034), (0.058, 0.0), (0.050, 0.034), (-0.052, 0.030), (-0.060, 0.0)], 0.008, ALU)
    fl.transform(R("y", 90))
    g += fl.moved(x + 0.040, PUMP[1], PUMP[0])
    g += cylinder(0.012, 0.016, 16, STEEL, axis="x").moved(x - 0.020, PUMP[1], PUMP[0])
    g += cylinder(0.014, 0.060, 16, ALU, axis="y").moved(x + 0.028, PUMP[1] - 0.050, PUMP[0] - 0.010)
    return g.transform(ENGINE_M)


# accessory drive in vehicle coordinates (u = z, v = y), CCW
CRANK = (VH.CRANK_Z, VH.CRANK_Y, 0.075)
AC_P = (1.720, 0.290, 0.055)
ALT_P = (1.725, 0.485, 0.028)
TENS_A = (1.570, 0.605, 0.034)


def accessory_belt(lite: bool) -> Geo:
    g = Geo()
    x = VH.ACC_X
    circles = [CRANK, AC_P, ALT_P, TENS_A]
    path = belt_path([(c[0], c[1], c[2] + 0.0015) for c in circles], samples_per_rad=12)

    def to3d(u, v, w):
        return (x + w, v, u)

    g += belt_mesh(path, to3d, 0.021, 0.0045, RUBBER)
    # crank vibration damper (outboard face at -x): raised hub with four bolts and the centre
    # bolt, dished web, rubber isolation ring, inertia ring with 6 poly-V grooves
    seg = 48 if not lite else 32
    cx, cy, cz = x, CRANK[1], CRANK[0]
    prof = [(0.0, -0.022), (0.028, -0.022), (0.030, -0.020), (0.030, -0.011), (0.032, -0.009), (0.050, -0.008), (0.0515, -0.010),
            (0.0515, -0.004), (0.0585, -0.004), (0.0585, -0.014), (0.0605, -0.016), (0.0725, -0.016), (0.0745, -0.013)]
    for k in range(6):
        y0 = -0.012 + k * 0.0042
        prof += [(0.0745, y0), (0.0715, y0 + 0.0021)]
    prof += [(0.0745, 0.0135), (0.0745, 0.016), (0.030, 0.018), (0.0, 0.018)]
    g += lathe(prof, seg, ALU, axis="x", hard=False).moved(cx, cy, cz)
    g += lathe_closed([(0.0522, -0.004), (0.0522, -0.012), (0.0578, -0.012), (0.0578, -0.004)], seg, RUBBER, axis="x").moved(cx, cy, cz)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        g += hex_nut(0.010, 0.0055, ALU).transform(R("z", -90)).moved(cx - 0.02475, cy + 0.022 * math.sin(a), cz + 0.022 * math.cos(a))
    g += cylinder(0.014, 0.002, 28, ALU, axis="x", center=False).moved(cx - 0.024, cy, cz)
    g += hex_nut(0.019, 0.008, ALU).transform(R("z", -90)).moved(cx - 0.028, cy, cz)
    # automatic tensioner: pulley (recessed web, dust cap, bolt) on an arm to the spring housing
    r = TENS_A[2]
    tp = lathe_closed([(0.009, -0.009), (0.024, -0.009), (0.026, -0.012), (r, -0.012), (r, 0.012), (0.009, 0.012)], 32, ALU, axis="x")
    g += tp.moved(x, TENS_A[1], TENS_A[0])
    g += cylinder(0.013, 0.004, 20, ALU, axis="x", center=False).moved(x - 0.013, TENS_A[1], TENS_A[0])
    g += hex_nut(0.013, 0.006, ALU).transform(R("z", -90)).moved(x - 0.016, TENS_A[1], TENS_A[0])
    g += cylinder(0.009, 0.014, 16, ALU, axis="x", center=False).moved(x + 0.010, TENS_A[1], TENS_A[0])
    sp = (x + 0.025, TENS_A[1] - 0.040, TENS_A[0] + 0.050)
    arm = extrude([(-0.010, -0.014), (0.064, -0.013), (0.070, 0.0), (0.064, 0.013), (-0.010, 0.014)], 0.010, ALU)
    arm.transform(R("y", 90))
    arm.transform(R("x", math.degrees(math.atan2(sp[1] - TENS_A[1], -(sp[2] - TENS_A[0])))))
    g += arm.moved(x + 0.020, TENS_A[1], TENS_A[0])
    g += lathe([(0.0, 0.002), (0.017, 0.002), (0.019, 0.0), (0.028, 0.0), (0.030, 0.002), (0.030, 0.035), (0.0, 0.036)], 28, ALU, axis="x", hard=False).moved(*sp)
    g += hex_nut(0.016, 0.007, ALU).transform(R("z", -90)).moved(sp[0] - 0.0015, sp[1], sp[2])
    g += box(0.003, 0.004, 0.012, ALU, center=(sp[0] - 0.0015, sp[1], sp[2] + 0.022))
    return g


def build(ctx) -> None:
    add_centered(ctx, "zupcasti-kais-vodena-pumpa", "belt", timing_belt(ctx.lite), bevel=0.0)
    add_centered(ctx, "zupcasti-kais-vodena-pumpa", "water-pump", water_pump(ctx.lite), bevel=0.001)
    add_centered(ctx, "kais-alternatora", "belt", accessory_belt(ctx.lite), bevel=0.0)
