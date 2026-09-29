"""Kočnice + ležaj/glavčina: discs, pads, floating calipers (rear with EPB), ABS sensors, hubs.

All authored in the corner axis frame (lib.corner): +Y outboard along the axle, radial plane
(X = down, Z = front). The axis-frame origin sits on the axle at the disc ring centre plane.
"""

from __future__ import annotations

import math

from config import vehicle as VH
from lib.corner import band2d, circle_holes, from_extrude, place, polar, rh_ccw, theta_of
from mathutils import Vector

from lib.geo import Geo, R, T, box, circle2d, cylinder, extrude, lathe, radial, sweep, tube, catmull

IRON = "mat_cast_iron"
STEEL = "mat_machined_steel"
DARK = "mat_steel_dark"
RUBBER = "mat_rubber"
CAL = "mat_caliper"
PLASTIC = "mat_plastic_black"

# disc ring centre offset from the wheel plane (axial, outboard +): hub face = wheel plane + ET
HAT = 0.045
RING_H_F = VH.ET - HAT  # +0.001
RING_H_R = VH.ET - HAT
THETA_CAL = theta_of(0.259, -0.966)  # caliper at the trailing edge, 15 deg above horizontal


def lathe_closed(prof, seg, mat, hard=False, **kw):
    p = rh_ccw(prof)
    return lathe(p + [p[0]], seg, mat, hard=hard, **kw)


# --------------------------------------------------------------------------- discs


def disc(front: bool, lite: bool) -> Geo:
    seg = 44 if lite else 64
    g = Geo()
    R_o = VH.DISC_F_R if front else VH.DISC_R_R
    if front:
        t2 = VH.DISC_F_T / 2
        for sgn in (1, -1):
            ring = [(0.093, sgn * 0.0035), (R_o - 0.0008, sgn * 0.0035), (R_o, sgn * 0.0043), (R_o, sgn * (t2 - 0.0008)), (R_o - 0.0008, sgn * t2), (0.094, sgn * t2), (0.093, sgn * (t2 - 0.001))]
            g += lathe_closed(ring, seg, STEEL, uv_u=8, uv_v=50)
        vane = box(0.042, 0.0074, 0.0042, IRON, center=(0.120, 0.0, 0.0), hard=False)
        g += radial(vane, 18 if lite else 30, "y")
        plate_top = t2
    else:
        t2 = VH.DISC_R_T / 2
        ring = [(0.070, -t2), (R_o - 0.0008, -t2), (R_o, -t2 + 0.0008), (R_o, t2 - 0.0008), (R_o - 0.0008, t2), (0.072, t2), (0.070, t2 - 0.001)]
        g += lathe_closed(ring, seg, STEEL, uv_u=8, uv_v=50)
        plate_top = t2
    # hat wall joining the outboard ring, heat groove near the ring
    top = HAT
    r_in = 0.093 if front else 0.070
    j = plate_top
    r_join = 0.0945 if front else 0.0900
    hat = [(0.0795, top - 0.006), (0.0815, top), (0.0870, top - 0.004), (0.0870, j + 0.009), (0.0850, j + 0.006), (0.0870, j + 0.003), (r_join, j - 0.0005), (r_join, j - 0.002), (0.0795, j - 0.002)]
    _ = r_in
    g += lathe_closed(hat, seg, IRON)
    # hat top with 5 wheel-bolt holes + centre bore (CDT, no booleans)
    holes = circle_holes(0.056, 0.0075, 5, phase_deg=36, seg=14)
    holes.append(circle2d(0.0290, 32))
    g += from_extrude(extrude(circle2d(0.0805, seg), 0.0065, IRON, holes=holes, z0=top - 0.0065, hard=False))
    return g


# --------------------------------------------------------------------------- pads


def pad_pair(front: bool) -> Geo:
    g = Geo()
    th = THETA_CAL
    span_b, span_f = (27, 23) if front else (24, 20)
    r_in, r_out = (0.098, 0.143) if front else (0.092, 0.135)
    t_disc = (VH.DISC_F_T if front else VH.DISC_R_T) / 2
    for sgn in (1, -1):
        # friction block, split by a 3 mm radial slot, chamfered ends
        for a0, a1 in ((th - span_f, th - 1.3), (th + 1.3, th + span_f)):
            out = band2d(r_in + 0.004, r_out - 0.003, a0, a1, 8)
            fb = from_extrude(extrude(out, 0.0105, RUBBER))
            fb.transform(T(0, sgn * (t_disc + 0.0006) if sgn > 0 else 0, 0))
            if sgn < 0:
                fb.transform(R("y", 0))
                fb.transform(T(0, -(t_disc + 0.0006) - 0.0105, 0))
            g += fb
        # steel backing plate with abutment ears
        bp = band2d(r_in, r_out, th - span_b, th + span_b, 10)
        back = from_extrude(extrude(bp, 0.0050, DARK))
        if sgn > 0:
            back.transform(T(0, t_disc + 0.0006 + 0.0105, 0))
        else:
            back.transform(T(0, -(t_disc + 0.0006 + 0.0105 + 0.005), 0))
        g += back
    return g


# --------------------------------------------------------------------------- calipers


def _slab(r0: float, r1: float, a0: float, a1: float, y0: float, y1: float, mat: str, n: int = 8, holes=()) -> Geo:
    """Arc band in the radial plane (r0..r1, a0..a1 deg) extruded along the axle from y0 to y1."""
    return from_extrude(extrude(band2d(r0, r1, a0, a1, n), y1 - y0, mat, z0=y0, holes=list(holes)))


def _axial(profile, seg: int, mat: str, x: float, z: float, y: float, inboard: bool = True) -> Geo:
    """Lathe along the axle at radial-plane point (x, z), starting at axial y, growing in/outboard."""
    return lathe(profile, seg, mat, axis="-y" if inboard else "y", hard=False).moved(x, y, z)


def caliper(front: bool, lite: bool) -> Geo:
    """Floating caliper + carrier: inboard piston bore (piston and dust boot visible through the
    pad window), two bridge arms over the disc edge, outboard fingers, carrier bracket straddling
    the disc, guide pins with boots and bolt heads, bleed nipple with cap, banjo hose fitting."""
    from lib.shapes import hex_nut

    g = Geo()
    th = THETA_CAL
    t_disc = (VH.DISC_F_T if front else VH.DISC_R_T) / 2
    r_disc = VH.DISC_F_R if front else VH.DISC_R_R
    r_pad = 0.121 if front else 0.114
    pr = 0.034 if front else 0.029
    span = 25 if front else 23
    ib = -(t_disc + 0.0165)
    ob = t_disc + 0.0165
    top = r_disc + 0.028
    seg = 24 if lite else 40
    px, pz = polar(r_pad, th)
    # inboard housing slab with the piston bore, piston cylinder with a domed back
    g += _slab(r_pad - 0.030, top, th - span - 3, th + span + 3, ib - 0.022, ib, CAL, holes=[circle2d(pr + 0.0015, 28, px, -pz)])
    g += _axial([(0.0, 0.0), (pr + 0.011, 0.0), (pr + 0.011, 0.020), (pr + 0.007, 0.028), (pr - 0.006, 0.032), (0.0, 0.033)], seg, CAL, px, pz, ib - 0.022)
    # piston face and dust boot, recessed in the bore (seen through the pad window)
    g += _axial([(0.0, 0.0), (pr - 0.001, 0.0), (pr - 0.001, 0.004), (0.0, 0.004)], seg, STEEL, px, pz, ib - 0.0055, inboard=False)
    g += _axial([(pr - 0.001, 0.0), (pr + 0.0015, 0.0), (pr + 0.0015, 0.004), (pr - 0.001, 0.004), (pr - 0.001, 0.0)], seg, RUBBER, px, pz, ib - 0.0055, inboard=False)
    # bridge arms over the disc edge (window between them shows the pads)
    for a0, a1 in ((th - span - 3, th - span + 6), (th + span - 6, th + span + 3)):
        g += _slab(r_disc + 0.004, top, a0, a1, ib - 0.004, ob + 0.004, CAL, n=5)
    # outboard fingers: a top band and two lobes behind the outboard pad
    g += _slab(r_disc - 0.006, top, th - span - 3, th + span + 3, ob, ob + 0.013, CAL)
    for a0, a1 in ((th - span - 1, th - 5), (th + 5, th + span + 1)):
        g += _slab(r_pad - 0.024, r_disc - 0.004, a0, a1, ob, ob + 0.013, CAL, n=5)
    # guide-pin lugs on the inboard side: arm, lug, boot, bolt head
    for sgn in (-1, 1):
        a_lug = th + sgn * (span + 10)
        g += _slab(r_disc - 0.004, top - 0.004, *sorted((th + sgn * (span + 3), a_lug + sgn * 2)), ib - 0.020, ib - 0.002, CAL, n=4)
        lx, lz = polar(r_disc + 0.010, a_lug)
        g += _axial([(0.0, 0.0), (0.012, 0.0), (0.012, 0.024), (0.0, 0.024)], 20, CAL, lx, lz, ib - 0.000)
        g += _axial([(0.0085, 0.0), (0.0105, 0.002), (0.0090, 0.005), (0.0105, 0.008), (0.0085, 0.011), (0.0, 0.011)], 16, RUBBER, lx, lz, ib, inboard=False)
        if not lite:
            nut = hex_nut(0.013, 0.007, STEEL)
            g += nut.transform(R("x", 180)).moved(lx, ib - 0.0275, lz)
    # carrier bracket (steel): arms straddling the disc edge + inboard mounting web with bolts
    for sgn in (-1, 1):
        a0, a1 = sorted((th + sgn * (span + 3.5), th + sgn * (span + 7.5)))
        g += _slab(r_disc + 0.004, r_disc + 0.017, a0, a1, ib - 0.010, ob + 0.006, DARK, n=3)
        g += _slab(r_pad - 0.016, r_disc + 0.004, a0, a1, ib - 0.010, -t_disc - 0.0015, DARK, n=3)
        g += _slab(r_pad - 0.016, r_disc + 0.004, a0, a1, t_disc + 0.0015, ob + 0.006, DARK, n=3)
    g += _slab(r_pad - 0.046, r_pad - 0.016, th - span - 7.5, th + span + 7.5, ib - 0.018, ib - 0.010, DARK, n=10)
    for sgn in (-1, 1):
        bx_, bz_ = polar(r_pad - 0.031, th + sgn * (span + 3))
        g += _axial([(0.0, 0.0), (0.0095, 0.0), (0.0095, 0.012), (0.0, 0.012)], 16, DARK, bx_, bz_, ib - 0.018)
        if not lite:
            g += hex_nut(0.015, 0.008, STEEL).transform(R("x", 180)).moved(bx_, ib - 0.034, bz_)
    # bleed nipple with rubber cap (radially outward on top of the bore) and banjo + hose stub
    nx, nz = polar(r_pad + pr * 0.62, th + 10)
    y_back = ib - 0.050
    g += _axial([(0.0, 0.0), (0.0060, 0.0), (0.0060, 0.006), (0.0, 0.006)], 6, STEEL, nx, nz, y_back)
    g += _axial([(0.0, 0.0), (0.0035, 0.0), (0.0035, 0.010), (0.0, 0.010)], 10, STEEL, nx, nz, y_back - 0.006)
    g += _axial([(0.0, 0.0), (0.0050, 0.0), (0.0050, 0.007), (0.0030, 0.009), (0.0, 0.009)], 12, RUBBER, nx, nz, y_back - 0.014)
    jx, jz = polar(r_pad + 0.026, th - 12)
    g += box(0.016, 0.018, 0.016, STEEL, center=(jx, ib - 0.040, jz))
    g += _axial([(0.0, 0.0), (0.0075, 0.0), (0.0075, 0.006), (0.0, 0.006)], 6, STEEL, jx, jz, ib - 0.049)
    hose = catmull([(jx, ib - 0.046, jz), (jx - 0.010, ib - 0.070, jz - 0.020), (jx - 0.030, ib - 0.090, jz - 0.050)], 6)
    g += tube(hose, 0.0055, 10, RUBBER)
    if not front:
        # EPB actuator: motor can + gear housing on the inboard back
        mot = lathe([(0.0, 0.0), (0.021, 0.0), (0.021, -0.032), (0.017, -0.038), (0.0, -0.040)], 20, CAL, hard=False)
        mx, mz = polar(r_pad - 0.020, th + 14)
        g += mot.moved(mx, ib - 0.058, mz)
        g += box(0.040, 0.020, 0.050, CAL, center=(px - 0.004, ib - 0.066, pz + 0.004))
        g += box(0.016, 0.012, 0.020, PLASTIC, center=(mx + 0.012, ib - 0.084, mz))
    return g


# --------------------------------------------------------------------------- ABS sensor


def abs_sensor(front: bool) -> Geo:
    g = Geo()
    body = lathe([(0.0, 0.0), (0.0085, 0.0), (0.0085, 0.022), (0.0100, 0.024), (0.0100, 0.032), (0.0060, 0.036), (0.0, 0.036)], 14, PLASTIC, hard=False)
    g += body.transform(R("x", 180))  # point inboard->outboard toward the encoder ring
    ear = extrude([(-0.006, -0.012), (0.024, -0.010), (0.028, 0.0), (0.024, 0.010), (-0.006, 0.012)], 0.004, PLASTIC, holes=[circle2d(0.0035, 10, 0.020, 0.0)])
    g += from_extrude(ear).moved(0, -0.016, 0)
    # cable leaving upward and inboard
    path = catmull([(0.0, -0.036, 0.0), (-0.02, -0.06, 0.0), (-0.06, -0.075, -0.01), (-0.12, -0.09, -0.02), (-0.16, -0.12, -0.02)], 6)
    g += tube(path, 0.0028, 6, PLASTIC)
    return g


# --------------------------------------------------------------------------- hub + bearing


def hub(front: bool, lite: bool) -> Geo:
    seg = 32 if lite else 48
    g = Geo()
    face = HAT - (HAT - VH.ET) - 0.0065  # hub flange outer face (disc hat inner face)
    face = HAT - 0.0065
    holes = circle_holes(0.056, 0.0066, 5, phase_deg=36, seg=12)
    g += from_extrude(extrude(circle2d(0.067, seg), 0.009, STEEL, holes=holes, z0=face - 0.009, hard=False))
    spig = [(0.0, face), (0.0285, face), (0.0285, face + 0.010), (0.0270, face + 0.0115), (0.0, face + 0.0115)]
    g += lathe(spig, seg, STEEL, hard=False)
    brg = [(0.0, face - 0.009), (0.030, face - 0.009), (0.036, face - 0.016), (0.041, face - 0.020), (0.041, face - 0.060), (0.036, face - 0.064), (0.0, face - 0.064)]
    g += lathe(brg, seg, STEEL, hard=False)
    enc = [(0.030, face - 0.064), (0.043, face - 0.064), (0.043, face - 0.068), (0.030, face - 0.068), (0.030, face - 0.064)]
    g += lathe(enc, seg, STEEL, hard=False)
    # three-ear mounting flange
    lobes = []
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        lobes.append(circle2d(0.012, 12, 0.056 * math.cos(a), 0.056 * math.sin(a)))
    fl = extrude(circle2d(0.046, 36), 0.007, STEEL, z0=face - 0.035)
    g += from_extrude(fl)
    for lb in lobes:
        g += from_extrude(extrude(lb, 0.007, STEEL, z0=face - 0.035))
    return g


# --------------------------------------------------------------------------- build


def build(ctx) -> None:
    lite = ctx.lite
    shapes = {
        "disc_f": disc(True, lite),
        "disc_r": disc(False, lite),
        "pads_f": pad_pair(True),
        "pads_r": pad_pair(False),
        "cal_f": caliper(True, lite),
        "cal_r": caliper(False, lite),
        "abs_f": abs_sensor(True),
        "abs_r": abs_sensor(False),
        "hub_f": hub(True, lite),
        "hub_r": hub(False, lite),
    }
    for corner in ("fl", "fr", "rl", "rr"):
        front = corner[0] == "f"
        left = corner[1] == "l"
        k = "f" if front else "r"
        ring_h = RING_H_F if front else RING_H_R
        xw = VH.X_WHEEL_F if front else VH.X_WHEEL_R
        za = VH.Z_FRONT_AXLE if front else VH.Z_REAR_AXLE
        s = 1 if left else -1

        def piv(h, y=0.0, z=0.0):
            return (s * (xw + h), VH.WHEEL_Y + y, za + z)

        # discs — shared per axle (yaw for the right side)
        d_piv = piv(ring_h)
        ctx.add_part("kocioni-diskovi", corner, d_piv, place(shapes[f"disc_{k}"], f"{k}l", ring_h, piv_left(front, ring_h)), bevel=0.0006, shared_key=f"disc_{k}", yaw180=not left)
        # pads — shared per axle; pivot at the pad-pair centre
        r_pad = 0.121 if front else 0.114
        px, pz = polar(r_pad, THETA_CAL)
        p_off = (-px, pz)  # axis-frame X = down
        pad_piv = piv(ring_h, p_off[0], p_off[1])
        ctx.add_part("kocione-plocice", corner, pad_piv, place(shapes[f"pads_{k}"], f"{k}l", ring_h, piv_left(front, ring_h, p_off[0], p_off[1])), bevel=0.0005, shared_key=f"pads_{k}", yaw180=False)
        # calipers — mirrored meshes (piston housing inboard, bleed nipple up)
        cal_piv = piv(ring_h - 0.012, p_off[0] + 0.012, p_off[1])
        ctx.add_part("kocione-celjusti", corner, cal_piv, place(shapes[f"cal_{k}"], corner, ring_h, cal_piv), bevel=0.0012, segments=2, profile=0.6)
        # ABS sensor on the knuckle/carrier, top-rear of the bearing, pointing at the encoder
        ax, az_ = polar(0.052, theta_of(0.55, -0.83))
        abs_piv = piv(ring_h + HAT - 0.0065 - 0.070, -ax, az_)
        ctx.add_part("abs-senzori", corner, abs_piv, place(shapes[f"abs_{k}"].copy().moved(ax, 0, az_), corner, ring_h + HAT - 0.0065 - 0.070, abs_piv), bevel=0.0006)
        # hub + bearing — shared per axle
        hub_piv = piv(ring_h + 0.004)
        ctx.add_part("lezaj-glavcina", corner, hub_piv, place(shapes[f"hub_{k}"], f"{k}l", ring_h, piv_left(front, ring_h + 0.004)), bevel=0.0006, shared_key=f"hub_{k}", yaw180=not left)


def piv_left(front: bool, h: float, y: float = 0.0, z: float = 0.0):
    xw = VH.X_WHEEL_F if front else VH.X_WHEEL_R
    za = VH.Z_FRONT_AXLE if front else VH.Z_REAR_AXLE
    return (xw + h, VH.WHEEL_Y + y, za + z)
