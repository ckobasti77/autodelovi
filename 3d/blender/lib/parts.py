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


def add_centered(ctx: "BuildContext", category: str, instance: str, geo_abs: Geo, pivot=None, **kw) -> bpy.types.Object:
    """Add a part from absolute vehicle-space geometry; pivot = bbox centre unless given."""
    from mathutils import Vector as _V

    if pivot is None:
        mn, mx = geo_abs.bbox()
        pivot = (mn + mx) / 2
    p = _V(pivot)
    g = geo_abs.copy().moved(-p.x, -p.y, -p.z)
    return ctx.add_part(category, instance, (p.x, p.y, p.z), g, **kw)
