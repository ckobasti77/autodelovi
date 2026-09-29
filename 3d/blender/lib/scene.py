"""Scene helpers: coordinates, collections, naming, part nodes, custom properties.

Vehicle / glTF space is (x = left, y = up, z = front). Blender is Z-up with the vehicle front
towards -Y, so V(x, y, z) -> Blender (x, -z, y). Every script thinks in vehicle space and
converts only here (docs/3D-CONTRACT.md §F2).
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[3]  # project root
BUILD = ROOT / "3d" / "build"
RENDERS = ROOT / "3d" / "renders"
ASSETS = ROOT / "3d" / "assets"

ROOT_NAME = "sklop_car"
EXPORT_COLL = "EXPORT"
HELPER_COLL = "HELPERS"


def V(x: float, y: float, z: float) -> Vector:
    """Vehicle (left, up, front) -> Blender vector."""
    return Vector((x, -z, y))


def to_vehicle(v) -> tuple[float, float, float]:
    """Blender vector -> vehicle/glTF tuple (left, up, front)."""
    return (v[0], v[2], -v[1])


# Rotation that maps vehicle axes onto Blender axes (columns = images of vehicle x, y, z).
VEH_TO_BL = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def check_version() -> None:
    if bpy.app.version < (5, 1, 0):
        raise RuntimeError(f"Blender >= 5.1 required, found {bpy.app.version_string}")


def log(*args) -> None:
    print("[sklop]", *args, flush=True)


def reset_scene() -> None:
    """Remove every object and data-block so a build starts from a clean file."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
        bpy.data.node_groups,
    ):
        for item in list(coll):
            coll.remove(item)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def get_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(coll)
    return coll


def export_collection() -> bpy.types.Collection:
    return get_collection(EXPORT_COLL)


def helper_collection() -> bpy.types.Collection:
    return get_collection(HELPER_COLL)


def new_empty(name: str, location=(0, 0, 0), parent=None, coll=None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        (coll or export_collection()).objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.05
    obj.location = location
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    if parent is not None:
        obj.parent = parent
    return obj


def root() -> bpy.types.Object:
    return new_empty(ROOT_NAME)


def system_node(system: str) -> bpy.types.Object:
    name = f"sys__{system}"
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = new_empty(name, parent=root())
    return obj


def link_mesh_object(name: str, mesh: bpy.types.Mesh, parent=None, coll=None) -> bpy.types.Object:
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    obj = bpy.data.objects.new(name, mesh)
    (coll or export_collection()).objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def delete_tree(obj: bpy.types.Object) -> None:
    """Delete an object and all its descendants (and orphan meshes)."""
    for child in list(obj.children):
        delete_tree(child)
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if isinstance(data, bpy.types.Mesh) and data.users == 0:
        bpy.data.meshes.remove(data)


def delete_by_builder(module: str) -> int:
    """Remove every top-level node built by `module` (tag sk_builder) with its children."""
    victims = [o for o in bpy.data.objects if o.get("sk_builder") == module and (o.parent is None or o.parent.get("sk_builder") != module)]
    for o in victims:
        if o.name in bpy.data.objects:
            delete_tree(o)
    return len(victims)


def rot_y_deg(deg: float) -> Matrix:
    """Rotation about the vehicle up axis (Blender Z)."""
    return Matrix.Rotation(math.radians(deg), 4, "Z")
