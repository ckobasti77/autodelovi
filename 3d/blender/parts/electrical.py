"""Elektrika: alternator, starter, battery, sensors (coolant temperature, lambda, front PDC)."""

from __future__ import annotations

import math

from mathutils import Vector

from lib.geo import Geo, R, box, catmull, circle2d, cylinder, extrude, gear2d, lathe, radial, rounded_rect, tube
from lib.parts import add_centered
from parts.belts import ALT_P

ALU = "mat_cast_alu"
COPPER = "mat_copper"
DARK = "mat_steel_dark"
BLACK = "mat_painted_black"
STEEL = "mat_machined_steel"
PLASTIC = "mat_plastic_black"
GREY = "mat_plastic_grey"
BATTERY = "mat_battery"


def alternator(lite: bool) -> Geo:
    g = Geo()
    seg = 28 if lite else 40
    # front housing with real vent slots (segmented spin), stator band, rear housing
    for x0, x1 in ((0.000, 0.070), (0.092, 0.170)):
        ring = [(0.058, x0), (0.068, x0 + 0.006), (0.070, x0 + 0.014), (0.070, x1 - 0.010), (0.066, x1), (0.058, x1)]
        for k in range(12):
            a0 = 30.0 * k
            g += lathe(ring, 3, ALU, axis="x", hard=False, angle=21.0, phase=a0)
        g += lathe([(0.0, x0 + 0.004), (0.058, x0 + 0.004), (0.058, x0 + 0.010), (0.0, x0 + 0.010)], seg, ALU, axis="x", hard=False)
    g += lathe([(0.066, 0.068), (0.073, 0.068), (0.073, 0.094), (0.066, 0.094), (0.066, 0.068)], seg, COPPER, axis="x", hard=False)
    for x in (0.030, 0.130):
        g += lathe([(0.0, x - 0.020), (0.052, x - 0.020), (0.052, x + 0.020), (0.0, x + 0.020)], seg // 2, DARK, axis="x", hard=False)
    # rear cover + B+ terminal
    g += lathe([(0.0, 0.170), (0.058, 0.170), (0.056, 0.188), (0.040, 0.198), (0.0, 0.200)], seg, ALU, axis="x", hard=False)
    g += cylinder(0.006, 0.020, 10, COPPER, axis="x").moved(0.206, 0.025, 0.020)
    # through-bolts
    for k in range(4):
        a = math.radians(45 + 90 * k)
        g += cylinder(0.004, 0.176, 8, DARK, axis="x", center=False).moved(0.0, 0.064 * math.cos(a), 0.064 * math.sin(a))
    # mounting ears (bottom, toward the block)
    for x in (0.020, 0.150):
        g += box(0.022, 0.050, 0.030, ALU, center=(x, -0.070, -0.020))
    # fan behind the pulley + OAP pulley with 6 grooves
    fan = box(0.008, 0.050, 0.004, DARK, center=(-0.008, 0.035, 0.0), hard=False)
    g += radial(fan.transform(R("y", 25)), 10, "x")
    prof = [(0.0, -0.036), (0.020, -0.036)]
    for k in range(6):
        y0 = -0.034 + k * 0.0042
        prof += [(0.0285, y0), (0.0255, y0 + 0.0021)]
    prof += [(0.0285, -0.009), (0.020, -0.006), (0.0, -0.006)]
    g += lathe(prof, seg, DARK, axis="x", hard=False)
    # place: body from x -0.44 to -0.24 at the alternator axis
    return g.moved(-0.440, ALT_P[1], ALT_P[0])


def starter(lite: bool) -> Geo:
    g = Geo()
    seg = 24 if lite else 32
    g += lathe([(0.0, 0.040), (0.036, 0.040), (0.037, 0.050), (0.037, 0.170), (0.033, 0.178), (0.0, 0.180)], seg, BLACK, axis="x", hard=False)
    g += lathe([(0.0, 0.070), (0.024, 0.070), (0.025, 0.080), (0.025, 0.170), (0.020, 0.176), (0.0, 0.178)], seg, BLACK, axis="x", hard=False).moved(0, 0.052, 0.0)
    for dz in (-0.010, 0.012):
        g += cylinder(0.005, 0.016, 10, "mat_copper" if False else STEEL, axis="x").moved(0.184, 0.058, dz)
    # nose housing + mounting flange (bolted to the bellhousing)
    g += lathe([(0.0, 0.000), (0.030, 0.000), (0.038, 0.020), (0.040, 0.040), (0.0, 0.040)], seg, ALU, axis="x", hard=False)
    fl = extrude([(-0.045, -0.030), (0.050, -0.030), (0.058, 0.0), (0.050, 0.030), (-0.045, 0.030)], 0.010, ALU, holes=[circle2d(0.006, 10, 0.040, 0.0), circle2d(0.006, 10, -0.035, 0.0)])
    fl.transform(R("y", 90))
    g += fl.moved(0.030, 0.0, 0.0)
    # pinion (Bendix) at the nose
    pin = extrude(gear2d(10, 0.0125, 0.0165, 0.45, 0.30), 0.020, STEEL)
    pin.transform(R("y", -90))
    g += pin.moved(0.000, 0, 0)
    # axis parallel to the crank; nose/pinion toward the flywheel ring gear
    return g.moved(0.12, 0.30, 1.66)


def battery(lite: bool) -> Geo:
    g = Geo()
    w, h, d = 0.278, 0.190, 0.175
    case = extrude(rounded_rect(w, d, 0.012, 3), h - 0.012, BATTERY, z0=0.0)
    case.transform(R("x", -90))
    g += case
    lid = extrude(rounded_rect(w + 0.004, d + 0.004, 0.014, 3), 0.012, BATTERY, z0=h - 0.012)
    lid.transform(R("x", -90))
    g += lid
    g += box(0.170, 0.004, 0.030, GREY, center=(0.0, h + 0.001, 0.045))  # vent/label strip
    g += box(0.080, 0.010, 0.030, BATTERY, center=(0.0, h - 0.004, -0.050))  # handle recess rim
    for sx in (-0.105, 0.105):
        g += lathe([(0.0, h), (0.010, h), (0.009, h + 0.018), (0.0, h + 0.019)], 14, GREY, hard=False).moved(sx, 0, 0.055)
        g += box(0.040, 0.018, 0.030, GREY, center=(sx, h + 0.012, 0.055))
    return g.moved(0.58, 0.500, 1.745)


def coolant_sensor(lite: bool) -> Geo:
    g = Geo()
    g += lathe([(0.0, 0.0), (0.0075, 0.0), (0.0075, 0.010), (0.0100, 0.012), (0.0100, 0.020), (0.0, 0.021)], 6, GREY, hard=True)
    g += lathe([(0.0, 0.021), (0.0090, 0.021), (0.0090, 0.040), (0.0060, 0.044), (0.0, 0.045)], 14, GREY, hard=False)
    g += box(0.014, 0.014, 0.012, GREY, center=(0.0, 0.040, 0.010))
    g.transform(R("x", 90))
    return g.moved(0.11, 0.71, 1.505)


def lambda_sensor(lite: bool) -> Geo:
    g = Geo()
    g += lathe([(0.0, -0.020), (0.0045, -0.020), (0.0045, -0.002), (0.0070, -0.002), (0.0, -0.001)], 12, STEEL, hard=False)
    g += lathe([(0.0, 0.0), (0.0110, 0.0), (0.0110, 0.012)], 6, STEEL, hard=True)
    g += lathe([(0.0, 0.012), (0.0080, 0.012), (0.0070, 0.050), (0.0045, 0.058), (0.0, 0.059)], 14, STEEL, hard=False)
    cable = catmull([(0.0, 0.058, 0.0), (0.0, 0.090, 0.010), (0.03, 0.130, 0.030), (0.08, 0.160, 0.050)], 6)
    g += tube(cable, 0.0028, 6, PLASTIC, hard=False)
    g += box(0.020, 0.016, 0.030, PLASTIC, center=(0.085, 0.165, 0.060))
    g.transform(R("x", -25))
    return g.moved(-0.02, 0.56, 1.075)


def pdc(lite: bool) -> Geo:
    from parts.body import front_face_z

    g = Geo()
    for x in (-0.52, -0.18, 0.18, 0.52):
        s = Geo()
        s += lathe([(0.0, 0.0), (0.0090, 0.0), (0.0092, 0.004), (0.0092, 0.024), (0.0, 0.025)], 16, PLASTIC, hard=False)
        s += box(0.024, 0.018, 0.016, PLASTIC, center=(0.0, 0.030, 0.0))
        s.transform(R("x", -90))  # axis pointing forward (+z)
        y = 0.520
        g += s.moved(x, y, front_face_z(x, y, lite) + 0.0015)
    return g


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "alternator", "main", alternator(lite), bevel=0.0)
    add_centered(ctx, "anlaser", "main", starter(lite), bevel=0.0008)
    add_centered(ctx, "akumulator", "main", battery(lite), bevel=0.002, segments=2)
    add_centered(ctx, "senzori", "coolant-temp", coolant_sensor(lite), bevel=0.0)
    add_centered(ctx, "senzori", "lambda", lambda_sensor(lite), bevel=0.0)
    add_centered(ctx, "senzori", "park-front", pdc(lite), bevel=0.0)
