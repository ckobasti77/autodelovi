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
    g += cylinder(0.004, 0.022, 10, STEEL, axis="x").moved(0.207, 0.025, 0.020)
    from lib.shapes import hex_nut

    g += hex_nut(0.010, 0.006, STEEL).transform(R("z", -90)).moved(0.214, 0.025, 0.020)
    g += lathe([(0.0, 0.0), (0.011, 0.0), (0.012, 0.010), (0.008, 0.016), (0.0, 0.017)], 14, "mat_rubber", axis="x", hard=False).moved(0.198, 0.025, 0.020)
    # regulator connector: plug housing with a latch, cable leaving upward
    g += box(0.020, 0.024, 0.030, PLASTIC, center=(0.206, -0.018, -0.024))
    g += box(0.008, 0.006, 0.020, PLASTIC, center=(0.218, -0.018, -0.024))
    g += box(0.018, 0.020, 0.012, PLASTIC, center=(0.206, -0.018, -0.044))
    plug = catmull([(0.206, -0.018, -0.050), (0.215, -0.030, -0.070), (0.235, -0.030, -0.090)], 5)
    g += tube(plug, 0.004, 8, PLASTIC)
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


def _hull(pts: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Convex hull (monotone chain), counter-clockwise."""
    pts = sorted(set(pts))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    upper: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def starter(lite: bool) -> Geo:
    from lib.shapes import hex_nut

    g = Geo()
    seg = 24 if lite else 36
    # motor yoke (painted): lip over the drive housing, two rolled grooves
    g += lathe(
        [(0.0, 0.042), (0.034, 0.042), (0.0385, 0.044), (0.0385, 0.050), (0.037, 0.052), (0.037, 0.058), (0.0355, 0.060), (0.037, 0.062),
         (0.037, 0.132), (0.0355, 0.134), (0.037, 0.136), (0.037, 0.146), (0.0, 0.146)],
        seg, BLACK, axis="x", hard=False,
    )
    # commutator end cap (die-cast) with the rear bearing boss
    g += lathe(
        [(0.0, 0.146), (0.0378, 0.146), (0.0378, 0.152), (0.036, 0.155), (0.031, 0.164), (0.024, 0.168), (0.015, 0.169), (0.014, 0.171),
         (0.014, 0.178), (0.012, 0.180), (0.0, 0.180)],
        seg, ALU, axis="x", hard=False,
    )
    # two through-bolts along the yoke (front side; the gearbox sits behind), ears on the end cap
    for a in (25.0, -35.0):
        t = math.radians(a)
        y, z = 0.041 * math.sin(t), 0.041 * math.cos(t)
        g += cylinder(0.0065, 0.010, 12, ALU, axis="x").moved(0.151, y, z)
        g += cylinder(0.0026, 0.108, 8, STEEL, axis="x", center=False).moved(0.046, y, z)
        g += hex_nut(0.008, 0.005, STEEL).transform(R("z", -90)).moved(0.1585, y, z)
    # drive-end housing: nose, locating spigot, two-ear flange with studs and nuts
    g += lathe([(0.0, 0.000), (0.022, 0.000), (0.026, 0.003), (0.030, 0.012), (0.0385, 0.014), (0.0385, 0.030), (0.0, 0.030)], seg, ALU, axis="x", hard=False)
    ears = [(-0.034, 0.044), (0.030, -0.048)]  # outline (x, y) -> vehicle (z = -x, y)
    pts = circle2d(0.045, 32)
    for cx, cy in ears:
        pts += circle2d(0.013, 14, cx, cy)
    fl = extrude(_hull([(round(px, 6), round(py, 6)) for px, py in pts]), 0.010, ALU, holes=[circle2d(0.0055, 12, cx, cy) for cx, cy in ears])
    fl.transform(R("y", 90))
    g += fl.moved(0.030, 0.0, 0.0)
    for cx, cy in ears:
        g += cylinder(0.004, 0.014, 10, STEEL, axis="x", center=False).moved(0.036, cy, -cx)
        g += cylinder(0.0085, 0.0015, 14, STEEL, axis="x", center=False).moved(0.040, cy, -cx)
        g += hex_nut(0.012, 0.0065, STEEL).transform(R("z", -90)).moved(0.0448, cy, -cx)
    # solenoid: collar and web on the drive housing, zinc-plated body, moulded end cap
    SY = 0.052
    g += lathe([(0.0, 0.034), (0.024, 0.034), (0.027, 0.037), (0.027, 0.066), (0.0, 0.066)], seg, ALU, axis="x", hard=False).moved(0, SY, 0)
    g += box(0.032, 0.020, 0.024, ALU, center=(0.050, 0.040, 0.0))
    g += lathe([(0.0, 0.066), (0.0245, 0.066), (0.025, 0.068), (0.025, 0.146), (0.0262, 0.148), (0.0262, 0.154), (0.0, 0.154)], seg, STEEL, axis="x", hard=False, uv_v=30.0).moved(0, SY, 0)
    g += lathe([(0.0, 0.154), (0.0238, 0.154), (0.0238, 0.166), (0.0215, 0.170), (0.0, 0.171)], seg, BLACK, axis="x", hard=False).moved(0, SY, 0)
    # terminals 30 (battery) and M (motor): insulator boss, stud, washer, nut; terminal 50 plug
    for dz, af, top in ((0.011, 0.012, 0.190), (-0.011, 0.010, 0.186)):
        y = SY + 0.004
        g += cylinder(0.0075, 0.004, 14, BLACK, axis="x", center=False).moved(0.169, y, dz)
        g += cylinder(0.0038, top - 0.173, 10, STEEL, axis="x", center=False).moved(0.173, y, dz)
        g += cylinder(0.0078, 0.0012, 14, STEEL, axis="x", center=False).moved(0.1732, y, dz)
        g += hex_nut(af, 0.006, STEEL).transform(R("z", -90)).moved(0.1774, y, dz)
    g += box(0.012, 0.007, 0.010, BLACK, center=(0.176, SY - 0.012, 0.0))
    # motor strap from terminal M into the yoke through a grommet
    strap = catmull([(0.183, 0.056, 0.011), (0.189, 0.052, 0.019), (0.188, 0.043, 0.027), (0.172, 0.037, 0.029), (0.150, 0.036, 0.026), (0.138, 0.034, 0.024)], 5)
    g += tube(strap, 0.0028, 8, STEEL)
    g += cylinder(0.005, 0.007, 10, BLACK, axis="y").moved(0.138, 0.033, 0.0235)
    # pinion (Bendix) and shaft end at the nose
    pin = extrude(gear2d(10, 0.0125, 0.0165, 0.45, 0.30), 0.020, STEEL)
    pin.transform(R("y", -90))
    g += pin.moved(0.000, 0, 0)
    g += cylinder(0.0065, 0.008, 12, STEEL, axis="x").moved(-0.022, 0, 0)
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
    handle = tube([(-0.050, h + 0.002, -0.050), (-0.045, h + 0.020, -0.050), (0.045, h + 0.020, -0.050), (0.050, h + 0.002, -0.050)], 0.004, 8, GREY, hard=False)
    g += handle
    for k in range(6):
        g += lathe([(0.0, h), (0.009, h), (0.009, h + 0.004), (0.0, h + 0.004)], 12, GREY, hard=False).moved(-0.075 + k * 0.030, 0, 0.012)
    for sz in (-1, 1):
        g += box(w - 0.030, 0.012, 0.010, BATTERY, center=(0.0, 0.006, sz * (d / 2 + 0.004)))
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
