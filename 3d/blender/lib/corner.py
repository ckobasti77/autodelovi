"""Corner frames: wheels, discs, pads, calipers, hubs are authored in an *axis frame*.

Axis frame: +Y = wheel axis pointing outboard, radial plane = (X, Z) where X = vehicle down
(X -> -y) and Z = vehicle front. `place()` converts to vehicle-local geometry for the left side,
mirrors for the right side and offsets to the part pivot.
"""

from __future__ import annotations

import math

from mathutils import Vector

from config import vehicle as VH
from .geo import Geo, S, T, axis_to, ccw


def rh_ccw(profile):
    """Closed (r, h) profile oriented counter-clockwise (r = x, h = y) -> outward lathe normals."""
    return ccw(profile)


def polar(r: float, theta_deg: float) -> tuple[float, float]:
    """Point in the radial plane of the axis frame: returns (X, Z)."""
    t = math.radians(theta_deg)
    return (r * math.cos(t), r * math.sin(t))


def theta_of(y_up: float, z_front: float) -> float:
    """Axis-frame angle for a vehicle direction (up, front) in the wheel plane."""
    return math.degrees(math.atan2(z_front, -y_up))


def band2d(r0: float, r1: float, t0: float, t1: float, n: int = 12) -> list[tuple[float, float]]:
    """Arc band outline for extrude(): 2D (a, b) = (X, -Z) so extrude + Rx(-90) lands in (X, Z)."""
    pts = []
    for i in range(n + 1):
        x, z = polar(r1, t0 + (t1 - t0) * i / n)
        pts.append((x, -z))
    for i in range(n + 1):
        x, z = polar(r0, t1 - (t1 - t0) * i / n)
        pts.append((x, -z))
    return pts


def circle_holes(r_pcd: float, r_hole: float, count: int, phase_deg: float = 0.0, seg: int = 12):
    holes = []
    for k in range(count):
        cx, cz = polar(r_pcd, phase_deg + 360.0 * k / count)
        holes.append([(cx + r_hole * math.cos(2 * math.pi * i / seg), -(cz) + r_hole * math.sin(2 * math.pi * i / seg)) for i in range(seg)])
    return holes


def from_extrude(g: Geo) -> Geo:
    """extrude() builds in XY with depth along +Z; rotate so XY -> radial plane, depth -> +Y."""
    from .geo import R

    return g.transform(R("x", -90))


CORNERS = {
    # name: (front?, left?)
    "fl": (True, True),
    "fr": (True, False),
    "rl": (False, True),
    "rr": (False, False),
}


def axle(corner: str) -> tuple[float, float]:
    """(x_wheel_plane_abs, z_axle) for a corner."""
    front = CORNERS[corner][0]
    return (VH.X_WHEEL_F if front else VH.X_WHEEL_R, VH.Z_FRONT_AXLE if front else VH.Z_REAR_AXLE)


def place(g_axis: Geo, corner: str, origin_h: float, pivot) -> Geo:
    """Axis-frame geo (origin = wheel-plane centre on the axle) -> vehicle-local geo at `pivot`.

    origin_h: axial position (outboard +) of the axis-frame origin relative to the wheel centre plane.
    """
    front, left = CORNERS[corner]
    xw, za = axle(corner)
    g = g_axis.copy().transform(axis_to("x"))
    g.transform(T(origin_h, 0, 0))
    if not left:
        g.transform(S(-1, 1, 1))
    origin = Vector((xw if left else -xw, VH.WHEEL_Y, za))
    off = origin - Vector(pivot)
    return g.transform(T(off.x, off.y, off.z))


def corner_point(corner: str, h: float, y: float = 0.0, z: float = 0.0) -> tuple[float, float, float]:
    """Vehicle position of a point at axial offset h (outboard +) from the wheel plane centre."""
    front, left = CORNERS[corner]
    xw, za = axle(corner)
    x = (xw + h) if left else -(xw + h)
    return (x, VH.WHEEL_Y + y, za + z)
