"""Usis: intake manifold (plenum, runners, throttle body), airbox, intercooler + charge pipes, EGR."""

from __future__ import annotations

import math

from mathutils import Vector

from lib.geo import Geo, R, box, catmull, circle2d, cylinder, extrude, lathe, polyline_fillet, rounded_rect, tube
from lib.parts import add_centered
from lib.shapes import bellows
from parts.engine import ENGINE_M, along_x

PLASTIC = "mat_plastic_black"
ALU = "mat_cast_alu"
RUBBER = "mat_rubber"
BRUSHED = "mat_brushed_alu"
HOSE = "mat_hose"
FINS = "mat_core_fins"
DARK = "mat_steel_dark"


def manifold(lite: bool) -> Geo:
    """Plastic intake manifold: rounded plenum with ribs, four oval runners into a bolted head
    flange, electronic throttle body with its actuator and connector, MAP sensor, flap actuator."""
    from lib.shapes import box_tube, hex_nut

    g = Geo()
    sec = [(0.205, 0.215), (0.300, 0.205), (0.322, 0.230), (0.325, 0.345), (0.300, 0.380), (0.230, 0.388), (0.205, 0.360)]
    g += along_x([(z, y) for z, y in sec], -0.335, 0.045, PLASTIC, hard=False)
    # moulded ribs across the plenum front and top
    for x in (-0.290, -0.200, -0.110, -0.020):
        g += box(0.006, 0.120, 0.008, PLASTIC, center=(x, 0.290, 0.327))
        g += box(0.006, 0.008, 0.080, PLASTIC, center=(x, 0.388, 0.265))
    # four oval runners (rounded-rectangle section) from the plenum to the head flange
    for x in (-0.302, -0.214, -0.126, -0.038):
        path = [Vector((x, 0.300, 0.215)), Vector((x, 0.340, 0.178)), Vector((x, 0.362, 0.150)), Vector((x, 0.366, 0.136))]
        g += box_tube(path, 0.040, 0.028, PLASTIC, r=0.010, fillet=0.03, up=(1, 0, 0))
    # head flange: one plate along the four ports with bolts above and below
    fl = extrude(rounded_rect(0.360, 0.056, 0.012, 3), 0.008, PLASTIC, z0=0.0)
    g += fl.moved(-0.170, 0.366, 0.130)
    if not lite:
        for x in (-0.346, -0.258, -0.170, -0.082, 0.006):
            for y in (0.341, 0.391):
                g += hex_nut(0.010, 0.006, "mat_machined_steel").transform(R("x", 90)).moved(x, y, 0.141)
    # electronic throttle body at the right end: bore, flange, motor housing, connector
    tb = lathe([(0.030, 0.0), (0.040, 0.0), (0.040, 0.050), (0.030, 0.050), (0.030, 0.0)], 24, ALU, axis="-x", hard=False)
    g += tb.moved(-0.335, 0.300, 0.265)
    g += box(0.040, 0.060, 0.060, ALU, center=(-0.360, 0.335, 0.300))
    g += lathe([(0.0, 0.0), (0.022, 0.0), (0.022, 0.040), (0.018, 0.046), (0.0, 0.047)], 20, ALU, axis="z", hard=False).moved(-0.360, 0.345, 0.330)
    g += box(0.020, 0.018, 0.026, PLASTIC, center=(-0.360, 0.372, 0.286))
    # MAP sensor with connector on the plenum top, flap actuator
    g += box(0.030, 0.018, 0.024, PLASTIC, center=(-0.250, 0.397, 0.260))
    g += box(0.014, 0.012, 0.016, PLASTIC, center=(-0.232, 0.402, 0.260))
    g += box(0.040, 0.030, 0.030, PLASTIC, center=(-0.10, 0.395, 0.290))
    return g.transform(ENGINE_M)


def egr(lite: bool) -> Geo:
    """EGR valve: round alu casting on the gas passage (axis z), two 3-bolt flanges with bolts,
    plastic actuator housing with ribs and a connector, two coolant nipples."""
    from lib.shapes import hex_nut

    g = Geo()
    seg = 20 if lite else 28
    g += lathe([(0.0, -0.034), (0.024, -0.034), (0.029, -0.026), (0.030, 0.0), (0.029, 0.026), (0.024, 0.034), (0.0, 0.034)], seg, ALU, axis="z", hard=False)
    lobes = []
    for k in range(60):
        phi = 2 * math.pi * k / 60
        r = 0.024 + 0.010 * max(0.0, math.cos(3 * (phi - math.pi / 2))) ** 3
        lobes.append((r * math.cos(phi), r * math.sin(phi)))
    for s in (1, -1):
        holes = [circle2d(0.015, 20)] + [circle2d(0.0040, 10, 0.028 * math.cos(math.pi / 2 + 2 * math.pi * j / 3), 0.028 * math.sin(math.pi / 2 + 2 * math.pi * j / 3)) for j in range(3)]
        fl = extrude(lobes, 0.008, ALU, holes=holes, z0=0.0 if s > 0 else -0.008)
        g += fl.moved(0, 0, s * 0.034)
        if not lite:
            for j in range(3):
                a = math.pi / 2 + 2 * math.pi * j / 3
                g += hex_nut(0.009, 0.005, "mat_machined_steel").transform(R("x", 90)).moved(0.028 * math.cos(a), 0.028 * math.sin(a), s * 0.044)
    # actuator housing (plastic) on top with ribs, connector and a small vent
    g += extrude(rounded_rect(0.060, 0.046, 0.010, 3), 0.034, PLASTIC, z0=0.0).transform(R("x", -90)).moved(0.0, 0.026, 0.0)
    for k in range(3):
        g += box(0.056, 0.004, 0.005, PLASTIC, center=(0.0, 0.062, -0.014 + k * 0.014))
    g += box(0.020, 0.018, 0.018, PLASTIC, center=(0.036, 0.046, 0.008))
    g += box(0.008, 0.010, 0.012, PLASTIC, center=(0.048, 0.046, 0.008))
    # coolant nipples on the casting
    for sx in (1, -1):
        g += lathe([(0.0, 0.0), (0.006, 0.0), (0.006, 0.018), (0.0075, 0.021), (0.006, 0.024), (0.0, 0.024)], 12, ALU, axis="x" if sx > 0 else "-x", hard=False).moved(sx * 0.026, -0.010, 0.0)
    return g.transform(ENGINE_M @ __import__("lib.geo", fromlist=["T"]).T(0.095, 0.330, 0.220))


def airbox(lite: bool) -> Geo:
    g = Geo()
    body = extrude(rounded_rect(0.300, 0.290, 0.040, 4), 0.150, PLASTIC, z0=-0.075, hard=True)
    body.transform(R("x", -90))
    g += body
    lid = extrude(rounded_rect(0.310, 0.300, 0.044, 4), 0.012, PLASTIC, z0=0.075, hard=True)
    lid.transform(R("x", -90))
    g += lid
    for x in (-0.12, 0.0, 0.12):
        g += box(0.024, 0.030, 0.010, PLASTIC, center=(x, 0.068, 0.152))
    # snorkel forward to the grille area
    snork = polyline_fillet([(-0.10, 0.030, 0.140), (-0.10, 0.015, 0.320), (-0.11, -0.050, 0.420)], 0.10, 8)
    g += tube(snork, 0.036, 14, PLASTIC, hard=False)
    # outlet bellows down to the turbo compressor inlet
    out_path = catmull([(-0.09, -0.060, -0.115), (-0.12, -0.110, -0.170), (-0.17, -0.165, -0.220), (-0.21, -0.200, -0.240)], 6)
    g += tube(out_path, 0.034, 14, RUBBER, hard=False)
    # MAF sensor housing (plastic ring) at the outlet with its connector, lid clips
    p0, p1 = out_path[0], out_path[1]
    dvec = (p1 - p0).normalized()
    g += tube([p0 - dvec * 0.010, p0 + dvec * 0.050], 0.040, 18, PLASTIC, hard=False)
    g += box(0.030, 0.026, 0.034, PLASTIC, center=tuple(p0 + dvec * 0.020 + Vector((0.0, 0.046, 0.0))))
    for x in (-0.150, 0.150):
        for z in (-0.060, 0.060):
            g += box(0.010, 0.036, 0.022, PLASTIC, center=(x + (0.004 if x > 0 else -0.004), 0.070, z))
    return g.moved(0.29, 0.84, 1.40)


def intercooler(lite: bool) -> Geo:
    g = Geo()
    core = extrude(rounded_rect(0.700, 0.180, 0.004, 1), 0.060, FINS, z0=-0.030, hard=True)
    # UVs for fins: planar on the big faces (box projection in to_mesh handles it)
    g += core
    for s in (1, -1):
        tank = extrude([(0.0, -0.095), (0.040, -0.080), (0.055, 0.0), (0.040, 0.080), (0.0, 0.095)], 0.070, ALU, z0=-0.035)
        if s < 0:
            tank.transform(__import__("lib.geo", fromlist=["S"]).S(-1, 1, 1))
        g += tank.moved(s * 0.350, 0.0, 0.0)
        nz = lathe([(0.022, 0.0), (0.028, 0.0), (0.028, 0.050), (0.031, 0.054), (0.028, 0.058), (0.022, 0.058), (0.022, 0.0)], 18, ALU, axis="-z", hard=False)
        g += nz.moved(s * 0.380, 0.0, -0.020)
    return g.moved(0.0, 0.270, 2.070)


def charge_pipes(lite: bool) -> Geo:
    g = Geo()
    sides = 12 if lite else 16
    hot = polyline_fillet([(0.030, 0.700, 1.120), (0.200, 0.705, 1.150), (0.340, 0.680, 1.300), (0.345, 0.675, 1.600), (0.408, 0.620, 1.720), (0.410, 0.420, 1.900), (0.392, 0.285, 1.990), (0.380, 0.270, 2.010)], 0.07, 8)
    g += tube(hot, 0.027, sides, BRUSHED, hard=False)
    cold = polyline_fillet([(-0.380, 0.270, 2.010), (-0.385, 0.550, 1.975), (-0.385, 0.720, 1.860), (-0.395, 0.770, 1.700)], 0.08, 8)
    g += tube(cold, 0.026, sides, BRUSHED, hard=False)
    # silicone couplers at the ends
    for path, i in ((hot, 0), (hot, -1), (cold, 0), (cold, -1)):
        p = path[i]
        q = path[1] if i == 0 else path[-2]
        d = (q - p).normalized()
        cp = tube([p - d * 0.005, p + d * 0.045], 0.031, sides, HOSE, hard=False)
        g += cp
    return g


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "usisna-grana", "manifold", manifold(lite), bevel=0.0)
    add_centered(ctx, "usisna-grana", "airbox", airbox(lite), bevel=0.003, segments=2)
    add_centered(ctx, "interkuler", "main", intercooler(lite), bevel=0.0015)
    add_centered(ctx, "interkuler", "pipes", charge_pipes(lite), bevel=0.0)
    add_centered(ctx, "egr-ventil", "main", egr(lite), bevel=0.0015)
