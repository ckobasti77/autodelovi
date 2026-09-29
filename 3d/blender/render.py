"""Entry: QA renders, close-ups, stage previews (posters/thumbnails/shadows in render_final.py).

  blender -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/render.py -- \
      --set qa [--views front34,rear34,side,top,exploded] [--tag name]
      --set closeup --focus kocioni-diskovi,kocione-celjusti [--p 1] [--az 35 --el 20] [--noshell]
      --set stages
      --set clay [--views ...]
Output: 3d/renders/qa/<tag>/<view>.png
"""

from __future__ import annotations

import argparse
import datetime as dt
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib import scene  # noqa: E402
from lib.layout import bbox, corners, node_points, solve_camera  # noqa: E402
from lib.views import (  # noqa: E402
    Exploder,
    add_sun,
    apply_paint,
    apply_xray,
    color_management,
    eevee,
    make_camera,
    scene_points,
    set_output,
    setup_world,
    solve,
)

BODY_CATS = {"hauba", "branici", "blatobrani", "vrata", "retrovizori", "stakla", "brisaci"}
MODULE_CATS = {
    "wheels": ["felne-gume"],
    "brakes": ["kocioni-diskovi", "kocione-plocice", "kocione-celjusti", "abs-senzori", "lezaj-glavcina"],
    "suspension": ["amortizeri-opruge", "ramena-selen-blokovi", "lezaj-glavcina"],
    "steering": ["letva-volana", "spone-stabilizatori"],
    "engine": ["motor", "karter-dihtunzi", "paljenje-grejaci", "nosaci-motora"],
    "turbo": ["turbina"],
    "intake": ["usisna-grana", "interkuler", "egr-ventil"],
    "fuel": ["brizgaljke-pumpa-goriva"],
    "belts": ["zupcasti-kais-vodena-pumpa", "kais-alternatora"],
    "electrical": ["alternator", "anlaser", "akumulator", "senzori"],
    "cooling": ["hladnjak-ventilator", "termostat-creva", "klima"],
    "drivetrain": ["kvacilo-zamajac", "menjac", "poluosovine"],
    "exhaust": ["dpf-katalizator", "auspuh"],
    "lighting": ["farovi", "stop-svetla"],
    "body": sorted(BODY_CATS),
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="qa")
    ap.add_argument("--views", default="front34,rear34,side,top,exploded")
    ap.add_argument("--focus", default="")
    ap.add_argument("--nodes", default="")
    ap.add_argument("--p", type=float, default=0.0)
    ap.add_argument("--az", type=float, default=35.0)
    ap.add_argument("--el", type=float, default=22.0)
    ap.add_argument("--fill", type=float, default=0.72)
    ap.add_argument("--noshell", action="store_true")
    ap.add_argument("--paint", action="store_true", help="glossy paint on the shell (smoothness study)")
    ap.add_argument("--solo", action="store_true", help="hide every other part")
    ap.add_argument("--tag", default="")
    ap.add_argument("--res", default="1600x1000")
    ap.add_argument("--samples", type=int, default=32)
    return ap.parse_args(argv)


def out_dir(tag: str) -> Path:
    t = tag or dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    d = scene.RENDERS / "qa" / t
    d.mkdir(parents=True, exist_ok=True)
    return d


def part_objs():
    return [o for o in bpy.data.objects if o.name.startswith("part__")]


def is_shell(o: bpy.types.Object) -> bool:
    if o.name.startswith("body__"):
        return True
    if o.name.startswith("part__"):
        return o.name.split("__")[1] in BODY_CATS
    return False


def set_visible(pred) -> None:
    """Hide render for part trees / static nodes where pred(top_node) is False."""
    tops = [o for o in bpy.data.objects if o.name.startswith(("part__", "body__", "chassis__")) and not (o.parent and o.parent.name.startswith(("part__", "body__")))]
    for top in tops:
        vis = pred(top)
        for o in [top] + list(top.children_recursive):
            o.hide_render = not vis


def floor(size: float = 14.0) -> None:
    me = bpy.data.meshes.get("qa_floor")
    if me is None:
        me = bpy.data.meshes.new("qa_floor")
        s = size / 2
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    obj = bpy.data.objects.get("qa_floor") or bpy.data.objects.new("qa_floor", me)
    if obj.name not in scene.helper_collection().objects:
        scene.helper_collection().objects.link(obj)
    mat = bpy.data.materials.get("qa_floor_mat") or bpy.data.materials.new("qa_floor_mat")
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        for n in list(mat.node_tree.nodes):
            mat.node_tree.nodes.remove(n)
        out = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        mat.node_tree.links.new(bsdf.outputs[0], out.inputs[0])
    bsdf.inputs["Base Color"].default_value = (0.0085, 0.0105, 0.0125, 1)
    bsdf.inputs["Roughness"].default_value = 0.8
    me.materials.clear()
    me.materials.append(mat)


def rig(shadows: bool = True) -> None:
    setup_world(0.6, rotation_deg=0.0)
    add_sun("key", "#FFF4E8", 1.6, 35, 40, shadow=shadows, angle_deg=6)
    add_sun("rim", "#CFEFFF", 1.2, 200, 25, shadow=False)
    color_management()


def render(path: Path) -> None:
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    scene.log(f"render {path.name}")


def ortho_view(name: str, pts, axis: str, res):
    mn, mx = bbox(pts)
    c = (mn + mx) / 2
    w, h = res
    aspect = w / h
    if axis == "side":
        pos = Vector((c.x + 8, c.y, c.z))
        span_w, span_h = mx.z - mn.z, mx.y - mn.y
    elif axis == "top":
        pos = Vector((c.x, c.y + 8, c.z + 0.001))
        span_w, span_h = mx.z - mn.z, mx.x - mn.x
    else:  # front
        pos = Vector((c.x, c.y, c.z + 8))
        span_w, span_h = mx.x - mn.x, mx.y - mn.y
    scale = max(span_w, span_h * aspect) * 1.08
    cam = make_camera(name, pos, c, 30, ortho_scale=scale)
    cam.data.sensor_fit = "HORIZONTAL"
    if axis == "top":
        # keep the car horizontal on screen (front to the left)
        target = scene.V(*c)
        p = scene.V(*pos)
        cam.rotation_quaternion = (target - p).to_track_quat("-Z", "X")
    return cam


def closeup_nodes(args) -> list[bpy.types.Object]:
    cats: set[str] = set()
    for f in [x for x in args.focus.split(",") if x]:
        cats.update(MODULE_CATS.get(f, [f]))
    nodes = [o for o in part_objs() if o.name.split("__")[1] in cats]
    if args.nodes:
        wanted = set(args.nodes.split(","))
        nodes = [o for o in part_objs() if o.name in wanted or o.name[6:] in wanted]
    return nodes


def main() -> None:
    args = parse()
    w, h = (int(x) for x in args.res.split("x"))
    eevee(args.samples)
    rig(shadows=True)
    floor()
    exploder = Exploder()
    d = out_dir(args.tag)

    if args.set in ("qa", "clay"):
        if args.set == "clay":
            s = bpy.context.scene
            s.render.engine = "BLENDER_WORKBENCH"
            sh = s.display.shading
            sh.light = "MATCAP"
            sh.color_type = "SINGLE"
            sh.single_color = (0.72, 0.72, 0.72)
            sh.show_cavity = True
            sh.cavity_type = "BOTH"
            sh.show_shadows = False
            s.display.render_aa = "16"
        else:
            apply_xray(exploded=False)
        xr = apply_xray if not args.paint else (lambda exploded=False: apply_paint())
        for view in [v for v in args.views.split(",") if v]:
            exploded = view.startswith("exploded")
            if exploded:
                exploder.apply(1.0)
                xr(exploded=True) if args.set == "qa" else None
            else:
                exploder.reset()
                xr(exploded=False) if args.set == "qa" else None
            pts = scene_points()
            if view in ("front34", "exploded"):
                set_output("", w, int(w * 9 / 16), False)
                pos, tgt, _ = solve("exploded" if exploded else "hero", "desktop", pts)
                make_camera("qa_cam", pos, tgt, 28)
            elif view == "exploded_m":
                set_output("", 1080, 1350, False)
                pos, tgt, _ = solve("exploded", "mobile", pts)
                make_camera("qa_cam", pos, tgt, 38)
            elif view == "rear34":
                set_output("", w, int(w * 9 / 16), False)
                pos, tgt, _ = solve_camera(pts, 216, 14, 28, 16 / 9, width=0.80, cx=0.5, cy=0.5)
                make_camera("qa_cam", pos, tgt, 28)
            elif view in ("side", "top", "front"):
                set_output("", w, int(w * 9 / 16), False)
                ortho_view("qa_cam", pts, view, (w, int(w * 9 / 16)))
            elif view == "under":
                set_output("", w, int(w * 9 / 16), False)
                pos, tgt, _ = solve_camera(pts, 35, -12, 28, 16 / 9, width=0.85, cx=0.5, cy=0.5)
                make_camera("qa_cam", pos, tgt, 28)
                bpy.data.objects["qa_floor"].hide_render = True
            else:
                raise ValueError(view)
            render(d / f"{args.set}-{view}.png")
            bpy.data.objects["qa_floor"].hide_render = False
        exploder.reset()

    elif args.set == "closeup":
        nodes = closeup_nodes(args)
        if not nodes:
            raise SystemExit("no nodes for closeup")
        names = {n.name for n in nodes}
        exploder.apply(args.p)
        apply_xray(exploded=args.p > 0.5)
        if args.solo:
            set_visible(lambda top: top.name in names)
        elif args.noshell:
            set_visible(lambda top: not is_shell(top))
        pts = []
        for n in nodes:
            mn, mx = bbox(node_points(n))
            pts.extend(corners(mn, mx))
        set_output("", w, h, False)
        add_sun("fill", "#FFFFFF", 1.0, args.az, min(args.el + 12, 80), shadow=False)
        pos, tgt, _ = solve_camera(pts, args.az, args.el, 30, w / h, width=args.fill, cx=0.5, cy=0.5)
        make_camera("qa_cam", pos, tgt, 30)
        label = args.tag or args.focus.replace(",", "+") or "nodes"
        render(d / f"closeup-{label}-p{int(args.p)}.png")

    elif args.set == "stages":
        set_output("", 1280, 720, False)
        for i, p in enumerate((0.0, 0.24, 0.32, 0.46, 0.58, 0.72, 0.84, 1.0)):
            exploder.apply(p)
            apply_xray(exploded=p > 0.2)
            pts = scene_points()
            pos, tgt, _ = solve("exploded", "desktop", pts)
            make_camera("qa_cam", pos, tgt, 28)
            render(d / f"stage-{i}.png")
        exploder.reset()


main()
