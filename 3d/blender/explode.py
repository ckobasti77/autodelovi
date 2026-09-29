"""Explode checks and tuning (PLAN §6.4).

  --check   packaging (assembled), final state and motion on both timelines -> reports
  --solve   grow explode distances until the exploded state is free of opaque overlaps
            (writes 3d/build/explode.tuned.json), then runs --check
  --audit   visibility audit: Workbench per-object ID renders at p = 1 from the exploded cameras

Run: "$BLENDER_EXE" -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/explode.py -- --check
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
from mathutils.bvhtree import BVHTree  # noqa: E402

from lib import scene  # noqa: E402
from lib.layout import TUNED, explode_table  # noqa: E402
from lib.scene import V, log  # noqa: E402
from lib.views import STAGE_WINDOWS, local_progress, power2_inout  # noqa: E402

REPORTS = scene.BUILD / "reports"
SEE_THROUGH = {"mat_body_xray", "mat_glass_xray", "mat_glass_lens"}
STATIC_OPAQUE = ("chassis__",)
BURIED = {"zupcasti-kais-vodena-pumpa__water-pump", "lezaj-glavcina", "kocione-plocice", "karter-dihtunzi__sump", "senzori__coolant-temp", "letva-volana", "spone-stabilizatori__stabilizer", "termostat-creva__hoses"}
# right-hand twins may sit behind the engine from the front-left cameras; the runtime focuses the
# left instance when a category is chosen from the list (PLAN §7), so they only need to be present
TWIN = {"fr": "fl", "rr": "rl", "r": "l", "tie-rod-r": "tie-rod-l"}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--solve", action="store_true")
    ap.add_argument("--audit", action="store_true")
    ap.add_argument("--samples", type=int, default=81)
    return ap.parse_args(argv)


# --------------------------------------------------------------------------- geometry


class Body:
    """Triangles of one node (world space at the assembled state), split into opaque / see-through."""

    def __init__(self, name: str, objs: list[bpy.types.Object], moving: bool) -> None:
        self.name = name
        self.moving = moving
        self.verts: dict[str, list[Vector]] = {"opaque": [], "xray": []}
        self.tris: dict[str, list[tuple[int, int, int]]] = {"opaque": [], "xray": []}
        for o in objs:
            me = o.data
            me.calc_loop_triangles()
            mw = o.matrix_world
            co = [mw @ v.co for v in me.vertices]
            remap: dict[tuple[str, int], int] = {}
            for lt in me.loop_triangles:
                mname = me.materials[lt.material_index].name if me.materials else ""
                cls = "xray" if mname in SEE_THROUGH else "opaque"
                idx = []
                for vi in lt.vertices:
                    key = (cls, vi)
                    if key not in remap:
                        remap[key] = len(self.verts[cls])
                        self.verts[cls].append(co[vi])
                    idx.append(remap[key])
                self.tris[cls].append(tuple(idx))
        self.box = {}
        for cls in ("opaque", "xray"):
            vs = self.verts[cls]
            if vs:
                self.box[cls] = (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))), Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))
        self._trees: dict[tuple[str, tuple], BVHTree] = {}

    def has(self, cls: str) -> bool:
        return bool(self.tris[cls])

    def tree(self, cls: str, off: Vector) -> BVHTree:
        key = (cls, (round(off.x, 5), round(off.y, 5), round(off.z, 5)))
        t = self._trees.get(key)
        if t is None:
            if len(self._trees) > 6:
                self._trees.clear()
            t = BVHTree.FromPolygons([v + off for v in self.verts[cls]], self.tris[cls], all_triangles=True, epsilon=0.0)
            self._trees[key] = t
        return t

    def aabb(self, cls: str, off: Vector):
        mn, mx = self.box[cls]
        return mn + off, mx + off


def aabb_hit(a, b, pad: float = 0.0) -> bool:
    (amn, amx), (bmn, bmx) = a, b
    return all(amn[i] - pad <= bmx[i] and bmn[i] - pad <= amx[i] for i in range(3))


def load_bodies() -> dict[str, Body]:
    bodies = {}
    for e in bpy.data.objects:
        if e.name.startswith("part__"):
            objs = [c for c in e.children_recursive if c.type == "MESH"]
            bodies[e.name[len("part__"):]] = Body(e.name, objs, True)
        elif e.type == "MESH" and e.name.startswith(STATIC_OPAQUE):
            bodies[e.name] = Body(e.name, [e], False)
    return bodies


# --------------------------------------------------------------------------- timing


class Timing:
    def __init__(self, table) -> None:
        self.table = table
        self.stage = {}
        for key in table:
            o = bpy.data.objects.get(f"part__{key}")
            self.stage[key] = int(o["explodeStage"]) if o is not None and "explodeStage" in o else 1

    def offset(self, key: str, p: float, timeline: str) -> Vector:
        if key not in self.table:
            return Vector((0, 0, 0))
        d, dist, order = self.table[key]
        k = power2_inout(local_progress(p, STAGE_WINDOWS[timeline][self.stage[key]], order))
        return V(*(Vector(d) * dist * k))


def overlapping(bodies, timing, p: float, timeline: str, cls_a="opaque", cls_b="opaque", only=None) -> dict[tuple[str, str], int]:
    offs = {k: timing.offset(k, p, timeline) for k in bodies}
    keys = [k for k in bodies if bodies[k].has(cls_a) or bodies[k].has(cls_b)]
    hits = {}
    for i, a in enumerate(keys):
        for b in keys[i + 1 :]:
            if only is not None and a not in only and b not in only:
                continue
            A, B = bodies[a], bodies[b]
            if not (A.moving or B.moving):
                continue
            if not (A.has(cls_a) and B.has(cls_b)):
                continue
            if not aabb_hit(A.aabb(cls_a, offs[a]), B.aabb(cls_b, offs[b])):
                continue
            n = len(A.tree(cls_a, offs[a]).overlap(B.tree(cls_b, offs[b])))
            if n:
                hits[(a, b)] = n
    return hits


def contacts() -> set[frozenset]:
    try:
        from config.contacts import CONTACTS
    except ImportError:
        return set()
    return {frozenset(p) for p in CONTACTS}


# --------------------------------------------------------------------------- check / solve


def check(bodies, samples: int) -> dict:
    t0 = time.time()
    table = explode_table()
    timing = Timing(table)
    declared = contacts()
    pack = overlapping(bodies, timing, 0.0, "desktop")
    pack_err, pack_warn = [], []
    for (a, b), n in sorted(pack.items(), key=lambda kv: -kv[1]):
        msg = f"{a} x {b}: {n} intersecting triangle pairs"
        (pack_warn if frozenset((a, b)) in declared else pack_err).append(msg)
    log(f"packaging: {len(pack)} overlapping pairs ({len(pack_err)} undeclared) in {time.time() - t0:.1f}s")
    final = overlapping(bodies, timing, 1.0, "desktop")
    final_err = [f"{a} x {b}: {n} pairs at p=1" for (a, b), n in sorted(final.items(), key=lambda kv: -kv[1])]
    xray_final = overlapping(bodies, timing, 1.0, "desktop", "xray", "xray")
    motion_warn = []
    passes = {}
    for timeline in ("desktop", "mobile"):
        prev = None
        for s in range(1, samples):
            p = s / (samples - 1)
            offs = tuple(tuple(round(c, 4) for c in timing.offset(k, p, timeline)) for k in sorted(bodies))
            if offs == prev:
                continue
            prev = offs
            for pair, n in overlapping(bodies, timing, p, timeline).items():
                if pair in pack:
                    continue
                rec = passes.setdefault((timeline, pair), [p, p, 0])
                rec[1] = p
                rec[2] = max(rec[2], n)
    for (timeline, (a, b)), (p0, p1, n) in sorted(passes.items(), key=lambda kv: -kv[1][2]):
        if (a, b) in final:
            continue
        motion_warn.append(f"{timeline}: {a} passes through {b} for p {p0:.2f}-{p1:.2f} (max {n} pairs)")
    log(f"motion: {len(final_err)} final overlaps, {len(motion_warn)} pass-throughs, {len(xray_final)} x-ray panel overlaps in {time.time() - t0:.1f}s")
    h = scene.scripts_hash()
    REPORTS.mkdir(parents=True, exist_ok=True)
    packaging = {"scriptsHash": h, "errors": pack_err, "warnings": pack_warn, "declaredContacts": len(declared)}
    motion = {
        "scriptsHash": h,
        "errors": final_err,
        "warnings": motion_warn + [f"x-ray panels overlap at p=1: {a} x {b}" for (a, b) in sorted(xray_final)],
        "timelines": {k: {str(s): list(w) for s, w in v.items()} for k, v in STAGE_WINDOWS.items()},
        "samples": samples,
    }
    for name, rep in (("packaging", packaging), ("motion", motion)):
        with open(REPORTS / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=2, ensure_ascii=False)
    for m in pack_err[:40]:
        print("PACK", m)
    for m in final_err[:40]:
        print("FINAL", m)
    for m in motion_warn[:40]:
        print("MOTION", m)
    return {"packaging": pack_err, "final": final_err}


def order_key(timing, table, key):
    d, dist, order = table[key]
    return (timing.stage[key], order)


def solve(bodies) -> None:
    """Grow the distance of the later node (stage, order) of every pair still overlapping at p=1
    in 6 % steps (max 1.6x the intent); rotate toward +y as a second resort (max 10 degrees)."""
    from config.explode import E

    base = explode_table()
    table = dict(base)
    timing = Timing(table)
    grow = {k: 1.0 for k in table}
    tilt = {k: 0 for k in table}
    for it in range(40):
        timing.table = table
        final = overlapping(bodies, timing, 1.0, "desktop")
        if not final:
            log(f"solve: clean after {it} iterations")
            break
        movers = set()
        for a, b in final:
            cand = [k for k in (a, b) if k in table]
            if not cand:
                continue
            movers.add(max(cand, key=lambda k: order_key(timing, table, k)))
        changed = False
        for k in movers:
            d, dist, order = table[k]
            if grow[k] < 1.6:
                grow[k] = min(1.6, grow[k] * 1.06)
                table[k] = (d, round(base[k][1] * grow[k], 4), order)
                changed = True
            elif tilt[k] < 10:
                tilt[k] += 2
                v = Vector(d)
                v = (v + Vector((0, 1, 0)) * 0.035).normalized()
                table[k] = ((round(v.x, 5), round(v.y, 5), round(v.z, 5)), dist, order)
                changed = True
        log(f"solve it {it}: {len(final)} overlaps, adjusted {len(movers)}")
        if not changed:
            log("solve: trapped parts remain: " + ", ".join(sorted({x for pair in final for x in pair})))
            break
    tuned = {}
    for k, (d, dist, order) in table.items():
        bd, bdist, border = base[k]
        if abs(dist - bdist) > 1e-6 or tuple(d) != tuple(bd):
            tuned[k] = {"dir": list(d), "dist": dist, "order": order}
    # keep previously tuned values of nodes not touched this run
    with open(TUNED, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(tuned.items())), f, indent=2)
    log(f"solve: {len(tuned)} tuned nodes -> {TUNED}")


# --------------------------------------------------------------------------- visibility audit


def audit() -> None:
    """Visible / solo pixel ratio per part at p = 1 from both exploded cameras (see-through
    materials hidden), Workbench flat object colours, AA off."""
    import numpy as np

    from lib.views import Exploder, make_camera, scene_points, set_output, solve

    s = bpy.context.scene
    s.render.engine = "BLENDER_WORKBENCH"
    sh = s.display.shading
    sh.light = "FLAT"
    sh.color_type = "OBJECT"
    sh.show_shadows = False
    sh.show_cavity = False
    sh.show_specular_highlight = False
    sh.show_object_outline = False
    s.display.render_aa = "OFF"
    s.view_settings.view_transform = "Raw" if "Raw" in [t.identifier for t in type(s.view_settings).bl_rna.properties["view_transform"].enum_items] else "Standard"
    s.view_settings.look = "None"
    s.render.film_transparent = True
    ex = Exploder()
    ex.apply(1.0)
    parts = sorted((o for o in bpy.data.objects if o.name.startswith("part__")), key=lambda o: o.name)
    ids = {}
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in meshes:
        o.hide_render = True
    # see-through geometry: hide objects whose materials are all see-through; opaque parts keep
    # their see-through primitives hidden by giving those faces no colour (object colour applies
    # per object, so lamp lenses are accepted as part of the lamp).
    def lin(v: float) -> float:
        # the view transform encodes to sRGB: pick linear values that land exactly on 8-bit codes
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    for i, e in enumerate(parts):
        r, g, b = lin(((i + 1) & 0xFF) / 255.0), lin(0.2), lin(0.6)
        ids[e.name] = i + 1
        for c in e.children_recursive:
            if c.type != "MESH":
                continue
            mats = {m.name for m in c.data.materials if m}
            if mats and mats <= SEE_THROUGH:
                continue
            c.color = (r, g, b, 1.0)
            c.hide_render = False
    results = {}
    w, h = 960, 540
    for vp, (rw, rh) in (("desktop", (960, 540)), ("mobile", (540, 675))):
        pts = scene_points()
        pos, tgt, _ = solve("exploded", vp, pts)
        make_camera("audit_cam", pos, tgt, 28 if vp == "desktop" else 38)
        set_output("", rw, rh, True)
        path = scene.BUILD / "reports" / f"audit-{vp}.png"

        def render_ids(solo: bool = False) -> np.ndarray:
            out = path.with_name(f"audit-{vp}-solo.png") if solo else path
            s.render.filepath = str(out)
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(str(out), check_existing=False)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(rh, rw, 4)
            bpy.data.images.remove(img)
            return np.rint(px[:, :, 0] * 255).astype(np.int32) * (px[:, :, 3] > 0.5)

        full = render_ids()
        vis_objs = [c for c in meshes if not c.hide_render]
        for e in parts:
            own = [c for c in e.children_recursive if c in vis_objs]
            if not own:
                results.setdefault(e.name, {})[vp] = {"visible": 0, "solo": 0, "ratio": None, "xray": True}
                continue
            for c in vis_objs:
                c.hide_render = c not in own
            solo = render_ids(True)
            for c in vis_objs:
                c.hide_render = False
            i = ids[e.name] & 0xFF
            n_solo = int((solo == i).sum())
            n_vis = int((full == i).sum())
            results.setdefault(e.name, {})[vp] = {"visible": n_vis, "solo": n_solo, "ratio": round(n_vis / n_solo, 3) if n_solo else 0.0}
        log(f"audit {vp}: done")
    ex.reset()
    errors, warnings = [], []
    scale = (960 * 540) / (1440 * 810)
    for name, r in sorted(results.items()):
        key = name[len("part__"):]
        buried = any(key.startswith(b) for b in BURIED)
        need = 0.25 if buried else 0.40
        for vp in ("desktop", "mobile"):
            d = r.get(vp, {})
            if d.get("xray"):
                continue  # see-through panels read through the x-ray rim, not opaque pixels
            if (d.get("ratio") or 0) < need:
                cat, inst = key.split("__", 1)
                twin = results.get(f"part__{cat}__{TWIN.get(inst, '')}", {}).get(vp, {})
                if inst in TWIN and (twin.get("ratio") or 0) >= need:
                    warnings.append(f"{key}: {vp} visible {d.get('ratio') or 0:.2f} of solo; left twin {TWIN[inst]} visible {twin.get('ratio'):.2f}")
                else:
                    errors.append(f"{key}: {vp} visible {d.get('ratio') or 0:.2f} of solo (need {need:.2f})")
            elif vp == "desktop" and d.get("visible", 0) < 400 * scale:
                warnings.append(f"{key}: small click target on desktop ({d.get('visible', 0)} px at 960x540; category list covers it)")
    rep = {"scriptsHash": scene.scripts_hash(), "errors": errors, "warnings": warnings, "parts": results}
    with open(REPORTS / "visibility.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2, ensure_ascii=False)
    for m in warnings:
        print("VIS", m)
    log(f"audit: {len(warnings)} warnings")


def main() -> None:
    scene.check_version()
    args = parse()
    t0 = time.time()
    if args.solve or args.check:
        bodies = load_bodies()
        log(f"loaded {len(bodies)} bodies in {time.time() - t0:.1f}s")
        if args.solve:
            solve(bodies)
        check(bodies, args.samples)
    if args.audit:
        audit()
    log(f"explode.py done in {time.time() - t0:.1f}s")


main()
