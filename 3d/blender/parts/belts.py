"""Zupčasti kaiš + vodena pumpa (timing drive, x = TIMING_X, upright engine frame) and
kaiš alternatora (poly-V drive with crank damper and automatic tensioner, x = ACC_X)."""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, belt_path, box, circle2d, cylinder, extrude, lathe
from lib.parts import add_centered
from lib.shapes import belt_mesh
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
    # crank vibration damper with 6 grooves + rubber ring
    prof = [(0.0, -0.016), (0.055, -0.016), (0.056, -0.013)]
    for k in range(6):
        y0 = -0.012 + k * 0.0042
        prof += [(0.0745, y0), (0.0715, y0 + 0.0021)]
    prof += [(0.0745, 0.0135), (0.0745, 0.016), (0.030, 0.018), (0.0, 0.018)]
    g += lathe(prof, 48 if not lite else 32, ALU, axis="x", hard=False).moved(x, CRANK[1], CRANK[0])
    g += lathe([(0.045, 0.0), (0.056, 0.0), (0.056, 0.006), (0.045, 0.006), (0.045, 0.0)], 32, RUBBER, axis="x", hard=False).moved(x + 0.018, CRANK[1], CRANK[0])
    # automatic tensioner: arm casting + pulley + spring housing
    tp = lathe([(0.010, -0.012), (TENS_A[2], -0.012), (TENS_A[2], 0.012), (0.010, 0.012), (0.010, -0.012)], 28, ALU, axis="x", hard=False)
    g += tp.moved(x, TENS_A[1], TENS_A[0])
    arm = extrude([(-0.010, -0.014), (0.080, -0.012), (0.085, 0.0), (0.080, 0.012), (-0.010, 0.014)], 0.010, ALU)
    arm.transform(R("y", 90))
    arm.transform(R("x", 40))
    g += arm.moved(x + 0.020, TENS_A[1], TENS_A[0])
    g += lathe([(0.0, 0.0), (0.030, 0.0), (0.030, 0.035), (0.0, 0.036)], 24, ALU, axis="x", hard=False).moved(x + 0.025, TENS_A[1] - 0.040, TENS_A[0] + 0.050)
    return g


def build(ctx) -> None:
    add_centered(ctx, "zupcasti-kais-vodena-pumpa", "belt", timing_belt(ctx.lite), bevel=0.0)
    add_centered(ctx, "zupcasti-kais-vodena-pumpa", "water-pump", water_pump(ctx.lite), bevel=0.001)
    add_centered(ctx, "kais-alternatora", "belt", accessory_belt(ctx.lite), bevel=0.0)
