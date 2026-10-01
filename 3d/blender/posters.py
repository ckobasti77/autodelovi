"""Posters, contact shadows and the web environment map (PLAN §8.2-§8.4).

  --set posters   layers per state (assembled, exploded) x viewport (desktop, tablet, mobile):
                  shadow (Cycles shadow catcher), opaque (EEVEE), shell (EEVEE x-ray, opaque parts
                  held out, Freestyle edges on desktop) -> 3d/renders/posters/<state>-<vp>-<layer>.png
  --set shadows   top-down contact shadows for the web -> 3d/renders/posters/shadow-<state>.png
  --set env       512 x 256 Radiance copy of the studio HDRI -> 3d/build/env/studio-512.hdr
                  (3d/scripts/env.mjs bakes it into public/models/env/studio-pmrem.hdr)
  --set all

3d/scripts/images.mjs composites the layers in display space (the three.js blend) and encodes
AVIF/WebP into public/images/hero and public/models.
Run: "$BLENDER_EXE" -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/posters.py -- --set all
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import scene  # noqa: E402
from lib.scene import V, log  # noqa: E402
from lib.views import (  # noqa: E402
    HDRI,
    Exploder,
    add_sun,
    apply_xray,
    color_management,
    cycles,
    eevee,
    make_camera,
    set_output,
    setup_world,
)

OUT = scene.RENDERS / "posters"
SIZES = {"desktop": (2560, 1440), "tablet": (1536, 1536), "mobile": (1080, 1350)}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="all")
    ap.add_argument("--samples", type=int, default=64)
    ap.add_argument("--scale", type=float, default=1.0, help="resolution scale for quick previews")
    ap.add_argument("--only", default="", help="e.g. assembled-desktop")
    ap.add_argument("--opaque-shell", action="store_true", help="debug: shell layer over the page colour")
    ap.add_argument("--xray", default="", help="JSON override of config/xray.py for look studies")
    ap.add_argument("--out", default="", help="output folder for the layers (default 3d/renders/posters)")
    return ap.parse_args(argv)


def mesh_objects() -> list[bpy.types.Object]:
    return [o for o in scene.export_collection().all_objects if o.type == "MESH"]


XRAY_MATS = {"mat_body_xray", "mat_glass_xray"}


def kind(o: bpy.types.Object) -> str:
    """shell = only x-ray slots, mixed = some x-ray slots (mirror housing), opaque = none."""
    mats = {m.name for m in o.data.materials if m}
    if mats and mats <= XRAY_MATS:
        return "shell"
    return "mixed" if mats & XRAY_MATS else "opaque"


def hide_xray_slots() -> None:
    """Layer A: x-ray slots become fully transparent (mixed objects keep their opaque faces)."""
    for name in XRAY_MATS:
        mat = bpy.data.materials.get(name)
        if mat is None:
            continue
        nt = mat.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(tr.outputs[0], out.inputs["Surface"])
        mat.surface_render_method = "BLENDED"


def manifest_cameras() -> dict:
    with open(scene.BUILD / "manifest.base.json", encoding="utf-8") as f:
        return json.load(f)["cameras"]


def camera_from_manifest(state: str, vp: str) -> None:
    c = manifest_cameras()["hero" if state == "assembled" else "exploded"][vp]
    make_camera("poster_cam", Vector(c["position"]), Vector(c["target"]), c["fov"])


def reset_visibility() -> None:
    for o in mesh_objects():
        o.hide_render = False
        o.is_holdout = False
        o.visible_camera = True
        o.visible_shadow = True


def catcher(size: float = 30.0) -> bpy.types.Object:
    me = bpy.data.meshes.get("poster_catcher")
    if me is None:
        s = size / 2
        me = bpy.data.meshes.new("poster_catcher")
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.get("poster_catcher") or bpy.data.objects.new("poster_catcher", me)
    if obj.name not in scene.helper_collection().objects:
        scene.helper_collection().objects.link(obj)
    obj.is_shadow_catcher = True
    return obj


def white_world(strength: float = 1.0) -> None:
    w = bpy.data.worlds.get("poster_white") or bpy.data.worlds.new("poster_white")
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs[0], out.inputs[0])
    bpy.context.scene.world = w


def render_to(path: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    s = bpy.context.scene
    s.render.filepath = str(path)
    t = time.time()
    bpy.ops.render.render(write_still=True)
    log(f"render {path.name} ({time.time() - t:.1f}s)")


def shadow_layer(path: Path, w: int, h: int, samples: int) -> None:
    """Cycles: uniform white world, car invisible to the camera but casting onto a catcher."""
    reset_visibility()
    cycles(samples)
    s = bpy.context.scene
    s.cycles.use_denoising = True
    s.render.use_freestyle = False
    white_world(1.0)
    from lib.views import paint_material

    for name in XRAY_MATS:  # the shell grounds the car too: cast as a plain opaque body
        if bpy.data.materials.get(name):
            paint_material(bpy.data.materials[name], "#808080", 0.0, 0.6, 0.0)
    for o in mesh_objects():
        o.visible_camera = False
    cat = catcher()
    cat.hide_render = False
    for name in ("key", "rim"):
        if bpy.data.objects.get(name):
            bpy.data.objects[name].hide_render = True
    set_output("", w, h, True)
    render_to(path)
    cat.hide_render = True


def studio_rig() -> None:
    setup_world(0.6, rotation_deg=0.0, hemi=True)
    add_sun("key", "#FFF4E8", 1.6, 35, 40, shadow=False, angle_deg=6)
    add_sun("rim", "#CFEFFF", 1.2, 200, 25, shadow=False)
    for name in ("key", "rim"):
        bpy.data.objects[name].hide_render = False
    color_management()


def opaque_layer(path: Path, w: int, h: int, samples: int) -> None:
    reset_visibility()
    eevee(samples)
    s = bpy.context.scene
    s.eevee.use_shadows = False
    s.render.use_freestyle = False
    studio_rig()
    hide_xray_slots()
    for o in mesh_objects():
        if kind(o) == "shell":
            o.hide_render = True
    set_output("", w, h, True)
    render_to(path)


def freestyle(enable: bool, alpha: float) -> None:
    s = bpy.context.scene
    s.render.use_freestyle = enable
    if not enable:
        return
    s.render.line_thickness_mode = "ABSOLUTE"
    s.render.line_thickness = 1.0
    coll = bpy.data.collections.get("poster_shell")
    if coll is None:
        coll = bpy.data.collections.new("poster_shell")
        coll.use_fake_user = True  # referenced only by the Freestyle lineset
    for o in mesh_objects():
        if kind(o) != "opaque" and o.name not in coll.objects:
            coll.objects.link(o)
    vl = bpy.context.view_layer
    fs = vl.freestyle_settings
    fs.crease_angle = 2.6529  # 152 degrees == EdgesGeometry threshold 28 degrees
    fs.as_render_pass = False
    ls = fs.linesets.get("shell_edges") or fs.linesets.new("shell_edges")
    for other in fs.linesets:
        other.show_render = other == ls
    ls.select_by_collection = True
    if ls.collection != coll:
        ls.collection = coll
    ls.select_by_edge_types = True
    ls.select_by_visibility = True
    ls.visibility = "RANGE"
    ls.qi_start, ls.qi_end = 0, 1
    ls.select_crease = True
    ls.select_border = True
    ls.select_silhouette = False
    ls.select_contour = False
    st = ls.linestyle
    st.color = (0.349, 0.812, 1.0)  # #9FE9FF in linear
    st.alpha = alpha
    st.thickness = 1.0


XRAY_OVERRIDE: dict | None = None


def shell_layer(path: Path, w: int, h: int, samples: int, exploded: bool, mobile: bool, transparent: bool = True) -> None:
    reset_visibility()
    eevee(samples)
    s = bpy.context.scene
    s.eevee.use_shadows = False
    studio_rig()
    apply_xray(exploded=exploded, mobile=mobile, values=XRAY_OVERRIDE)
    for o in mesh_objects():
        if kind(o) == "opaque":
            o.is_holdout = True
    freestyle(not mobile, 0.20 if exploded else 0.35)
    set_output("", w, h, transparent)
    render_to(path)
    s.render.use_freestyle = False


def posters(args) -> None:
    ex = Exploder()
    for state in ("assembled", "exploded"):
        for vp in ("desktop", "tablet", "mobile"):
            tag = f"{state}-{vp}"
            if args.only and args.only != tag:
                continue
            w, h = (int(round(v * args.scale)) for v in SIZES[vp])
            ex.apply(1.0 if state == "exploded" else 0.0, "desktop" if vp == "desktop" else "mobile")
            camera_from_manifest(state, vp)
            shadow_layer(OUT / f"{tag}-shadow.png", w, h, args.samples)
            opaque_layer(OUT / f"{tag}-opaque.png", w, h, args.samples)
            # Tablets run the mid tier (lite shader, no edge lines): their poster matches it.
            shell_layer(OUT / f"{tag}-shell.png", w, h, args.samples, state == "exploded", vp != "desktop", not args.opaque_shell)
    ex.reset()


def shadows(args) -> None:
    """Top-down orthographic contact shadows (512 px, 5.2 m / 6.4 m footprint) for the web."""
    ex = Exploder()
    for state, p, span in (("assembled", 0.0, 5.2), ("exploded", 1.0, 6.4)):
        ex.apply(p)
        cam = make_camera("shadow_cam", Vector((0.0, 12.0, 0.0001)), Vector((0.0, 0.0, 0.0)), 30, ortho_scale=span)
        cam.data.sensor_fit = "HORIZONTAL"
        # keep the car's front at the texture's top: image up = +z (vehicle front)
        target = V(0, 0, 0)
        cam.rotation_quaternion = (target - V(0, 12, 0.0001)).to_track_quat("-Z", "Y")
        shadow_layer(OUT / f"shadow-{state}.png", 512, 512, 256)
    ex.reset()


def env() -> None:
    # Intermediate only: 3d/scripts/env.mjs bakes it into the PMREM atlas the web loads.
    dst = scene.BUILD / "env" / "studio-512.hdr"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.load(str(HDRI), check_existing=False)
    img.scale(512, 256)
    img.filepath_raw = str(dst)
    img.file_format = "HDR"
    img.save()
    log(f"env -> {dst} ({dst.stat().st_size / 1e6:.2f} MB)")


def main() -> None:
    global OUT, XRAY_OVERRIDE
    scene.check_version()
    args = parse()
    if args.xray:
        from config.xray import XRAY

        over = json.loads(args.xray)
        XRAY_OVERRIDE = {k: ({**XRAY[k], **over[k]} if isinstance(XRAY[k], dict) and k in over else over.get(k, XRAY[k])) for k in XRAY}
    if args.out:
        OUT = Path(args.out) if Path(args.out).is_absolute() else scene.ROOT / args.out
    t0 = time.time()
    if args.set in ("posters", "all"):
        posters(args)
    if args.set in ("shadows", "all"):
        shadows(args)
    if args.set in ("env", "all"):
        env()
    log(f"posters.py done in {time.time() - t0:.1f}s")


main()
