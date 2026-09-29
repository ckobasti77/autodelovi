"""Izduvni sistem: downpipe + close-coupled DPF/cat with embossed heat shield, mid silencer,
rear transverse silencer with a chrome tip (the only chrome on the car)."""

from __future__ import annotations

import math

from mathutils import Vector

from lib.geo import Geo, R, box, lathe, polyline_fillet, superellipse2d, sweep, tube
from lib.parts import add_centered

DARK = "mat_steel_dark"
SHIELD = "mat_heat_shield"
CHROME = "mat_chrome"
RUBBER = "mat_rubber"


def oval_can(length: float, a: float, b: float, mat: str, cone: float = 0.05, r_pipe: float = 0.028, n: int = 24) -> Geo:
    """Oval silencer/catalyst can along +z from 0 to length with conical ends."""
    sections = []
    prof = superellipse2d(a, b, 2.6, n)
    pipe = [(r_pipe * math.cos(2 * math.pi * i / n), r_pipe * math.sin(2 * math.pi * i / n)) for i in range(n)]
    for z, k in ((0.0, 0.0), (cone * 0.6, 0.7), (cone, 1.0), (length - cone, 1.0), (length - cone * 0.6, 0.7), (length, 0.0)):
        sec = [(p[0] * k + q[0] * (1 - k), p[1] * k + q[1] * (1 - k), z) for p, q in zip(prof, pipe)]
        sections.append(sec)
    from lib.geo import loft

    return loft(sections, mat, closed=True, caps=False, hard=False)


def hanger(p) -> Geo:
    g = lathe([(0.004, -0.012), (0.014, -0.012), (0.014, 0.012), (0.004, 0.012), (0.004, -0.012)], 12, RUBBER, axis="x", hard=False)
    return g.moved(*p)


def dpf(lite: bool) -> Geo:
    g = Geo()
    sides = 14 if lite else 18
    down = polyline_fillet([(-0.190, 0.640, 1.160), (-0.110, 0.610, 1.110), (-0.040, 0.555, 1.070), (0.000, 0.420, 1.010), (0.000, 0.300, 0.950)], 0.07, 8)
    g += tube(down, 0.030, sides, DARK, hard=False)
    # V-band flange at the turbine outlet + ribbed flex section
    g += lathe([(0.030, 0.0), (0.044, 0.0), (0.044, 0.010), (0.030, 0.010), (0.030, 0.0)], 24, DARK, axis="x", hard=False).moved(-0.200, 0.640, 1.160)
    for k in range(8):
        g += lathe([(0.031, 0.0), (0.035, 0.002), (0.031, 0.004)], 18, DARK, axis="-z", hard=False).moved(0.0, 0.300, 0.948 - 0.006 * k)
    # DPF / catalyst can under the tunnel
    can = oval_can(0.500, 0.085, 0.068, DARK, cone=0.07, r_pipe=0.030)
    can.transform(R("y", 180))  # run toward -z (rear)
    g += can.moved(0.0, 0.265, 0.905)
    # embossed heat-shield half shell over the can
    shield = lathe([(0.100, 0.0), (0.104, 0.010), (0.104, 0.420), (0.100, 0.430)], 20, SHIELD, axis="-z", hard=False, angle=160.0, phase=10.0, uv_u=4, uv_v=10)
    shield.transform(R("z", 90))
    g += shield.moved(0.0, 0.265, 0.860)
    # outlet stub
    g += tube([Vector((0.0, 0.265, 0.405)), Vector((0.0, 0.262, 0.360))], 0.028, sides, DARK, hard=False)
    return g


def mid(lite: bool) -> Geo:
    g = Geo()
    sides = 14 if lite else 16
    g += tube([Vector((0.0, 0.262, 0.360)), Vector((0.010, 0.230, 0.000)), Vector((0.020, 0.222, -0.240))], 0.027, sides, DARK, hard=False)
    can = oval_can(0.500, 0.100, 0.060, DARK, cone=0.06, r_pipe=0.027)
    can.transform(R("y", 180))
    g += can.moved(0.020, 0.222, -0.245)
    g += tube([Vector((0.020, 0.222, -0.745)), Vector((0.022, 0.222, -0.950))], 0.027, sides, DARK, hard=False)
    for z in (-0.30, -0.70):
        g += hanger((0.10, 0.260, z))
    return g


def rear(lite: bool) -> Geo:
    g = Geo()
    sides = 14 if lite else 16
    pipe = polyline_fillet([(0.022, 0.222, -0.950), (0.050, 0.330, -1.080), (0.060, 0.360, -1.270), (0.080, 0.290, -1.520), (0.100, 0.260, -1.700)], 0.08, 8)
    g += tube(pipe, 0.027, sides, DARK, hard=False)
    can = oval_can(0.840, 0.110, 0.080, DARK, cone=0.06, r_pipe=0.028)
    can.transform(R("y", 90))  # transverse along +x
    g += can.moved(-0.400, 0.255, -1.860)
    tail = polyline_fillet([(0.440, 0.255, -1.860), (0.450, 0.235, -1.960), (0.455, 0.225, -2.030)], 0.05, 6)
    g += tube(tail, 0.026, sides, DARK, hard=False)
    tip = lathe([(0.028, 0.0), (0.036, 0.0), (0.036, 0.060), (0.032, 0.064), (0.028, 0.060), (0.028, 0.0)], 24, CHROME, axis="-z", hard=False)
    g += tip.moved(0.455, 0.225, -2.010)
    for x in (-0.30, 0.30):
        g += hanger((x, 0.330, -1.860))
    return g


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "dpf-katalizator", "main", dpf(lite), bevel=0.0)
    add_centered(ctx, "auspuh", "mid", mid(lite), bevel=0.0)
    add_centered(ctx, "auspuh", "rear", rear(lite), bevel=0.0)
