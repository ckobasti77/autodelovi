"""Part registry and build context.

Every clickable part is a transform-only Empty `part__<category>__<instance>` (identity
rotation/scale, origin = pivot) with ONE mesh child `mesh__<category>__<instance>__0` holding all
geometry (one primitive per material). Geometry is authored in vehicle-local coordinates relative
to the pivot. Shared meshes (wheels, discs, pads, hubs) are linked duplicates yawed 180 degrees.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

import bpy

from . import scene
from .finish import geo_to_object, triangle_count
from .geo import Geo
from .scene import V, log

TAXONOMY_JSON = scene.BUILD / "taxonomy.json"

# Lite build: materials per part are capped so the lite GLB stays within 150 draw calls
# (PLAN §3.9 / §9). Dropped slots merge into a kept slot of the same family.
LITE_CAP_3 = {"farovi", "stop-svetla"}
LITE_CAP_2 = {
    "turbina", "kocioni-diskovi", "kocione-celjusti", "amortizeri-opruge", "kvacilo-zamajac", "zupcasti-kais-vodena-pumpa",
    "hladnjak-ventilator", "alternator", "anlaser", "akumulator", "felne-gume", "motor", "menjac", "interkuler",
    "usisna-grana", "klima", "retrovizori", "brisaci", "auspuh", "dpf-katalizator", "poluosovine", "letva-volana",
}
_FAMILY = {
    **{m: "metal" for m in ("mat_machined_steel", "mat_steel_dark", "mat_cast_iron", "mat_cast_alu", "mat_brushed_alu", "mat_chrome", "mat_copper", "mat_heat_shield", "mat_caliper", "mat_core_fins")},
    **{m: "dark" for m in ("mat_plastic_black", "mat_rubber", "mat_hose", "mat_tyre", "mat_battery", "mat_painted_black", "mat_plastic_grey", "mat_ceramic", "mat_wire")},
    **{m: "see" for m in ("mat_glass_lens", "mat_glass_xray", "mat_body_xray")},
    **{m: "light" for m in ("mat_emissive_led", "mat_emissive_tail")},
}


def lite_materials(geo: Geo, category: str) -> Geo:
    cap = 3 if category in LITE_CAP_3 else 2 if category in LITE_CAP_2 else 1
    counts: dict[str, int] = {}
    for m in geo.mats:
        counts[m] = counts.get(m, 0) + 1
    if len(counts) <= cap:
        return geo
    order = sorted(counts, key=lambda m: -counts[m])
    keep = order[:cap]
    if cap >= 3:  # lamps keep lens, housing and light source
        want = [m for m in order if _FAMILY.get(m) in ("see", "light")] + [m for m in order if _FAMILY.get(m) == "dark"]
        keep = list(dict.fromkeys(want + order))[:cap]
    solid = [m for m in keep if _FAMILY.get(m) not in ("see", "light")] or keep
    remap = {}
    for m in counts:
        if m in keep:
            continue
        same = [k for k in keep if _FAMILY.get(k) == _FAMILY.get(m)]
        remap[m] = same[0] if same else solid[0]
    g = geo.copy()
    g.mats = [remap.get(m, m) for m in g.mats]
    return g


def load_taxonomy() -> dict:
    with open(TAXONOMY_JSON, encoding="utf-8") as f:
        return json.load(f)


@dataclass
class BuildContext:
    quality: str = "desktop"  # or "lite"
    module: str = ""
    taxonomy: dict = field(default_factory=load_taxonomy)
    shared: dict = field(default_factory=dict)
    built: set = field(default_factory=set)

    @property
    def lite(self) -> bool:
        return self.quality == "lite"

    def seg(self, n: int, minimum: int = 8) -> int:
        """Segment count scaled for the quality level."""
        return max(minimum, int(round(n * (0.6 if self.lite else 1.0))))

    # -- taxonomy lookups
    def category(self, slug: str) -> dict:
        for c in self.taxonomy["categories"]:
            if c["slug"] == slug:
                return c
        raise KeyError(slug)

    def instance(self, slug: str, inst: str) -> dict:
        for i in self.category(slug)["instances"]:
            if i["instance"] == inst:
                return i
        raise KeyError(f"{slug}__{inst}")

    # -- nodes
    def add_part(
        self,
        category: str,
        instance: str,
        pivot: tuple[float, float, float],
        geo: Geo | None,
        *,
        bevel: float = 0.0012,
        segments: int = 2,
        profile: float = 0.5,
        sharp_angle: float = 30.0,
        shared_key: str | None = None,
        yaw180: bool = False,
    ) -> bpy.types.Object:
        cat = self.category(category)
        inst = self.instance(category, instance)
        node = f"part__{category}__{instance}"
        existing = bpy.data.objects.get(node)
        if existing is not None:
            scene.delete_tree(existing)
        sys_obj = scene.system_node(cat["system"])
        empty = scene.new_empty(node, V(*pivot), parent=sys_obj)
        empty["partId"] = f"{category}__{instance}"
        empty["category"] = category
        empty["system"] = cat["system"]
        empty["labelSr"] = inst["labelSr"]
        empty["clickable"] = True
        empty["lod"] = "core"
        empty["explodeStage"] = int(inst.get("stage") or cat["stage"])
        empty["sk_builder"] = self.module
        empty["sk_quality"] = self.quality
        child_name = f"mesh__{category}__{instance}__0"
        coll = scene.export_collection()
        if shared_key and shared_key in self.shared:
            mesh = self.shared[shared_key]
            obj = scene.link_mesh_object(child_name, mesh, parent=empty, coll=coll)
        else:
            if geo is None:
                raise ValueError(f"{node}: no geometry")
            if self.lite:
                geo = lite_materials(geo, category)
            obj = geo_to_object(geo, child_name, empty, coll, bevel=bevel, segments=segments, profile=profile, sharp_angle=sharp_angle)
            if shared_key:
                self.shared[shared_key] = obj.data
        obj["sk_builder"] = self.module
        obj.rotation_mode = "XYZ"
        obj.rotation_euler = (0.0, 0.0, math.pi if yaw180 else 0.0)
        self.built.add(node)
        return empty

    def add_static(self, name: str, system: str, geo: Geo, *, parent_name: str | None = None, pivot=(0.0, 0.0, 0.0), bevel: float = 0.0, segments: int = 2) -> bpy.types.Object:
        """Non-clickable mesh node (body__*, chassis__*) — no extras besides builder tags."""
        existing = bpy.data.objects.get(name)
        if existing is not None:
            scene.delete_tree(existing)
        parent = bpy.data.objects.get(parent_name) if parent_name else scene.system_node(system)
        coll = scene.export_collection()
        obj = geo_to_object(geo, name, parent, coll, bevel=bevel, segments=segments)
        obj.location = V(*pivot)
        obj["sk_builder"] = self.module
        self.built.add(name)
        return obj

    def add_static_empty(self, name: str, system: str) -> bpy.types.Object:
        existing = bpy.data.objects.get(name)
        if existing is not None:
            scene.delete_tree(existing)
        e = scene.new_empty(name, (0, 0, 0), parent=scene.system_node(system))
        e["sk_builder"] = self.module
        return e


def part_nodes() -> list[bpy.types.Object]:
    return sorted((o for o in bpy.data.objects if o.name.startswith("part__")), key=lambda o: o.name)


def part_triangles(empty: bpy.types.Object) -> int:
    return sum(triangle_count(c) for c in empty.children if c.type == "MESH")


def report() -> None:
    total = 0
    for e in part_nodes():
        total += part_triangles(e)
    static = [o for o in bpy.data.objects if o.type == "MESH" and (o.name.startswith("body__") or o.name.startswith("chassis__"))]
    total += sum(triangle_count(o) for o in static)
    log(f"parts: {len(part_nodes())}  triangles (rendered): {total}")


PIVOTS_JSON = scene.BUILD / "pivots.json"
_DESKTOP_PIVOTS: dict | None = None


def desktop_pivots() -> dict:
    """Pivots written by the desktop build; the lite build reuses them so both GLBs share
    identical node transforms (the manifest is generated from the desktop scene)."""
    global _DESKTOP_PIVOTS
    if _DESKTOP_PIVOTS is None:
        _DESKTOP_PIVOTS = json.loads(PIVOTS_JSON.read_text(encoding="utf-8")) if PIVOTS_JSON.exists() else {}
    return _DESKTOP_PIVOTS


def write_pivots() -> None:
    from .scene import to_vehicle

    data = {o.name: [round(c, 6) for c in to_vehicle(o.matrix_world.translation)] for o in part_nodes()}
    PIVOTS_JSON.write_text(json.dumps(data, indent=1), encoding="utf-8")


def add_centered(ctx: "BuildContext", category: str, instance: str, geo_abs: Geo, pivot=None, **kw) -> bpy.types.Object:
    """Add a part from absolute vehicle-space geometry; pivot = bbox centre unless given
    (lite builds take the desktop pivot so both GLBs match)."""
    from mathutils import Vector as _V

    if pivot is None and ctx.lite and f"part__{category}__{instance}" in desktop_pivots():
        pivot = desktop_pivots()[f"part__{category}__{instance}"]
    if pivot is None:
        mn, mx = geo_abs.bbox()
        pivot = (mn + mx) / 2
    p = _V(pivot)
    g = geo_abs.copy().moved(-p.x, -p.y, -p.z)
    return ctx.add_part(category, instance, (p.x, p.y, p.z), g, **kw)
