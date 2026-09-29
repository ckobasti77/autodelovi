"""Hlađenje i klima: radiator, fan + shroud, condenser + drier, A/C compressor, thermostat, hoses."""

from __future__ import annotations

import math

from lib.geo import Geo, R, S, box, circle2d, cylinder, extrude, lathe, polyline_fillet, radial, rounded_rect, tube
from lib.parts import add_centered
from parts.belts import AC_P

FINS = "mat_core_fins"
PLASTIC = "mat_plastic_black"
DARK = "mat_steel_dark"
ALU = "mat_cast_alu"
GREY = "mat_plastic_grey"
HOSE = "mat_hose"


def radiator(lite: bool) -> Geo:
    g = Geo()
    g += extrude(rounded_rect(0.640, 0.480, 0.004, 1), 0.030, FINS, z0=-0.015)
    for s in (1, -1):
        tank = extrude(rounded_rect(0.040, 0.520, 0.012, 3), 0.050, PLASTIC, z0=-0.025)
        g += tank.moved(s * 0.340, 0.0, 0.0)
        g += box(0.020, 0.040, 0.020, PLASTIC, center=(s * 0.350, -0.270, 0.0))
    # nozzles: top-left (upper hose) and bottom-right (lower hose), pointing back
    for x, y in ((0.345, 0.205), (-0.345, -0.205)):
        nz = lathe([(0.013, 0.0), (0.017, 0.0), (0.017, 0.040), (0.019, 0.044), (0.017, 0.048), (0.013, 0.048), (0.013, 0.0)], 16, PLASTIC, axis="z", hard=False)
        g += nz.transform(S(1, 1, -1)).moved(x, y, -0.020)
    g += cylinder(0.014, 0.030, 16, PLASTIC, axis="x").moved(0.375, 0.200, 0.0)
    g.transform(R("x", 0))
    return g.moved(0.0, 0.570, 1.950)


def fan(lite: bool) -> Geo:
    g = Geo()
    shroud = extrude(rounded_rect(0.620, 0.500, 0.030, 3), 0.012, PLASTIC, holes=[circle2d(0.205, 48 if not lite else 32)], z0=-0.006)
    g += shroud
    g += lathe([(0.205, -0.030), (0.212, -0.030), (0.212, 0.006), (0.205, 0.006), (0.205, -0.030)], 48 if not lite else 32, PLASTIC, axis="z", hard=False)
    # 7 twisted blades + hub + motor
    blade = extrude([(0.040, -0.030), (0.195, -0.050), (0.198, -0.010), (0.045, 0.012)], 0.004, PLASTIC, z0=-0.002)
    blade.transform(R("x", 28))
    g += radial(blade, 7, "z").moved(0, 0, -0.018)
    g += lathe([(0.0, -0.035), (0.045, -0.035), (0.050, -0.020), (0.050, 0.0), (0.0, 0.0)], 28, PLASTIC, axis="z", hard=False)
    g += lathe([(0.0, -0.090), (0.042, -0.090), (0.045, -0.080), (0.045, -0.035), (0.0, -0.035)], 28, DARK, axis="z", hard=False)
    for a in (0, 120, 240):
        arm = box(0.200, 0.014, 0.010, PLASTIC, center=(0.105, 0.0, -0.030))
        g += arm.transform(R("z", a + 30))
    g += box(0.060, 0.030, 0.020, PLASTIC, center=(0.250, -0.210, -0.020))
    return g.moved(0.0, 0.570, 1.875)


def condenser(lite: bool) -> Geo:
    g = Geo()
    g += extrude(rounded_rect(0.640, 0.450, 0.003, 1), 0.016, FINS, z0=-0.008)
    for s in (1, -1):
        g += box(0.018, 0.470, 0.026, DARK, center=(s * 0.328, 0.0, 0.0))
    drier = lathe([(0.0, -0.130), (0.024, -0.130), (0.026, -0.120), (0.026, 0.110), (0.020, 0.124), (0.0, 0.126)], 18, DARK, hard=False)
    g += drier.moved(0.360, 0.0, -0.012)
    pipe = polyline_fillet([(0.328, 0.200, -0.010), (0.300, 0.250, -0.060), (0.200, 0.260, -0.200)], 0.04, 6)
    g += tube(pipe, 0.007, 10, DARK, hard=False)
    return g.moved(0.0, 0.565, 2.010)


def compressor(lite: bool) -> Geo:
    g = Geo()
    seg = 28 if lite else 40
    body = [(0.0, 0.000), (0.058, 0.000), (0.064, 0.012), (0.064, 0.170), (0.058, 0.190), (0.050, 0.200), (0.0, 0.202)]
    g += lathe(body, seg, ALU, axis="x", hard=False)
    for x in (0.040, 0.075, 0.110, 0.145):
        g += lathe([(0.064, x), (0.068, x + 0.004), (0.068, x + 0.010), (0.064, x + 0.014)], seg, ALU, axis="x", hard=False)
    # clutch pulley at the front (toward the belt plane)
    prof = [(0.0, -0.034), (0.030, -0.034)]
    for k in range(6):
        y0 = -0.032 + k * 0.0042
        prof += [(0.0545, y0), (0.0515, y0 + 0.0021)]
    prof += [(0.0545, -0.006), (0.030, -0.004), (0.0, -0.004)]
    g += lathe(prof, seg, DARK, axis="x", hard=False)
    # service ports + ears
    for dz in (-0.025, 0.030):
        g += cylinder(0.010, 0.030, 12, DARK, axis="y").moved(0.170, 0.070, dz)
    for x in (0.030, 0.160):
        g += box(0.026, 0.040, 0.050, ALU, center=(x, -0.060, -0.030))
    return g.moved(-0.440, AC_P[1], AC_P[0])


def thermostat(lite: bool) -> Geo:
    g = Geo()
    g += box(0.090, 0.080, 0.070, GREY, center=(0.0, 0.0, 0.0))
    g += lathe([(0.0, 0.0), (0.036, 0.0), (0.036, 0.020), (0.030, 0.026), (0.0, 0.026)], 20, GREY, hard=False).moved(0.0, 0.040, 0.0)
    for d, (x, y, z) in ((("z"), (0.020, 0.020, 0.035)), (("x"), (0.045, -0.010, 0.0))):
        n = lathe([(0.013, 0.0), (0.017, 0.0), (0.017, 0.030), (0.019, 0.034), (0.017, 0.038), (0.013, 0.038), (0.013, 0.0)], 14, GREY, axis=d, hard=False)
        g += n.moved(x, y, z)
    return g.moved(0.110, 0.710, 1.450)


def hoses(lite: bool) -> Geo:
    g = Geo()
    sides = 10 if lite else 14
    upper = polyline_fillet([(0.130, 0.730, 1.523), (0.160, 0.760, 1.640), (0.260, 0.780, 1.820), (0.345, 0.775, 1.905)], 0.08, 8)
    g += tube(upper, 0.016, sides, HOSE, hard=False)
    lower = polyline_fillet([(-0.345, 0.365, 1.905), (-0.470, 0.360, 1.880), (-0.520, 0.370, 1.760), (-0.520, 0.390, 1.520), (-0.500, 0.400, 1.400)], 0.07, 8)
    g += tube(lower, 0.017, sides, HOSE, hard=False)
    for path in (upper, lower):
        for i in (0, -1):
            p = path[i]
            q = path[1] if i == 0 else path[-2]
            d = (q - p).normalized()
            g += tube([p + d * 0.012, p + d * 0.022], 0.0195, sides, DARK, hard=False)
    return g


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "hladnjak-ventilator", "radiator", radiator(lite), bevel=0.0015)
    add_centered(ctx, "hladnjak-ventilator", "fan", fan(lite), bevel=0.0)
    add_centered(ctx, "klima", "condenser", condenser(lite), bevel=0.001)
    add_centered(ctx, "klima", "compressor", compressor(lite), bevel=0.0)
    add_centered(ctx, "termostat-creva", "thermostat", thermostat(lite), bevel=0.002)
    add_centered(ctx, "termostat-creva", "hoses", hoses(lite), bevel=0.0)
