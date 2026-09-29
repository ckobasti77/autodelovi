"""Entry: export the raw GLB and (desktop) the scene-derived manifest base.

  blender -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/export.py -- \
      [--quality desktop|lite]

Writes 3d/build/car.raw.glb (or car-lite.raw.glb) and, for desktop, 3d/build/manifest.base.json.
Helper custom props (sk_*) are removed in memory before export; the .blend is not saved.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import scene  # noqa: E402
from lib.layout import bbox, cam_dir, corners, explode_table, node_points, r3, solve_camera  # noqa: E402
from lib.materials import manifest_materials  # noqa: E402
from lib.parts import load_taxonomy, part_nodes  # noqa: E402
from lib.scene import to_vehicle  # noqa: E402

F3_KEYS = [
    "partId", "category", "system", "labelSr", "clickable", "lod",
    "explodeDir", "explodeDist", "explodeStage", "explodeOrder",
    "labelAnchor", "focusDir", "focusMinDist",
]

CAMERAS = {
    "hero": {
        "desktop": {"az": 36.0, "el": 14.0, "fov": 28.0, "aspect": 16 / 9, "width": 0.56, "cx": 0.64, "cy": 0.52},
        "mobile": {"az": 30.0, "el": 16.0, "fov": 38.0, "aspect": 4 / 5, "width": 0.92, "cx": 0.50, "cy": 0.58},
    },
    "exploded": {
        "desktop": {"az": 43.0, "el": 24.0, "fov": 28.0, "aspect": 16 / 9, "box": (0.38, 0.94, 0.12, 0.86)},
        "mobile": {"az": 36.0, "el": 20.0, "fov": 38.0, "aspect": 4 / 5, "box": (0.08, 0.92, 0.10, 0.90)},
    },
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", default="desktop", choices=["desktop", "lite"])
    return ap.parse_args(argv)


def scripts_hash() -> str:
    h = hashlib.sha256()
    base = scene.ROOT / "3d" / "blender"
    files = sorted(p for p in base.rglob("*.py") if "__pycache__" not in p.parts)
    files.append(scene.BUILD / "taxonomy.json")
    for p in files:
        h.update(str(p.relative_to(scene.ROOT)).replace("\\", "/").encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def vec(v) -> Vector:
    return Vector(v)


def main() -> None:
    scene.check_version()
    args = parse()
    tax = load_taxonomy()
    table = explode_table()
    nodes = part_nodes()
    if len(nodes) != 91:
        raise RuntimeError(f"expected 91 part nodes, found {len(nodes)}")

    # ---------------------------------------------------------------- per-node data
    info = {}
    all_assembled: list[Vector] = []
    all_exploded: list[Vector] = []
    for e in nodes:
        key = e.name[len("part__"):]
        if key not in table:
            raise KeyError(f"no explode data for {key}")
        d, dist, order = table[key]
        pts = node_points(e)
        mn, mx = bbox(pts)
        off = vec(d) * dist
        pivot = vec(to_vehicle(e.matrix_world.translation))
        top_centre = Vector(((mn.x + mx.x) / 2, mx.y + 0.03, (mn.z + mx.z) / 2))
        anchor = top_centre - pivot
        info[key] = {"empty": e, "dir": d, "dist": dist, "order": order, "pivot": pivot, "mn": mn, "mx": mx, "anchor": anchor}
        cs = corners(mn, mx)
        all_assembled.extend(cs)
        all_exploded.extend(c + off for c in cs)
    static_pts: list[Vector] = []
    for o in bpy.data.objects:
        if o.type == "MESH" and (o.name.startswith("body__") or o.name.startswith("chassis__")):
            mn, mx = bbox([Vector(to_vehicle(o.matrix_world @ Vector(c))) for c in o.bound_box])
            static_pts.extend(corners(mn, mx))
    all_assembled.extend(static_pts)
    all_exploded.extend(static_pts)
    car_mn, car_mx = bbox(all_assembled)

    # ---------------------------------------------------------------- cameras
    cams = {}
    for state, per in CAMERAS.items():
        cams[state] = {}
        pts = all_assembled if state == "hero" else all_exploded
        for vp, c in per.items():
            if "box" in c:
                pos, tgt, sb = solve_camera(pts, c["az"], c["el"], c["fov"], c["aspect"], box=c["box"])
            else:
                pos, tgt, sb = solve_camera(pts, c["az"], c["el"], c["fov"], c["aspect"], width=c["width"], cx=c["cx"], cy=c["cy"])
            cams[state][vp] = {"position": r3(pos), "target": r3(tgt), "fov": c["fov"]}
            scene.log(f"camera {state}.{vp}: screen x {sb[0]:.3f}-{sb[1]:.3f} y {sb[2]:.3f}-{sb[3]:.3f}")
    exploded_cam = vec(cams["exploded"]["desktop"]["position"])

    # ---------------------------------------------------------------- focus (node + category)
    from config.explode import FOCUS_OVERRIDES

    def focus_for(keys: list[str], category: str) -> tuple[list[float], float]:
        pts = []
        dirs = Vector()
        for k in keys:
            i = info[k]
            off = vec(i["dir"]) * i["dist"]
            pts.extend(c + off for c in corners(i["mn"], i["mx"]))
            dirs += vec(i["dir"])
        mn, mx = bbox(pts)
        centre = (mn + mx) / 2
        radius = max((mx - mn).length / 2, 0.05)
        if category in FOCUS_OVERRIDES:
            fd = vec(FOCUS_OVERRIDES[category])
        else:
            c = (exploded_cam - centre).normalized()
            ed = dirs.normalized() if dirs.length > 1e-6 else Vector((0, 1, 0))
            fd = c * 0.55 + ed * 0.35 + Vector((0, 1, 0)) * 0.10
        if fd.x == 0 and fd.y == 0 and fd.z == 0:
            fd = Vector((0.5, 0.5, 0.7))
        fd.normalize()
        if fd.y < 0.08:
            fd.y = 0.08
            fd.normalize()
        return r3(fd), round(min(max(2.4 * radius, 0.45), 3.2), 3)

    for k, i in info.items():
        cat = i["empty"]["category"]
        fd, md = focus_for([k], cat)
        i["focusDir"], i["focusMinDist"] = fd, md

    # ---------------------------------------------------------------- extras on part nodes
    for k, i in info.items():
        e = i["empty"]
        e["explodeDir"] = list(i["dir"])
        e["explodeDist"] = float(i["dist"])
        e["explodeOrder"] = float(i["order"])
        e["labelAnchor"] = r3(i["anchor"])
        e["focusDir"] = i["focusDir"]
        e["focusMinDist"] = float(i["focusMinDist"])

    # ---------------------------------------------------------------- manifest base (desktop)
    used_mats: set[str] = set()
    parts_out = []
    for k in sorted(info):
        i = info[k]
        e = i["empty"]
        mats = sorted({s.material.name for c in e.children if c.type == "MESH" for s in c.material_slots if s.material})
        used_mats.update(mats)
        parts_out.append({
            "node": e.name,
            "partId": e["partId"],
            "category": e["category"],
            "system": e["system"],
            "labelSr": e["labelSr"],
            "clickable": True,
            "lod": "core",
            "explode": {"dir": list(i["dir"]), "distance": i["dist"], "stage": int(e["explodeStage"]), "order": i["order"]},
            "pivot": r3(i["pivot"]),
            "bbox": {"min": r3(i["mn"]), "max": r3(i["mx"])},
            "labelAnchor": r3(i["anchor"]),
            "triangles": {"desktop": 0, "lite": 0},
            "materials": mats,
        })
    for o in bpy.data.objects:
        if o.type == "MESH" and (o.name.startswith("body__") or o.name.startswith("chassis__")):
            used_mats.update(s.material.name for s in o.material_slots if s.material)

    categories_out = []
    ed = (exploded_cam - (car_mn + car_mx) / 2).normalized()
    for c in tax["categories"]:
        keys = [f"{c['slug']}__{i['instance']}" for i in c["instances"]]
        if keys:
            fd, md = focus_for(keys, c["slug"])
        else:
            fd, md = r3(ed), 0.0
        categories_out.append({
            "slug": c["slug"],
            "labelSr": c["labelSr"],
            "system": c["system"],
            "nodes": [f"part__{k}" for k in keys],
            "hasMesh": bool(keys),
            "thumbnail": f"/images/parts/{c['slug']}.webp",
            "focus": {"dir": fd, "minDistance": md, "fov": 30},
        })

    manifest = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": {"blender": bpy.app.version_string, "scriptsHash": scripts_hash()},
        "models": {},
        "units": "meters",
        "axes": {"up": "+Y", "front": "+Z", "left": "+X"},
        "bbox": {"min": r3(car_mn), "max": r3(car_mx)},
        "systems": tax["systems"],
        "stages": tax["stages"],
        "categories": categories_out,
        "parts": parts_out,
        "cameras": cams,
        "materials": manifest_materials(used_mats),
    }

    # ---------------------------------------------------------------- strip helper props, export
    for o in bpy.data.objects:
        for key in list(o.keys()):
            if key.startswith("sk_"):
                del o[key]
        if o.type == "MESH":
            for key in list(o.data.keys()):
                del o.data[key]
            for key in list(o.keys()):
                del o[key]
        elif o.name.startswith("part__"):
            for key in list(o.keys()):
                if key not in F3_KEYS:
                    del o[key]
        else:
            for key in list(o.keys()):
                del o[key]
    for m in bpy.data.materials:
        for key in list(m.keys()):
            del m[key]

    coll = bpy.data.collections.get(scene.EXPORT_COLL)
    lc = bpy.context.view_layer.layer_collection.children[coll.name]
    bpy.context.view_layer.active_layer_collection = lc
    raw = scene.BUILD / ("car.raw.glb" if args.quality == "desktop" else "car-lite.raw.glb")
    kwargs = dict(
        filepath=str(raw), export_format="GLB",
        use_active_collection=True, use_active_collection_with_nested=True, use_renderable=True,
        export_extras=True, export_yup=True, export_apply=True,
        export_normals=True, export_texcoords=True, export_tangents=False,
        export_materials="EXPORT", export_image_format="AUTO", export_vertex_color="NONE",
        export_attributes=False, export_cameras=False, export_lights=False,
        export_animations=False, export_skins=False, export_morph=False,
        export_gpu_instances=False, export_shared_accessors=False,
        export_hierarchy_flatten_objs=False, export_hierarchy_full_collections=False,
        export_draco_mesh_compression_enable=False, export_use_gltfpack=False,
        export_unused_images=False, export_unused_textures=False,
    )
    valid = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    missing = [k for k in kwargs if k not in valid]
    if missing:
        raise RuntimeError(f"glTF exporter lacks arguments: {missing}")
    bpy.ops.export_scene.gltf(**kwargs)
    scene.log(f"exported {raw} ({raw.stat().st_size / 1e6:.2f} MB)")
    if args.quality == "desktop":
        out = scene.BUILD / "manifest.base.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=1)
        scene.log(f"manifest base: {out}")


main()
