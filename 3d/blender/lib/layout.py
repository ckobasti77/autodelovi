"""Explode data, node bounds and the camera framing solver (vehicle/glTF space)."""

from __future__ import annotations

import json
import math

import bpy
from mathutils import Vector

from . import scene
from .scene import to_vehicle

TUNED = scene.BUILD / "explode.tuned.json"


def explode_table(use_tuned: bool = True) -> dict[str, tuple[tuple[float, float, float], float, float]]:
    """Explode intent (config/explode.py), overridden by 3d/build/explode.tuned.json unless
    use_tuned is False (the solver always starts from the intent)."""
    from config.explode import E

    table = {k: (v[0], v[1], v[2]) for k, v in E.items()}
    if use_tuned and TUNED.exists():
        with open(TUNED, encoding="utf-8") as f:
            tuned = json.load(f)
        for k, v in tuned.items():
            table[k] = (tuple(v["dir"]), float(v["dist"]), float(v["order"]))
    out = {}
    for k, (d, dist, order) in table.items():
        vec = Vector(d)
        if vec.length < 1e-9:
            vec = Vector((0, 1, 0))
        vec.normalize()
        out[k] = ((round(vec.x, 5), round(vec.y, 5), round(vec.z, 5)), round(float(dist), 4), round(float(order), 4))
    return out


def mesh_points(obj: bpy.types.Object) -> list[Vector]:
    """World-space vertices of a mesh object, returned in vehicle coordinates."""
    mw = obj.matrix_world
    return [Vector(to_vehicle(mw @ v.co)) for v in obj.data.vertices]


def node_points(node: bpy.types.Object) -> list[Vector]:
    pts: list[Vector] = []
    for o in [node] + list(node.children_recursive):
        if o.type == "MESH":
            pts.extend(mesh_points(o))
    return pts


def bbox(points: list[Vector]) -> tuple[Vector, Vector]:
    if not points:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    mn = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    mx = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return mn, mx


def corners(mn: Vector, mx: Vector) -> list[Vector]:
    return [Vector((x, y, z)) for x in (mn.x, mx.x) for y in (mn.y, mx.y) for z in (mn.z, mx.z)]


def hull_sample(points: list[Vector], k: int = 64) -> list[Vector]:
    if len(points) <= k:
        return points
    step = max(1, len(points) // k)
    return points[::step]


# --------------------------------------------------------------------------- camera


def cam_dir(az_deg: float, el_deg: float) -> Vector:
    """Unit vector from target to camera. az: 0 = front (+z), 90 = left (+x)."""
    az, el = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)))


def project(points, pos: Vector, target: Vector, fov_deg: float, aspect: float):
    f = (target - pos).normalized()
    r = f.cross(Vector((0, 1, 0))).normalized()
    u = r.cross(f)
    t = math.tan(math.radians(fov_deg) / 2)
    out = []
    for p in points:
        v = p - pos
        z = v.dot(f)
        if z <= 1e-4:
            z = 1e-4
        nx = v.dot(r) / (z * t * aspect)
        ny = v.dot(u) / (z * t)
        out.append(((nx + 1) / 2, (1 - ny) / 2))  # screen fractions, y from top
    return out


def screen_box(points, pos, target, fov, aspect):
    s = project(points, pos, target, fov, aspect)
    xs = [p[0] for p in s]
    ys = [p[1] for p in s]
    return min(xs), max(xs), min(ys), max(ys)


def solve_camera(points, az, el, fov, aspect, *, box=None, width=None, cx=None, cy=None, iters=60):
    """Find (position, target) so the projected points fill a screen box or a width at a centre.

    box = (x0, x1, y0, y1) fit inside (limiting dimension touches), or width + (cx, cy).
    """
    d = cam_dir(az, el)
    mn, mx = bbox(points)
    target = (mn + mx) / 2
    dist = (mx - mn).length * 2.5
    fwd = -d
    right = fwd.cross(Vector((0, 1, 0))).normalized()
    up = right.cross(fwd)
    for _ in range(iters):
        pos = target + d * dist
        x0, x1, y0, y1 = screen_box(points, pos, target, fov, aspect)
        w, h = x1 - x0, y1 - y0
        if box is not None:
            bx0, bx1, by0, by1 = box
            scale = max(w / (bx1 - bx0), h / (by1 - by0))
            tcx, tcy = (bx0 + bx1) / 2, (by0 + by1) / 2
        else:
            scale = w / width
            tcx, tcy = cx, cy
        dist *= scale ** 0.9
        ccx, ccy = (x0 + x1) / 2, (y0 + y1) / 2
        # move the target so the projected centre shifts toward (tcx, tcy)
        half_w = dist * math.tan(math.radians(fov) / 2) * aspect
        half_h = dist * math.tan(math.radians(fov) / 2)
        target = target + right * ((ccx - tcx) * 2 * half_w * 0.8) + up * (-(ccy - tcy) * 2 * half_h * 0.8)
    pos = target + d * dist
    return pos, target, screen_box(points, pos, target, fov, aspect)


def r3(v) -> list[float]:
    return [round(float(v[0]), 4), round(float(v[1]), 4), round(float(v[2]), 4)]
