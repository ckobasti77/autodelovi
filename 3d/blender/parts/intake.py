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
    g = Geo()
    # plenum: rounded section extruded along x (upright frame)
    sec = [(0.205, 0.215), (0.300, 0.205), (0.322, 0.230), (0.325, 0.345), (0.300, 0.380), (0.230, 0.388), (0.205, 0.360)]
    g += along_x([(z, y) for z, y in sec], -0.335, 0.045, PLASTIC, hard=False)
    # four runners from the plenum to the head intake flange (swept, oval-ish)
    from lib.parts import Geo as _G  # noqa: F401

    for x in (-0.302, -0.214, -0.126, -0.038):
        path = catmull([(x, 0.300, 0.215), (x, 0.338, 0.180), (x, 0.362, 0.150), (x, 0.366, 0.128)], 5)
        g += tube(path, 0.020, 10 if lite else 14, PLASTIC, hard=False)
    # throttle body at the right end + actuator housing
    tb = lathe([(0.030, 0.0), (0.040, 0.0), (0.040, 0.050), (0.030, 0.050), (0.030, 0.0)], 24, ALU, axis="-x", hard=False)
    g += tb.moved(-0.335, 0.300, 0.265)
    g += box(0.040, 0.060, 0.060, ALU, center=(-0.360, 0.335, 0.300))
    # flap actuator + MAP sensor
    g += box(0.040, 0.030, 0.030, PLASTIC, center=(-0.10, 0.395, 0.290))
    return g.transform(ENGINE_M)


def egr(lite: bool) -> Geo:
    g = Geo()
    g += box(0.060, 0.050, 0.060, ALU, center=(0.0, 0.0, 0.0))
    g += lathe([(0.0, 0.0), (0.026, 0.0), (0.026, 0.050), (0.020, 0.058), (0.0, 0.060)], 20, PLASTIC, hard=False).moved(0.0, 0.025, 0.0)
    g += box(0.020, 0.020, 0.024, PLASTIC, center=(0.020, 0.080, 0.010))
    g += lathe([(0.018, 0.0), (0.024, 0.0), (0.024, 0.060), (0.018, 0.060), (0.018, 0.0)], 16, ALU, axis="-z", hard=False).moved(0.0, -0.005, -0.030)
    g += box(0.070, 0.008, 0.050, ALU, center=(0.0, -0.028, 0.000))
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
    snork = polyline_fillet([(0.02, 0.040, 0.140), (0.02, 0.060, 0.330), (0.00, 0.050, 0.560)], 0.10, 8)
    g += tube(snork, 0.036, 14, PLASTIC, hard=False)
    # outlet bellows down to the turbo compressor inlet
    out_path = catmull([(-0.09, -0.060, -0.120), (-0.14, -0.120, -0.180), (-0.24, -0.180, -0.210), (-0.30, -0.200, -0.200)], 6)
    g += tube(out_path, 0.034, 14, RUBBER, hard=False)
    return g.moved(0.38, 0.84, 1.36)


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
    hot = polyline_fillet([(0.030, 0.700, 1.120), (0.200, 0.705, 1.150), (0.340, 0.680, 1.300), (0.340, 0.680, 1.850), (0.360, 0.420, 1.960), (0.380, 0.270, 2.010)], 0.08, 8)
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
