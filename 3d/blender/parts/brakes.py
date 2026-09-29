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


def caliper(front: bool, lite: bool) -> Geo:
    """Floating caliper: one C-section casting swept along the disc arc + piston boss, carrier, pins."""
    g = Geo()
    th = THETA_CAL
    t_disc = (VH.DISC_F_T if front else VH.DISC_R_T) / 2
    r_disc = VH.DISC_F_R if front else VH.DISC_R_R
    r_pad = 0.121 if front else 0.114
    pr = 0.034 if front else 0.029
    ib = -(t_disc + 0.0165)  # inboard pad backing face
    ob = t_disc + 0.0165  # outboard pad backing face
    top = (r_disc + 0.034) - r_pad  # bridge top (radial, relative to r_pad)
    und = (r_disc + 0.006) - r_pad  # bridge underside clearance over the disc edge
    back = ib - 0.046
    # C cross-section in (axial h, radial dr); CCW
    prof = [
        (ib, -0.032), (ib, und - 0.002), (ib + 0.006, und + 0.004), (ob - 0.006, und + 0.004), (ob, und - 0.002),
        (ob, -0.026), (ob + 0.004, -0.030), (ob + 0.014, -0.030), (ob + 0.018, -0.024), (ob + 0.018, top - 0.012),
        (ob + 0.012, top - 0.003), (ob, top), (back + 0.012, top), (back + 0.002, top - 0.012), (back, top - 0.030),
        (back, -0.018), (back + 0.006, -0.032), (back + 0.016, -0.036),
    ]
    span = 25 if front else 23
    n = 8 if lite else 12
    path = []
    for i in range(n + 1):
        a = th - span + 2 * span * i / n
        x, z = polar(r_pad, a)
        path.append((x, 0.0, z))
    body = sweep(path, [(h, dr) for h, dr in prof], CAL, up_hint=(0, 1, 0), hard=True, cap_cdt=True)
    # sweep frames: normal = +Y (axis), binormal = t x n -> make sure dr points outward
    probe = body.verts[len(prof) * (n // 2) + 11]
    mid = Vector(polar(r_pad, th) + (0.0,))
    g += body
    # piston boss on the inboard back
    px, pz = polar(r_pad, th)
    boss = lathe([(0.0, 0.0), (pr + 0.004, 0.0), (pr + 0.004, -0.012), (pr, -0.020), (pr - 0.012, -0.026), (0.0, -0.027)], 20 if lite else 32, CAL, hard=False)
    g += boss.moved(px, back + 0.004, pz)
    # carrier arms at both ends, reaching over the disc edge
    for a in (th - span - 4, th + span + 4):
        arm = band2d(r_pad - 0.012, r_disc + 0.014, a - 3.0, a + 3.0, 3)
        g += from_extrude(extrude(arm, (ob + 0.006) - (ib - 0.012), CAL, z0=ib - 0.012))
    # guide pins with rubber boots (inboard)
    for a in (th - span - 5, th + span + 5):
        cx, cz = polar(r_disc + 0.012, a)
        boot = lathe([(0.0, 0.0), (0.0090, 0.0), (0.0110, -0.006), (0.0088, -0.012), (0.0110, -0.018), (0.0080, -0.024), (0.0, -0.025)], 14, RUBBER, hard=False)
        g += boot.moved(cx, ib - 0.018, cz)
    # bleed nipple (radially outward, top of the housing) + banjo fitting
    bx, bz = polar(r_pad + 0.036, th + 9)
    nip = cylinder(0.0042, 0.020, 10, CAL, axis="x", hard=False)
    g += nip.transform(R("y", -math.degrees(math.atan2(bz, bx)))).moved(bx, back + 0.018, bz)
    jx, jz = polar(r_pad + 0.030, th - 10)
    g += box(0.016, 0.020, 0.016, CAL, center=(jx, back + 0.014, jz))
    if not front:
        # EPB actuator: motor can + gear housing behind the piston
        mot = lathe([(0.0, 0.0), (0.021, 0.0), (0.021, -0.058), (0.017, -0.066), (0.0, -0.068)], 20, CAL, hard=False)
        mx, mz = polar(r_pad - 0.020, th + 14)
        g += mot.moved(mx, back - 0.004, mz)
        g += box(0.040, 0.020, 0.050, CAL, center=(px - 0.004, back - 0.010, pz + 0.004))
    _ = (probe, mid)
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
