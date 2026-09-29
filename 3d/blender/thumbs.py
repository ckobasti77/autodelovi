"""Category thumbnails: transparent 1024 px masters (Cycles) -> public/images/parts/<slug>.webp (768 px).

Camera three-quarter front-left (az 35, el 20), 35 mm lens, part bounding sphere at 70 % of the
frame, optical centre slightly above the middle; warm key from upper left, cool rim #9FE9FF from
behind right, HDRI fill; contact shadow on a catcher, no floor. X-ray slots render as primer /
glass so body panels read as replacement parts. Service categories use props (parts/props.py).

Run: "$BLENDER_EXE" -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/thumbs.py -- [--only slug,slug] [--samples 128]
Then: node 3d/scripts/thumbs.mjs
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from config.thumbs import PREFERRED, PROPS, THUMBS  # noqa: E402
from lib import scene  # noqa: E402
from lib.layout import bbox, cam_dir, node_points  # noqa: E402
from lib.materials import hex_rgb  # noqa: E402
from lib.scene import V, log, to_vehicle  # noqa: E402
from lib.views import add_area, color_management, cycles, make_camera, set_output, setup_world  # noqa: E402

OUT = scene.RENDERS / "thumbs"
LENS_FOV = 2 * math.degrees(math.atan(18 / 35))  # 35 mm on a 36 mm sensor, square frame


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--samples", type=int, default=128)
    ap.add_argument("--res", type=int, default=1024)
    return ap.parse_args(argv)


def thumb_materials() -> None:
    """Render-only look for x-ray slots: primed replacement panel and clear glass. Lamp lenses
    also render as clear glass so reflectors, projectors and light guides read through them."""
    body = bpy.data.materials["mat_body_xray"]
    glass = bpy.data.materials["mat_glass_xray"]
    lens = bpy.data.materials["mat_glass_lens"]
    for mat, kind in ((body, "primer"), (glass, "glass"), (lens, "glass")):
        nt = mat.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        if kind == "primer":
            b.inputs["Base Color"].default_value = (*hex_rgb("#2F3337"), 1)
            b.inputs["Roughness"].default_value = 0.55
        else:
            b.inputs["Base Color"].default_value = (*hex_rgb("#DDE6EA"), 1)
            b.inputs["Roughness"].default_value = 0.03
            b.inputs["Transmission Weight"].default_value = 1.0
            b.inputs["IOR"].default_value = 1.52
        nt.links.new(b.outputs[0], out.inputs["Surface"])
        mat.surface_render_method = "DITHERED"


def catcher() -> bpy.types.Object:
    me = bpy.data.meshes.get("thumb_catcher")
    if me is None:
        me = bpy.data.meshes.new("thumb_catcher")
        me.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
    o = bpy.data.objects.get("thumb_catcher") or bpy.data.objects.new("thumb_catcher", me)
    if o.name not in scene.helper_collection().objects:
        scene.helper_collection().objects.link(o)
    o.is_shadow_catcher = True
    return o


def all_render_objects() -> list[bpy.types.Object]:
    return [o for o in bpy.data.objects if o.type == "MESH"]


def part_node(key: str) -> bpy.types.Object:
    return bpy.data.objects[f"part__{key}"]


def default_nodes(slug: str, taxonomy: dict) -> list[str]:
    cat = next(c for c in taxonomy["categories"] if c["slug"] == slug)
    insts = [i["instance"] for i in cat["instances"]]
    for p in PREFERRED:
        if p in insts:
            return [f"{slug}__{p}"]
    return [f"{slug}__{insts[0]}"]


def screen_right(az: float) -> Vector:
    d = cam_dir(az, 0.0)
    return Vector((d.z, 0.0, -d.x)).normalized()


def stage_nodes(keys: list[str], spec: dict) -> dict[str, Vector]:
    """Temporarily moves part Empties (row layout / yaw); returns original locations."""
    saved = {}
    empties = [part_node(k) for k in keys]
    for e in empties:
        saved[e.name] = (e.location.copy(), e.rotation_euler.copy())
    if spec.get("row"):
        right = screen_right(spec.get("az", 35.0))
        cursor = 0.0
        for e in empties:
            mn, mx = bbox(node_points(e))
            size = (mx - mn)
            extent = abs(size.x * right.x) + abs(size.z * right.z)
            centre = (mn + mx) / 2
            target = right * (cursor + extent / 2)
            delta = Vector((target.x - centre.x, -mn.y, target.z - centre.z))
            e.location = e.location + V(*delta)
            cursor += extent + 0.06
        bpy.context.view_layer.update()
    if spec.get("yaw"):
        pts = [p for e in empties for p in node_points(e)]
        mn, mx = bbox(pts)
        c = (mn + mx) / 2
        pivot = V(c.x, c.y, c.z)
        from mathutils import Matrix

        rot = Matrix.Rotation(math.radians(spec["yaw"]), 4, "Z")  # vehicle y (up) == Blender z
        for e in empties:
            m = Matrix.Translation(pivot) @ rot @ Matrix.Translation(-pivot) @ e.matrix_world
            e.matrix_world = m
        bpy.context.view_layer.update()
    return saved


def restore(saved) -> None:
    for name, (loc, rot) in saved.items():
        o = bpy.data.objects[name]
        o.location = loc
        o.rotation_euler = rot
    bpy.context.view_layer.update()


def frame(objs_points: list[Vector], az: float, el: float) -> None:
    mn, mx = bbox(objs_points)
    c = (mn + mx) / 2
    r = max((p - c).length for p in objs_points)
    half = math.radians(LENS_FOV / 2)
    ang = math.atan(0.70 * math.tan(half))
    dist = r / math.sin(ang)
    d = cam_dir(az, el)
    pos = c + d * dist
    cam = make_camera("thumb_cam", pos, c, LENS_FOV)
    cam.data.sensor_fit = "AUTO"
    cam.data.lens = 35.0
    cam.data.sensor_width = 36.0
    cam.data.shift_y = -0.02
    cam.data.clip_start = max(0.01, dist - r * 3)
    cam.data.clip_end = dist + r * 4
    # lights scale with the subject so every thumbnail shares the same exposure
    k = max(r, 0.08)
    add_area("thumb_key", "#FFF4E8", 380.0 * k * k, 35, 40, 6.0 * k, size=(4.0 * k, 2.0 * k), target=tuple(c))
    add_area("thumb_rim", "#9FE9FF", 420.0 * k * k, 200, 25, 6.0 * k, size=(2.0 * k, 6.0 * k), target=tuple(c))
    cat = catcher()
    cat.location = (0.0, 0.0, mn.y - 0.0005)  # Blender z == vehicle y


def render_set(slug: str, visible: list[bpy.types.Object], points: list[Vector], az: float, el: float, res: int) -> None:
    for o in all_render_objects():
        o.hide_render = o not in visible and o.name != "thumb_catcher"
    frame(points, az, el)
    OUT.mkdir(parents=True, exist_ok=True)
    s = bpy.context.scene
    s.render.filepath = str(OUT / f"{slug}.png")
    t = time.time()
    bpy.ops.render.render(write_still=True)
    log(f"thumb {slug} ({time.time() - t:.1f}s)")


def main() -> None:
    scene.check_version()
    args = parse()
    with open(scene.BUILD / "taxonomy.json", encoding="utf-8") as f:
        taxonomy = json.load(f)
    cycles(args.samples)
    s = bpy.context.scene
    s.cycles.use_denoising = True
    s.cycles.adaptive_threshold = 0.01
    s.render.use_freestyle = False
    setup_world(0.6, rotation_deg=0.0)
    color_management()
    set_output("", args.res, args.res, True)
    thumb_materials()
    from parts.props import build_props

    props = build_props()
    only = {x for x in args.only.split(",") if x}
    slugs = [c["slug"] for c in taxonomy["categories"]] + [sc["slug"] for sc in taxonomy.get("subcategories", [])]
    t0 = time.time()
    for slug in slugs:
        if only and slug not in only:
            continue
        if slug in PROPS:
            objs = props[slug]
            pts = [Vector(to_vehicle(o.matrix_world @ v.co)) for o in objs for v in o.data.vertices]
            render_set(slug, objs, pts, 35.0, 24.0, args.res)
            continue
        spec = THUMBS.get(slug, {})
        keys = spec.get("nodes") or default_nodes(slug, taxonomy)
        saved = stage_nodes(keys, spec)
        empties = [part_node(k) for k in keys]
        objs = [c for e in empties for c in e.children_recursive if c.type == "MESH"]
        pts = [p for e in empties for p in node_points(e)]
        if "focus_x" in spec:
            lo, hi = spec["focus_x"]
            pts = [p for p in pts if lo <= p.x <= hi] or pts
        render_set(slug, objs, pts, spec.get("az", 35.0), spec.get("el", 20.0), args.res)
        restore(saved)
    log(f"thumbs done in {time.time() - t0:.1f}s")


main()
