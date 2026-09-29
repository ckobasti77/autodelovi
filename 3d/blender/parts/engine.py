"""Motor: block (+crank sprocket, oil-filter module), head (+cam cover, cam sprockets), sump,
coils + spark plugs, engine/gearbox mounts.

Engine parts are authored in an *upright frame* (origin on the crank axis at x = 0, +Y = cylinder
axis, +Z = intake side/front) and tilted 12 deg toward the firewall with ENGINE_M.
"""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from lib.geo import Geo, R, T, box, catmull, circle2d, cylinder, extrude, gear2d, lathe, rounded_rect
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


def _hex_y(x: float, y: float, z: float, af: float = 0.011, h: float = 0.006, mat: str = STEEL) -> Geo:
    """Hex bolt head, axis along the upright-frame y (vertical)."""
    from lib.shapes import hex_nut

    return hex_nut(af, h, mat).moved(x, y, z)


def _hex_z(x: float, y: float, z: float, af: float = 0.011, h: float = 0.006, mat: str = STEEL) -> Geo:
    """Hex head facing +/-z (intake/exhaust faces of the upright frame)."""
    from lib.shapes import hex_nut

    return hex_nut(af, h, mat).transform(R("x", 90)).moved(x, y, z)


def _plug_z(x: float, y: float, z: float, r: float, depth: float, mat: str, sign: float = 1.0) -> Geo:
    """Round plug/boss on a face whose normal is +z (sign=1) or -z (sign=-1)."""
    g = lathe([(0.0, 0.0), (r, 0.0), (r, depth * 0.8), (r * 0.85, depth), (0.0, depth)], 20, mat, axis="z" if sign > 0 else "-z", hard=False)
    return g.moved(x, y, z)


def block(lite: bool) -> Geo:
    g = Geo()
    prof = [(-0.125, -0.090), (-0.133, -0.020), (-0.119, 0.045), (-0.099, 0.095), (-0.099, DECK),
            (0.099, DECK), (0.099, 0.095), (0.119, 0.045), (0.133, -0.020), (0.125, -0.090)]
    g += along_x(prof, X0, X1, IRON)
    # deck flange lip under the head gasket line
    lip = [(-0.103, DECK - 0.014), (-0.103, DECK), (0.103, DECK), (0.103, DECK - 0.014)]
    g += along_x(lip, X0 - 0.004, X1 + 0.002, IRON)
    # vertical ribs on both faces + main-bearing webs on the crankcase bulge
    for x in (-0.392, -0.259, -0.170, -0.082, 0.050):
        for s in (1, -1):
            g += box(0.010, 0.150, 0.020, IRON, center=(x, 0.110, s * 0.104))
    for x in (-0.346, -0.258, -0.170, -0.082, 0.006):
        for s in (1, -1):
            g += box(0.014, 0.060, 0.012, IRON, center=(x, 0.000, s * 0.132))
    # core (freeze) plugs between the ribs, both faces
    for x in (-0.302, -0.126, -0.038):
        for s in (1, -1):
            g += _plug_z(x, 0.170, s * 0.099, 0.017, 0.003, STEEL, s)
    # knock sensor boss with the sensor, oil pressure sender, coolant outlet flange
    g += _plug_z(-0.170, 0.140, 0.099, 0.018, 0.020, IRON)
    g += _plug_z(-0.170, 0.140, 0.119, 0.014, 0.012, PLASTIC)
    g += _plug_z(-0.020, 0.040, 0.119, 0.008, 0.016, STEEL)
    g += _hex_z(-0.020, 0.040, 0.124, af=0.017, h=0.008)
    g += box(0.050, 0.050, 0.012, IRON, center=(-0.360, 0.200, 0.105))
    g += _plug_z(-0.360, 0.200, 0.111, 0.018, 0.030, ALU)
    # engine-mount bosses at the timing end (bracket bolts)
    for y in (0.150, 0.230):
        g += _plug_z(X0 + 0.028, y, 0.099, 0.016, 0.014, IRON)
        if not lite:
            g += _hex_z(X0 + 0.028, y, 0.115, af=0.015, h=0.008)
    # dipstick tube with handle
    from lib.geo import tube

    stick = catmull([(-0.170, 0.215, 0.100), (-0.171, 0.290, 0.152), (-0.173, 0.360, 0.162), (-0.174, 0.405, 0.166)], 6)
    g += tube(stick, 0.005, 8, DARK, hard=False)
    g += lathe([(0.0, 0.0), (0.010, 0.0), (0.012, 0.006), (0.012, 0.016), (0.008, 0.022), (0.0, 0.023)], 16, PLASTIC, hard=False).moved(-0.174, 0.405, 0.166)
    # oil-filter module (alu) with the cartridge housing and hex cap
    g += box(0.110, 0.080, 0.050, ALU, center=(-0.135, 0.035, 0.150))
    g += lathe([(0.0, 0.0), (0.036, 0.0), (0.036, 0.085), (0.032, 0.095), (0.0, 0.097)], 24, ALU, hard=False).moved(-0.135, 0.070, 0.165)
    g += _hex_y(-0.135, 0.170, 0.165, af=0.030, h=0.010, mat=ALU)
    # crank snout + timing sprocket (18T) in the belt plane, flywheel flange at the left end
    g += lathe([(0.0, 0.0), (0.022, 0.0), (0.022, 0.050), (0.0, 0.050)], 20, DARK, axis="x", hard=False).moved(X0 - 0.050, 0, 0)
    g += sprocket(18, 0.024, DARK).moved(VH.TIMING_X - 0.012, 0, 0)
    g += lathe([(0.0, 0.0), (0.060, 0.0), (0.060, 0.008), (0.0, 0.008)], 32, IRON, axis="x", hard=False).moved(X1, 0, 0)
    return g.transform(ENGINE_M)


def head(lite: bool) -> Geo:
    g = Geo()
    prof = [(-0.108, DECK), (-0.108, 0.325), (-0.124, 0.340), (-0.124, 0.392), (-0.104, HEAD_TOP),
            (0.104, HEAD_TOP), (0.122, 0.392), (0.122, 0.342), (0.106, 0.326), (0.106, DECK)]
    g += along_x(prof, X0 - 0.010, X1, ALU)
    # intake ports (+z face) and exhaust ports (-z face): raised flanges with a dark port opening,
    # two studs with nuts each
    for x in VH.CYL_X:
        for s, zf in ((1, 0.122), (-1, -0.124)):
            flange = extrude(rounded_rect(0.056, 0.040, 0.012, 3), 0.008, ALU, holes=[rounded_rect(0.036, 0.024, 0.009, 3)], z0=0.0)
            if s < 0:
                flange.transform(R("y", 180))
            g += flange.moved(x, 0.366, zf)
            port = extrude(rounded_rect(0.036, 0.024, 0.009, 3), 0.004, DARK, z0=-0.004)
            if s < 0:
                port.transform(R("y", 180))
            g += port.moved(x, 0.366, zf + s * 0.001)
            if not lite:
                for dx in (-0.034, 0.034):
                    g += cylinder(0.0035, 0.016, 8, STEEL, axis="z", center=False).transform(R("x", 0 if s > 0 else 180)).moved(x + dx, 0.366, zf)
                    g += _hex_z(x + dx, 0.366, zf + s * 0.012, af=0.010, h=0.006)
    # cam cover (plastic) with rounded top, ribs, oil filler cap, coil wells and a PCV valve
    cover = [(-0.094, HEAD_TOP), (-0.094, 0.445), (-0.084, 0.468), (-0.058, COVER_TOP), (0.058, COVER_TOP),
             (0.084, 0.468), (0.094, 0.445), (0.094, HEAD_TOP)]
    g += along_x(cover, X0 + 0.005, X1 - 0.010, PLASTIC, hard=False)
    flange_c = [(-0.101, HEAD_TOP), (-0.101, HEAD_TOP + 0.008), (0.101, HEAD_TOP + 0.008), (0.101, HEAD_TOP)]
    g += along_x(flange_c, X0 + 0.001, X1 - 0.006, PLASTIC)
    for z in (-0.070, 0.070):
        g += box(X1 - X0 - 0.06, 0.010, 0.006, PLASTIC, center=((X0 + X1) / 2, 0.468, z))
    g += lathe([(0.0, 0.0), (0.024, 0.0), (0.026, 0.012), (0.022, 0.016), (0.0, 0.017)], 20, PLASTIC, hard=False).moved(-0.03, COVER_TOP - 0.004, 0.030)
    for x in VH.CYL_X:
        g += lathe([(0.0150, 0.0), (0.0215, 0.0), (0.0215, 0.006), (0.0150, 0.006), (0.0150, 0.0)], 20, PLASTIC, hard=False).moved(x, COVER_TOP - 0.002, 0.0)
    g += cylinder(0.009, 0.020, 12, PLASTIC, axis="y", center=False).moved(0.020, COVER_TOP - 0.004, -0.045)
    g += cylinder(0.005, 0.030, 8, PLASTIC, axis="z", center=False).transform(R("x", 180)).moved(0.020, COVER_TOP + 0.010, -0.045)
    # cam cover bolts along both flange edges
    if not lite:
        n = 7
        for k in range(n):
            x = X0 + 0.030 + (X1 - X0 - 0.070) * k / (n - 1)
            for z in (-0.098, 0.098):
                g += _hex_y(x, HEAD_TOP + 0.011, z, af=0.009, h=0.006)
    # cam sprockets (36T, 2:1 with the 18T crank) at the timing end + cam position sensor
    for z in (-CAM_Z, CAM_Z):
        g += sprocket(36, 0.024, DARK, hub_r=0.024).moved(VH.TIMING_X - 0.012, CAM_Y, z)
    g += box(0.024, 0.022, 0.030, PLASTIC, center=(X0 + 0.020, 0.380, 0.112))
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
    # rail flange between block and sump, pan flange, ribs underneath, bolts
    rail = [(-0.130, -0.094), (-0.130, -0.086), (0.130, -0.086), (0.130, -0.094)]
    g += along_x(rail, X0 + 0.004, X1 - 0.014, ALU)
    pan_fl = [(-0.120, -0.176), (-0.120, -0.168), (0.120, -0.168), (0.120, -0.176)]
    g += along_x(pan_fl, X0 + 0.024, X1 - 0.044, DARK)
    for x in (-0.33, -0.25, -0.17, -0.09):
        g += box(0.006, 0.040, 0.030, ALU, center=(x, -0.150, 0.110))
    if not lite:
        n = 8
        for k in range(n):
            x = X0 + 0.040 + (X1 - X0 - 0.110) * k / (n - 1)
            for z in (-0.114, 0.114):
                g += _hex_y(x, -0.182, z, af=0.009, h=0.006)
        g += _hex_y(-0.28, -0.305, 0.0, af=0.019, h=0.010)
    g += lathe([(0.0, 0.0), (0.020, 0.0), (0.020, 0.012), (0.0, 0.012)], 20, PLASTIC, hard=False).transform(R("x", 180)).moved(-0.14, -0.296, 0.020)
    g += box(0.022, 0.014, 0.018, PLASTIC, center=(-0.14, -0.315, 0.036))
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
    # bracket: arm inboard at the mount base, ahead of the timing belt, down onto the block front
    r += box(0.150, 0.030, 0.050, ALU, center=(0.090, -0.040, -0.012))
    r += box(0.040, 0.090, 0.022, ALU, center=(0.160, -0.090, -0.026))
    if not lite:
        from lib.shapes import hex_nut

        for dx in (0.040, 0.120):
            r += hex_nut(0.014, 0.008, STEEL).moved(dx, -0.021, -0.012)
        for dy in (-0.120, -0.060):
            r += hex_nut(0.014, 0.008, STEEL).transform(R("x", 90)).moved(0.160, dy, -0.012)
        r += hex_nut(0.020, 0.012, STEEL).moved(0.0, 0.058, 0.0)
    out["r"] = r.moved(-0.53, 0.83, 1.60)
    # left: gearbox mount — rubber block in an alu bracket
    l = Geo()
    l += box(0.090, 0.050, 0.100, ALU, center=(0.0, 0.0, 0.0))
    l += box(0.070, 0.030, 0.080, RUBBER, center=(0.0, 0.038, 0.0))
    l += box(0.050, 0.018, 0.120, ALU, center=(-0.030, 0.060, 0.0))
    if not lite:
        from lib.shapes import hex_nut

        for dz in (-0.040, 0.040):
            l += hex_nut(0.014, 0.008, STEEL).moved(-0.030, 0.073, dz)
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
