"""Motor: block (+crank sprocket, oil-filter module), head (+cam cover, cam sprockets), sump,
coils + spark plugs, engine/gearbox mounts.

Engine parts are authored in an *upright frame* (origin on the crank axis at x = 0, +Y = cylinder
axis, +Z = intake side/front) and tilted 12 deg toward the firewall with ENGINE_M.
"""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, T, box, circle2d, cylinder, extrude, gear2d, lathe, rounded_rect
from lib.parts import add_centered
from lib.shapes import bushing

IRON = "mat_cast_iron"
ALU = "mat_cast_alu"
PLASTIC = "mat_plastic_black"
DARK = "mat_steel_dark"
STEEL = "mat_machined_steel"
CERAMIC = "mat_ceramic"
RUBBER = "mat_rubber"

ENGINE_M = T(0.0, VH.CRANK_Y, VH.CRANK_Z) @ R("x", -VH.ENGINE_TILT)
X0, X1 = VH.BLOCK_X0, VH.BLOCK_X1
DECK = 0.270
HEAD_TOP = 0.400
COVER_TOP = 0.478
CAM_Y = 0.372
CAM_Z = 0.058
PITCH = 0.009525


def gear_r(teeth: int) -> float:
    return teeth * PITCH / (2 * math.pi)


def along_x(outline_zy, x0: float, x1: float, mat: str, hard: bool = True) -> Geo:
    """Extrude a (z, y) profile along vehicle x from x0 to x1 (upright frame)."""
    pts = [(z, y) for z, y in outline_zy]
    g = extrude(pts, x1 - x0, mat, hard=hard, z0=x0)
    # extrude: 2D (a=z, b=y), depth along Z -> want depth along X: map (a, b, d) -> (d, b, a)
    g.transform(R("y", 90))
    # R(y, 90): (x, y, z) -> (z, y, -x): (a, b, d) -> (d, b, -a) -> flip z sign back
    g.transform(__import__("lib.geo", fromlist=["S"]).S(1, 1, -1))
    return g


def sprocket(teeth: int, width: float, mat: str, hub_r: float = 0.018) -> Geo:
    """Toothed sprocket in the YZ plane (axis = x), centred at the origin, spanning x 0..width."""
    r = gear_r(teeth)
    outline = gear2d(teeth, r - 0.0030, r + 0.0012, tip_frac=0.45, root_frac=0.30)
    g = extrude(outline, width, mat, holes=[circle2d(hub_r * 0.55, 16)], hard=True)
    g.transform(R("y", 90))
    return g


def block(lite: bool) -> Geo:
    g = Geo()
    prof = [(-0.125, -0.090), (-0.133, -0.020), (-0.119, 0.045), (-0.099, 0.095), (-0.099, DECK),
            (0.099, DECK), (0.099, 0.095), (0.119, 0.045), (0.133, -0.020), (0.125, -0.090)]
    g += along_x(prof, X0, X1, IRON)
    # vertical ribs on both faces
    for x in (-0.392, -0.259, -0.170, -0.082, 0.050):
        for s in (1, -1):
            g += box(0.010, 0.150, 0.020, IRON, center=(x, 0.110, s * 0.104))
    # main-bearing webs visible as ribs on the crankcase bulge
    for x in (-0.346, -0.258, -0.170, -0.082, 0.006):
        for s in (1, -1):
            g += box(0.014, 0.060, 0.012, IRON, center=(x, 0.000, s * 0.132))
    # knock-sensor boss + coolant pipe flange on the front face
    g += cylinder(0.018, 0.020, 16, IRON, axis="z").moved(-0.170, 0.140, 0.108)
    # oil-filter module (alu) with the cartridge housing
    mod = box(0.110, 0.080, 0.050, ALU, center=(-0.135, 0.035, 0.150))
    g += mod
    g += lathe([(0.0, 0.0), (0.036, 0.0), (0.036, 0.085), (0.032, 0.095), (0.0, 0.097)], 24, ALU, hard=False).moved(-0.135, 0.070, 0.165)
    # crank snout + timing sprocket (18T) in the timing-belt plane, flywheel flange at the left end
    g += lathe([(0.0, 0.0), (0.022, 0.0), (0.022, 0.050), (0.0, 0.050)], 20, DARK, axis="x", hard=False).moved(X0 - 0.050, 0, 0)
    g += sprocket(18, 0.024, DARK).moved(VH.TIMING_X - 0.012, 0, 0)
    g += lathe([(0.0, 0.0), (0.060, 0.0), (0.060, 0.008), (0.0, 0.008)], 32, IRON, axis="x", hard=False).moved(X1, 0, 0)
    return g.transform(ENGINE_M)


def head(lite: bool) -> Geo:
    g = Geo()
    prof = [(-0.108, DECK), (-0.108, 0.325), (-0.124, 0.340), (-0.124, 0.392), (-0.104, HEAD_TOP),
            (0.104, HEAD_TOP), (0.122, 0.392), (0.122, 0.342), (0.106, 0.326), (0.106, DECK)]
    g += along_x(prof, X0 - 0.010, X1, ALU)
    # exhaust-side flange lugs and intake-side ports flange (bolt bosses)
    for x in (-0.346, -0.258, -0.170, -0.082):
        g += box(0.020, 0.020, 0.012, ALU, center=(x, 0.366, -0.128))
        g += box(0.056, 0.036, 0.010, ALU, center=(x + 0.044 * 0, 0.366, 0.126))
    # cam cover (plastic) with rounded top, ribs and an oil filler cap
    cover = [(-0.094, HEAD_TOP), (-0.094, 0.445), (-0.084, 0.468), (-0.058, COVER_TOP), (0.058, COVER_TOP),
             (0.084, 0.468), (0.094, 0.445), (0.094, HEAD_TOP)]
    g += along_x(cover, X0 + 0.005, X1 - 0.010, PLASTIC, hard=False)
    for z in (-0.070, 0.070):
        g += box(X1 - X0 - 0.06, 0.010, 0.006, PLASTIC, center=((X0 + X1) / 2, 0.468, z))
    g += lathe([(0.0, 0.0), (0.024, 0.0), (0.026, 0.012), (0.022, 0.016), (0.0, 0.017)], 20, PLASTIC, hard=False).moved(-0.03, COVER_TOP - 0.004, 0.030)
    # cam sprockets (36T, 2:1 with the 18T crank) at the timing end
    for z in (-CAM_Z, CAM_Z):
        g += sprocket(36, 0.024, DARK, hub_r=0.024).moved(VH.TIMING_X - 0.012, CAM_Y, z)
    # upper timing backplate
    g += box(0.006, 0.160, 0.260, ALU, center=(X0 - 0.013, 0.330, 0.0))
    return g.transform(ENGINE_M)


def sump(lite: bool) -> Geo:
    g = Geo()
    up = [(-0.122, -0.090), (-0.126, -0.130), (-0.118, -0.172), (0.118, -0.172), (0.126, -0.130), (0.122, -0.090)]
    g += along_x(up, X0 + 0.010, X1 - 0.020, ALU)
    for x in (-0.33, -0.22, -0.11, 0.0):
        g += box(0.008, 0.060, 0.010, ALU, center=(x, -0.135, 0.128))
    pan = [(-0.112, -0.172), (-0.110, -0.235), (-0.095, -0.282), (-0.060, -0.296), (0.060, -0.296), (0.095, -0.282), (0.110, -0.235), (0.112, -0.172)]
    g += along_x(pan, X0 + 0.030, X1 - 0.050, DARK, hard=False)
    g += lathe([(0.0, 0.0), (0.012, 0.0), (0.012, 0.010), (0.0, 0.010)], 6, DARK, hard=True).transform(R("x", 180)).moved(-0.28, -0.292, 0.0)
    return g.transform(ENGINE_M)


def coils(lite: bool) -> Geo:
    g = Geo()
    for x in VH.CYL_X:
        # pencil coil body + connector head
        g += lathe([(0.0, 0.330), (0.0110, 0.330), (0.0125, 0.345), (0.0125, 0.462), (0.0150, 0.470), (0.0, 0.470)], 16, PLASTIC, hard=False).moved(x, 0, 0)
        g += box(0.030, 0.026, 0.056, PLASTIC, center=(x, 0.486, 0.012))
        g += box(0.018, 0.018, 0.020, PLASTIC, center=(x, 0.500, 0.040))
        # spark plug under the coil: insulator, hex, thread, electrode
        g += lathe([(0.0, 0.284), (0.0065, 0.284), (0.0065, 0.300)], 12, STEEL, hard=False).moved(x, 0, 0)
        g += lathe([(0.0080, 0.300), (0.0080, 0.312), (0.0, 0.312)], 6, STEEL, hard=True).moved(x, 0, 0)
        g += lathe([(0.0, 0.312), (0.0055, 0.312), (0.0060, 0.322), (0.0048, 0.332), (0.0, 0.334)], 14, CERAMIC, hard=False).moved(x, 0, 0)
        g += lathe([(0.0, 0.276), (0.0012, 0.276), (0.0012, 0.284), (0.0, 0.284)], 6, STEEL, hard=False).moved(x, 0, 0)
    return g.transform(ENGINE_M)


def mounts(lite: bool) -> dict[str, Geo]:
    out = {}
    # right: hydro mount on the rail, bracket arm down to the engine's timing end
    r = Geo()
    r += lathe([(0.0, -0.030), (0.040, -0.030), (0.046, -0.010), (0.046, 0.020), (0.036, 0.034), (0.0, 0.036)], 24, ALU, hard=False)
    r += lathe([(0.0, 0.036), (0.030, 0.036), (0.032, 0.050), (0.0, 0.052)], 20, RUBBER, hard=False)
    r += box(0.060, 0.022, 0.090, ALU, center=(0.050, -0.040, -0.010))
    r += box(0.030, 0.090, 0.040, ALU, center=(0.080, -0.080, -0.020))
    out["r"] = r.moved(-0.52, 0.82, 1.52)
    # left: gearbox mount — rubber block in an alu bracket
    l = Geo()
    l += box(0.090, 0.050, 0.100, ALU, center=(0.0, 0.0, 0.0))
    l += box(0.070, 0.030, 0.080, RUBBER, center=(0.0, 0.038, 0.0))
    l += box(0.050, 0.018, 0.120, ALU, center=(-0.030, 0.060, 0.0))
    out["l"] = l.moved(0.52, 0.74, 1.50)
    # rear torque rod ("dog bone")
    t = Geo()
    t += bushing("x", 0.024, 0.040, RUBBER, ALU, seg=18).moved(0, 0, 0.080)
    t += bushing("x", 0.018, 0.030, RUBBER, ALU, seg=16).moved(0, 0, -0.080)
    t += box(0.028, 0.030, 0.130, ALU, center=(0.0, 0.0, 0.0))
    out["rear"] = t.moved(0.05, 0.22, 1.10)
    return out


def build(ctx) -> None:
    lite = ctx.lite
    add_centered(ctx, "motor", "block", block(lite), bevel=0.003, segments=2, profile=0.6)
    add_centered(ctx, "motor", "head", head(lite), bevel=0.0025, segments=2, profile=0.6)
    add_centered(ctx, "karter-dihtunzi", "sump", sump(lite), bevel=0.003, segments=2, profile=0.6)
    add_centered(ctx, "paljenje-grejaci", "coils", coils(lite), bevel=0.0008)
    for inst, g in mounts(lite).items():
        add_centered(ctx, "nosaci-motora", inst, g, bevel=0.002)
