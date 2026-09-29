"""Vešanje: MacPherson struts, rear spring + damper, front L-arms, torsion beam, knuckles, subframe."""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.corner import from_extrude
from lib.geo import Geo, R, T, box, circle2d, cylinder, extrude, lathe, look_axis
from lib.shapes import along, ball_joint, bellows, box_tube, bushing, ring_x, spring

DARK = "mat_steel_dark"
BLACK = "mat_painted_black"
STEEL = "mat_machined_steel"
RUBBER = "mat_rubber"
IRON = "mat_cast_iron"

STRUT_BOT = Vector((0.66, 0.44, 1.30))
STRUT_TOP = Vector((0.57, 0.90, 1.25))


def front_strut(lite: bool) -> tuple[Geo, Vector]:
    """Left front strut in vehicle coordinates (absolute); returns (geo, pivot)."""
    L = (STRUT_TOP - STRUT_BOT).length
    seg = 20 if lite else 28
    g = Geo()
    # damper tube with a rolled top and the lower spring seat
    g += lathe([(0.0, 0.0), (0.0255, 0.0), (0.0255, 0.186), (0.0230, 0.196), (0.012, 0.200), (0.0, 0.200)], seg, BLACK, hard=False)
    g += lathe([(0.026, 0.150), (0.034, 0.150), (0.072, 0.170), (0.080, 0.174), (0.080, 0.180), (0.070, 0.180), (0.034, 0.162), (0.026, 0.162), (0.026, 0.150)], seg, DARK, hard=False)
    # link bracket (stabilizer drop link) on the tube, facing inboard-rear
    br = extrude([(-0.012, 0.0), (0.012, 0.0), (0.010, 0.050), (-0.010, 0.050)], 0.004, BLACK, holes=[circle2d(0.005, 10, 0.0, 0.036)])
    br.transform(R("x", -90)).transform(R("y", 200)).moved(0.0, 0.080, 0.0)
    g += br
    # piston rod, bump stop + bellows boot
    g += lathe([(0.0, 0.195), (0.011, 0.195), (0.011, L - 0.020), (0.0, L - 0.020)], 12, STEEL, hard=False)
    g += bellows(0.024, 0.032, 0.17, 6, RUBBER, seg=seg).moved(0, 0.205, 0)
    # upper seat + top mount (rubber sandwich, steel cap, nut)
    g += lathe([(0.030, L - 0.070), (0.080, L - 0.066), (0.082, L - 0.060), (0.034, L - 0.058), (0.030, L - 0.070)], seg, DARK, hard=False)
    g += lathe([(0.020, L - 0.058), (0.060, L - 0.058), (0.064, L - 0.040), (0.058, L - 0.026), (0.020, L - 0.026), (0.020, L - 0.058)], seg, RUBBER, hard=False)
    g += lathe([(0.0, L - 0.026), (0.066, L - 0.026), (0.066, L - 0.020), (0.030, L - 0.016), (0.0, L - 0.016)], seg, DARK, hard=False)
    g += cylinder(0.011, 0.016, 6, DARK, center=False).moved(0, L - 0.016, 0)
    # coil spring between the seats
    sp = spring(0.068, 0.0062, (L - 0.068) - 0.178, 4.6, DARK, sides=8 if lite else 10, spt=18 if lite else 26)
    g += sp.moved(0, 0.178, 0)
    along(g, STRUT_BOT, STRUT_TOP)
    pivot = (STRUT_BOT + STRUT_TOP) / 2
    return g, pivot


def rear_spring_damper(lite: bool) -> tuple[Geo, Vector]:
    g = Geo()
    seg = 20 if lite else 26
    sp_c = Vector((0.52, 0.245, -1.24))
    sp = spring(0.058, 0.0058, 0.225, 4.2, DARK, sides=8 if lite else 10, spt=18 if lite else 24, barrel=0.12)
    g += sp.moved(*sp_c)
    # rubber spring pads (isolators)
    g += lathe([(0.030, 0.0), (0.066, 0.0), (0.066, 0.008), (0.030, 0.008), (0.030, 0.0)], seg, RUBBER, hard=False).moved(sp_c.x, sp_c.y - 0.008, sp_c.z)
    g += lathe([(0.030, 0.0), (0.066, 0.0), (0.066, 0.008), (0.030, 0.008), (0.030, 0.0)], seg, RUBBER, hard=False).moved(sp_c.x, sp_c.y + 0.225, sp_c.z)
    # damper with eyes
    d0 = Vector((0.62, 0.30, -1.40))
    d1 = Vector((0.605, 0.76, -1.44))
    L = (d1 - d0).length
    dm = Geo()
    dm += lathe([(0.0, 0.020), (0.022, 0.020), (0.022, 0.265), (0.019, 0.275), (0.0, 0.278)], seg, BLACK, hard=False)
    dm += lathe([(0.0, 0.270), (0.009, 0.270), (0.009, L - 0.025), (0.0, L - 0.025)], 10, STEEL, hard=False)
    dm += bellows(0.016, 0.021, 0.12, 5, RUBBER, seg=16).moved(0, 0.285, 0)
    for y in (0.0, L):
        eye = bushing("x", 0.018, 0.034, RUBBER, DARK, seg=16)
        dm += eye.moved(0, y, 0)
    along(dm, d0, d1)
    g += dm
    pivot = (sp_c + Vector((0, 0.11, 0)) + (d0 + d1) / 2) / 2
    return g, pivot


def front_arm(lite: bool) -> tuple[Geo, Vector]:
    y = 0.200
    pts = [
        (0.742, 1.296), (0.735, 1.331), (0.712, 1.346), (0.600, 1.340), (0.470, 1.334), (0.402, 1.336),
        (0.382, 1.322), (0.384, 1.296), (0.418, 1.262), (0.438, 1.186), (0.440, 1.090), (0.452, 1.050),
        (0.436, 1.012), (0.414, 0.996), (0.440, 0.980), (0.478, 0.990), (0.506, 1.030), (0.566, 1.132),
        (0.652, 1.232), (0.724, 1.281),
    ]
    outline = [(x, -z) for x, z in pts]
    g = from_extrude(extrude(outline, 0.020, DARK, z0=y - 0.010))
    # front bushing (axis along z) and rear hydro bushing (vertical)
    g += bushing("z", 0.028, 0.050, RUBBER, DARK, seg=18 if lite else 22).moved(0.382, y, 1.310)
    g += bushing("y", 0.036, 0.046, RUBBER, DARK, seg=18 if lite else 22).moved(0.440, y, 1.004)
    # ball joint pointing up into the knuckle
    g += ball_joint(0.020, DARK, RUBBER, (0, 1, 0)).moved(0.715, y + 0.010, 1.312)
    pivot = Vector((0.56, y, 1.18))
    return g, pivot


def torsion_beam(lite: bool) -> tuple[Geo, Vector]:
    g = Geo()
    beam_y, beam_z = VH.BEAM[1], VH.BEAM[2]
    # inverted-U cross beam (profile (y, z) offsets, CCW), swept along x
    u = [(-0.035, -0.050), (0.025, -0.050), (0.035, -0.040), (0.035, 0.040), (0.025, 0.050), (-0.035, 0.050),
         (-0.035, 0.046), (0.022, 0.046), (0.031, 0.038), (0.031, -0.038), (0.022, -0.046), (-0.035, -0.046)]
    from lib.geo import sweep

    path = [Vector((x, beam_y, beam_z)) for x in (-0.60, -0.3, 0.0, 0.3, 0.60)]
    g += sweep(path, [(a, b) for a, b in u], BLACK, up_hint=(0, 1, 0), hard=True, cap_cdt=True)
    for s in (1, -1):
        # trailing arm: pivot bushing -> beam end -> wheel carrier, tapering box section
        p0 = Vector((s * 0.62, 0.350, -0.75))
        p1 = Vector((s * 0.64, 0.315, -1.18))
        p2 = Vector((s * 0.70, 0.316, -1.31))
        g += box_tube([p0, p1, p2], 0.060, 0.050, BLACK, r=0.012, fillet=0.12, hard=False, scales=(0.8, 1.15))
        g += bushing("x", 0.032, 0.060, RUBBER, DARK, seg=18 if lite else 22).moved(p0.x, p0.y, p0.z)
        # wheel carrier flange (the hub bolts here)
        fl = lathe([(0.0, 0.0), (0.058, 0.0), (0.058, 0.010), (0.0, 0.010)], 24, BLACK, axis="x", hard=False)
        g += fl.moved(s * 0.715 if s > 0 else -0.725, 0.316, -1.31)
        # spring pad and damper bracket
        g += cylinder(0.068, 0.010, 24, BLACK, axis="y").moved(s * 0.52, 0.240, -1.24)
        g += box(0.040, 0.060, 0.050, BLACK, center=(s * 0.62, 0.285, -1.395))
    pivot = Vector((0.0, 0.30, -1.12))
    return g, pivot


def knuckle(lite: bool) -> Geo:
    """Left front knuckle (absolute vehicle coordinates)."""
    g = Geo()
    xb0, xb1 = 0.706, 0.752
    g += ring_x(0.041, 0.058, xb0, xb1, IRON, seg=24 if lite else 32).moved(0, VH.WHEEL_Y, VH.Z_FRONT_AXLE)
    cx = (xb0 + xb1) / 2
    y0, z0 = VH.WHEEL_Y, VH.Z_FRONT_AXLE
    # upper arm to the strut pinch clamp
    g += box_tube([(cx, y0 + 0.05, z0 + 0.005), (0.690, 0.40, 1.302), (0.668, 0.455, 1.300)], 0.040, 0.030, IRON, r=0.008, fillet=0.03)
    clamp = lathe([(0.0258, 0.0), (0.036, 0.0), (0.036, 0.070), (0.0258, 0.070), (0.0258, 0.0)], 20, IRON, hard=False)
    g += along(clamp, STRUT_BOT - Vector((0, 0.01, 0)), STRUT_TOP)
    g += box(0.018, 0.060, 0.030, IRON, center=(0.700, 0.472, 1.300))
    # lower leg to the ball joint seat
    g += box_tube([(cx, y0 - 0.05, z0), (0.725, 0.235, 1.312), (0.716, 0.222, 1.312)], 0.040, 0.034, IRON, r=0.008, fillet=0.03)
    # steering arm back to the tie-rod end
    g += box_tube([(cx - 0.01, y0 - 0.01, z0 - 0.05), (0.690, 0.302, 1.20), (0.660, 0.300, 1.162)], 0.026, 0.022, IRON, r=0.006, fillet=0.03)
    g += cylinder(0.014, 0.020, 14, IRON, axis="y").moved(0.658, 0.300, 1.160)
    # caliper carrier lugs (rear-top)
    for dy, dz in ((0.070, -0.070), (-0.010, -0.105)):
        g += box(0.030, 0.026, 0.026, IRON, center=(0.736, y0 + dy, z0 + dz))
    return g


def subframe(lite: bool) -> Geo:
    g = Geo()
    for s in (1, -1):
        g += box_tube([(s * 0.42, 0.250, 1.275), (s * 0.40, 0.235, 1.12), (s * 0.34, 0.215, 0.99)], 0.050, 0.060, "mat_painted_black", r=0.010, fillet=0.08)
        # arm bracket plates
        g += box(0.070, 0.070, 0.050, "mat_painted_black", center=(s * 0.400, 0.215, 1.310))
        g += box(0.060, 0.060, 0.070, "mat_painted_black", center=(s * 0.440, 0.212, 1.004))
    g += box_tube([(-0.36, 0.215, 0.985), (0.0, 0.205, 0.980), (0.36, 0.215, 0.985)], 0.050, 0.070, "mat_painted_black", r=0.012, fillet=0.1)
    # torque-rod bracket
    g += box(0.070, 0.050, 0.060, "mat_painted_black", center=(0.05, 0.215, 1.02))
    return g


def build(ctx) -> None:
    lite = ctx.lite
    # front struts
    g, piv = front_strut(lite)
    for corner, s in (("fl", 1), ("fr", -1)):
        gg = g.copy() if s > 0 else g.mirrored_x()
        p = Vector((s * piv.x, piv.y, piv.z))
        ctx.add_part("amortizeri-opruge", corner, tuple(p), gg.moved(-p.x, -p.y, -p.z), bevel=0.0)
    g, piv = rear_spring_damper(lite)
    for corner, s in (("rl", 1), ("rr", -1)):
        gg = g.copy() if s > 0 else g.mirrored_x()
        p = Vector((s * piv.x, piv.y, piv.z))
        ctx.add_part("amortizeri-opruge", corner, tuple(p), gg.moved(-p.x, -p.y, -p.z), bevel=0.0)
    g, piv = front_arm(lite)
    for inst, s in (("fl", 1), ("fr", -1)):
        gg = g.copy() if s > 0 else g.mirrored_x()
        p = Vector((s * piv.x, piv.y, piv.z))
        ctx.add_part("ramena-selen-blokovi", inst, tuple(p), gg.moved(-p.x, -p.y, -p.z), bevel=0.003, segments=2, profile=0.6)
    g, piv = torsion_beam(lite)
    ctx.add_part("ramena-selen-blokovi", "rear-axle", tuple(piv), g.moved(-piv.x, -piv.y, -piv.z), bevel=0.002)
    # static: knuckles + subframe
    k = knuckle(lite)
    ctx.add_static("chassis__knuckle__fl", "vesanje-i-upravljanje", k, bevel=0.002)
    ctx.add_static("chassis__knuckle__fr", "vesanje-i-upravljanje", k.mirrored_x(), bevel=0.002)
    ctx.add_static("chassis__subframe", "vesanje-i-upravljanje", subframe(lite), bevel=0.0)
