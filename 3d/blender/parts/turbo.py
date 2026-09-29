"""Turbina: cast-iron turbine volute, alu compressor volute with a visible 6+6 wheel, CHRA, oil and
coolant lines, wastegate actuator, heat-shield half shell. Shaft along vehicle x, compressor +x."""

from __future__ import annotations

import math

from mathutils import Vector

from lib.geo import Geo, R, T, box, catmull, cylinder, lathe, radial, sweep, tube
from lib.parts import add_centered
from lib.shapes import along

IRON = "mat_cast_iron"
ALU = "mat_cast_alu"
STEEL = "mat_machined_steel"
DARK = "mat_steel_dark"
SHIELD = "mat_heat_shield"

C = Vector((-0.06, 0.64, 1.16))  # shaft centre


def volute(x: float, R0: float, R1: float, r0: float, r1: float, mat: str, sides: int, steps: int, outlet_len: float, outlet_dir_sign: float = 1.0, start_deg: float = 0.0) -> Geo:
    """Spiral volute around the x axis at axial position x; section grows r0 -> r1, ends in a tangent outlet."""
    path = []
    scales = []
    turn = 330.0
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(start_deg + turn * t * outlet_dir_sign)
        Rr = R0 + (R1 - R0) * t
        path.append(Vector((x, Rr * math.cos(a), Rr * math.sin(a))))
        scales.append((r0 + (r1 - r0) * t) / r1)
    # tangent outlet
    a_end = math.radians(start_deg + turn * outlet_dir_sign)
    tang = Vector((0.0, -math.sin(a_end), math.cos(a_end))) * outlet_dir_sign
    last = path[-1]
    for k in range(1, 4):
        path.append(last + tang * (outlet_len * k / 3))
        scales.append(1.0)
    prof = [(r1 * math.cos(2 * math.pi * j / sides), r1 * math.sin(2 * math.pi * j / sides)) for j in range(sides)]
    return sweep(path, prof, mat, hard=False, scales=scales, up_hint=(1, 0, 0))


def turbo(lite: bool) -> Geo:
    g = Geo()
    sides = 14 if lite else 20
    steps = 20 if lite else 32
    seg = 24 if lite else 36
    # turbine side (-x): volute + exducer outlet with V-band flange
    tv = volute(-0.050, 0.050, 0.060, 0.014, 0.030, IRON, sides, steps, 0.050, 1.0, start_deg=200)
    g += tv
    g += lathe([(0.0, -0.030), (0.048, -0.030), (0.052, -0.020), (0.052, 0.030), (0.0, 0.030)], seg, IRON, axis="x", hard=False).moved(-0.050, 0, 0)
    g += lathe([(0.030, 0.0), (0.034, 0.0), (0.034, 0.050), (0.030, 0.050)], seg, IRON, axis="-x", hard=False).moved(-0.080, 0, 0)
    g += lathe([(0.030, 0.0), (0.044, 0.0), (0.044, 0.010), (0.030, 0.010), (0.030, 0.0)], seg, STEEL, axis="-x", hard=False).moved(-0.125, 0, 0)
    # turbine inlet flange rising toward the head's exhaust side (up + front)
    inlet = catmull([(-0.050, 0.05, 0.02), (-0.050, 0.09, 0.05), (-0.055, 0.12, 0.10)], 6)
    g += tube(inlet, 0.024, sides, IRON, hard=False)
    g += box(0.070, 0.012, 0.070, IRON, center=(-0.055, 0.125, 0.105))
    # inlet flange studs + nuts (4) and a V-band clamp on the turbine outlet
    from lib.shapes import hex_nut

    for dx in (-0.026, 0.026):
        for dz in (-0.026, 0.026):
            g += cylinder(0.0035, 0.018, 8, STEEL, axis="y", center=False).moved(-0.055 + dx, 0.131, 0.105 + dz)
            if not lite:
                g += hex_nut(0.010, 0.006, STEEL).moved(-0.055 + dx, 0.137, 0.105 + dz)
    g += lathe([(0.044, 0.0), (0.049, 0.0), (0.049, 0.014), (0.044, 0.014), (0.044, 0.0)], seg, STEEL, axis="-x", hard=False).moved(-0.127, 0, 0)
    g += box(0.012, 0.020, 0.016, STEEL, center=(-0.134, 0.052, 0.0))
    # centre housing (CHRA)
    g += lathe([(0.0, -0.022), (0.034, -0.022), (0.038, -0.010), (0.038, 0.010), (0.034, 0.022), (0.0, 0.022)], seg, STEEL, axis="x", hard=False)
    # CHRA oil inlet banjo (top) and drain flange (bottom), coolant ports
    g += cylinder(0.011, 0.010, 6, STEEL, axis="y").moved(0.0, 0.041, 0.0)
    g += box(0.030, 0.008, 0.024, STEEL, center=(0.0, -0.041, 0.0))
    for dz in (-0.030, 0.030):
        g += cylinder(0.007, 0.012, 8, STEEL, axis="z").moved(0.006, 0.0, dz)
    # compressor side (+x): volute + inlet with bead lip + visible wheel
    cv = volute(0.050, 0.046, 0.058, 0.012, 0.026, ALU, sides, steps, 0.070, -1.0, start_deg=160)
    g += cv
    g += lathe([(0.0, -0.028), (0.052, -0.028), (0.056, -0.018), (0.056, 0.024), (0.034, 0.030), (0.0, 0.030)], seg, ALU, axis="x", hard=False).moved(0.050, 0, 0)
    inlet_prof = [(0.030, 0.0), (0.037, 0.0), (0.037, 0.050), (0.040, 0.056), (0.036, 0.064), (0.030, 0.064), (0.030, 0.0)]
    g += lathe(inlet_prof, seg, ALU, axis="x", hard=False).moved(0.078, 0, 0)
    hub = lathe([(0.0, 0.0), (0.018, 0.0), (0.010, 0.030), (0.004, 0.040), (0.0, 0.041)], 16, STEEL, axis="x", hard=False)
    g += hub.moved(0.080, 0, 0)
    blade = box(0.034, 0.0012, 0.020, STEEL, center=(0.017, 0.0, 0.019), hard=False)
    blade.transform(R("x", 18))
    g += radial(blade, 6, "x").moved(0.082, 0, 0)
    splitter = box(0.022, 0.0012, 0.018, STEEL, center=(0.011, 0.0, 0.017), hard=False)
    splitter.transform(R("x", 18))
    g += radial(splitter, 6, "x", phase=30).moved(0.082, 0, 0)
    # oil feed (top) and return (bottom) lines, coolant line
    feed = catmull([(0.0, 0.034, 0.0), (0.0, 0.070, 0.010), (0.02, 0.110, 0.030), (0.06, 0.150, 0.050)], 6)
    g += tube(feed, 0.0045, 8, DARK, hard=False)
    ret = catmull([(0.0, -0.034, 0.0), (0.0, -0.070, 0.010), (0.01, -0.110, 0.040)], 6)
    g += tube(ret, 0.009, 10, DARK, hard=False)
    cool = catmull([(0.012, 0.0, -0.036), (0.02, 0.03, -0.070), (0.04, 0.09, -0.080)], 6)
    g += tube(cool, 0.0045, 8, DARK, hard=False)
    # wastegate actuator: pressure can on a bracket at the compressor + rod to the turbine lever
    can = lathe([(0.0, 0.0), (0.034, 0.0), (0.036, 0.004), (0.036, 0.012), (0.038, 0.014), (0.036, 0.016), (0.036, 0.026), (0.030, 0.034), (0.008, 0.036), (0.008, 0.050), (0.0, 0.050)], 28, DARK, hard=False)
    can.transform(R("x", 90))
    g += can.moved(0.050, -0.030, 0.072)
    g += box(0.020, 0.040, 0.006, DARK, center=(0.050, -0.030, 0.064))
    g += along(cylinder(0.003, 0.10, 8, STEEL, center=False), Vector((0.050, -0.030, 0.070)), Vector((-0.050, -0.012, 0.062)))
    g += box(0.008, 0.028, 0.006, DARK, center=(-0.052, -0.012, 0.060))
    # wastegate lever pivot + rod-end ball and the adjuster nut on the rod
    g += cylinder(0.006, 0.014, 12, STEEL, axis="x").moved(-0.052, -0.024, 0.060)
    g += lathe([(0.0, -0.006), (0.005, -0.004), (0.006, 0.0), (0.005, 0.004), (0.0, 0.006)], 12, STEEL, hard=False).moved(-0.050, -0.012, 0.062)
    g += cylinder(0.005, 0.010, 6, STEEL, axis="x").moved(0.000, -0.021, 0.066)
    # heat-shield half shell over the turbine volute (top half, embossed)
    shield = lathe([(0.096, -0.034), (0.098, -0.030), (0.098, 0.030), (0.096, 0.034)], 20, SHIELD, axis="x", hard=False, angle=95.0, phase=40.0, uv_u=4, uv_v=10)
    shield.transform(R("x", 0))
    g += shield.moved(-0.050, 0, 0)
    return g.moved(C.x, C.y, C.z)


def build(ctx) -> None:
    add_centered(ctx, "turbina", "main", turbo(ctx.lite), pivot=C, bevel=0.0)
