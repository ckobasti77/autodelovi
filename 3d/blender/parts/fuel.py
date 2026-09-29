"""Brizgaljke i pumpa goriva: 4 direct injectors + rail under the plenum, HP pump on the head end."""

from __future__ import annotations

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, box, catmull, cylinder, lathe, tube
from lib.parts import add_centered
from lib.shapes import along
from parts.engine import ENGINE_M

DARK = "mat_steel_dark"
PLASTIC = "mat_plastic_black"
ALU = "mat_cast_alu"
STEEL = "mat_machined_steel"


def injectors(lite: bool) -> Geo:
    g = Geo()
    for x in VH.CYL_X:
        inj = Geo()
        inj += lathe([(0.0, 0.0), (0.0040, 0.0), (0.0055, 0.010), (0.0075, 0.012), (0.0075, 0.050), (0.0095, 0.054), (0.0095, 0.068), (0.0060, 0.074), (0.0, 0.075)], 14, DARK, hard=False)
        inj += box(0.014, 0.020, 0.022, PLASTIC, center=(0.0, 0.060, 0.012))
        # injectors sit in the head's intake side, tilted 35 deg down-inward
        inj.transform(R("x", 55))
        g += inj.moved(x, 0.315, 0.118)
    # fuel rail along x with cups and a pressure sensor
    rail = [(VH.CYL_X[-1] - 0.040, 0.352, 0.150), (VH.CYL_X[0] + 0.040, 0.352, 0.150)]
    g += tube([Vector(rail[0]).lerp(Vector(rail[1]), t / 8) for t in range(9)], 0.011, 12, DARK, hard=False)
    for x in VH.CYL_X:
        g += cylinder(0.012, 0.022, 12, DARK).moved(x, 0.340, 0.142)
    g += lathe([(0.0, 0.0), (0.009, 0.0), (0.009, 0.020), (0.012, 0.024), (0.012, 0.040), (0.0, 0.041)], 12, PLASTIC, hard=False).transform(R("z", -90)).moved(VH.CYL_X[0] + 0.040, 0.352, 0.150)
    return g.transform(ENGINE_M)


def hp_pump(lite: bool) -> Geo:
    g = Geo()
    g += lathe([(0.0, 0.0), (0.032, 0.0), (0.032, 0.012), (0.028, 0.016), (0.028, 0.070), (0.024, 0.080), (0.0, 0.082)], 24, ALU, hard=False)
    g += box(0.080, 0.010, 0.050, ALU, center=(0.0, 0.004, 0.0))
    g += cylinder(0.009, 0.030, 10, STEEL, axis="z").moved(0.0, 0.050, 0.030)
    line = catmull([(0.0, 0.060, 0.045), (-0.02, 0.066, 0.090), (-0.08, 0.030, 0.180), (-0.20, -0.010, 0.260)], 6)
    g += tube(line, 0.004, 8, STEEL, hard=False)
    return g.moved(0.10, 0.87, 1.30)


def build(ctx) -> None:
    add_centered(ctx, "brizgaljke-pumpa-goriva", "injectors", injectors(ctx.lite), bevel=0.0)
    add_centered(ctx, "brizgaljke-pumpa-goriva", "pump", hp_pump(ctx.lite), bevel=0.0012)
