"""Explode application, camera framing and render rigs shared by render.py and export.py."""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

from . import scene
from .layout import bbox, corners, explode_table, node_points, solve_camera
from .materials import hex_rgb
from .scene import V, to_vehicle

HDRI = scene.ASSETS / "hdri" / "studio_small_09_2k.hdr"

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

def _stage_windows() -> dict[str, dict[int, tuple[float, float]]]:
    """Desktop windows from the taxonomy; mobile runs grouped stages sequentially inside their
    shared window (first stage over [0, 0.55], second over [0.45, 1]) — PLAN §6.2."""
    import json

    with open(scene.BUILD / "taxonomy.json", encoding="utf-8") as f:
        stages = [s for s in json.load(f)["stages"] if s["stage"] > 0]
    out = {"desktop": {s["stage"]: tuple(s["scroll"]["desktop"]) for s in stages}, "mobile": {}}
    groups: dict[tuple[float, float], list[int]] = {}
    for s in stages:
        groups.setdefault(tuple(s["scroll"]["mobile"]), []).append(s["stage"])
    for (a, b), members in groups.items():
        members.sort()
        if len(members) == 1:
            out["mobile"][members[0]] = (a, b)
        else:
            out["mobile"][members[0]] = (a, a + 0.55 * (b - a))
            out["mobile"][members[1]] = (a + 0.45 * (b - a), b)
    return out


STAGE_WINDOWS = _stage_windows()


def power2_inout(t: float) -> float:
    return 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2


def local_progress(p: float, window: tuple[float, float], order: float) -> float:
    s, e = window
    u = min(max((p - s) / (e - s), 0.0), 1.0)
    return min(max((u - 0.35 * order) / 0.65, 0.0), 1.0)


class Exploder:
    """Moves part Empties to an explode state and restores them."""

    def __init__(self) -> None:
        self.table = explode_table()
        self.home = {o.name: o.location.copy() for o in bpy.data.objects if o.name.startswith("part__")}

    def offset(self, key: str, p: float, timeline: str = "desktop") -> Vector:
        d, dist, order = self.table[key]
        obj = bpy.data.objects.get(f"part__{key}")
        stage = int(obj["explodeStage"]) if obj is not None and "explodeStage" in obj else 1
        k = power2_inout(local_progress(p, STAGE_WINDOWS[timeline][stage], order))
        return Vector(d) * dist * k

    def apply(self, p: float, timeline: str = "desktop") -> None:
        for name, home in self.home.items():
            key = name[len("part__"):]
            off = self.offset(key, p, timeline)
            bpy.data.objects[name].location = home + V(*off)
        bpy.context.view_layer.update()

    def reset(self) -> None:
        for name, home in self.home.items():
            bpy.data.objects[name].location = home
        bpy.context.view_layer.update()


def scene_points(nodes=None, include_static: bool = True) -> list[Vector]:
    pts: list[Vector] = []
    objs = nodes if nodes is not None else [o for o in bpy.data.objects if o.name.startswith("part__")]
    for e in objs:
        mn, mx = bbox(node_points(e))
        pts.extend(corners(mn, mx))
    if include_static:
        for o in bpy.data.objects:
            if o.type == "MESH" and (o.name.startswith("body__") or o.name.startswith("chassis__")):
                ws = [Vector(to_vehicle(o.matrix_world @ Vector(c))) for c in o.bound_box]
                mn, mx = bbox(ws)
                pts.extend(corners(mn, mx))
    return pts


def solve(state: str, viewport: str, points: list[Vector]):
    c = CAMERAS[state][viewport]
    if "box" in c:
        return solve_camera(points, c["az"], c["el"], c["fov"], c["aspect"], box=c["box"])
    return solve_camera(points, c["az"], c["el"], c["fov"], c["aspect"], width=c["width"], cx=c["cx"], cy=c["cy"])


# --------------------------------------------------------------------------- blender camera


def make_camera(name: str, pos: Vector, target: Vector, fov_deg: float, ortho_scale: float | None = None) -> bpy.types.Object:
    cam_data = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = bpy.data.objects.new(name, cam_data)
        scene.helper_collection().objects.link(cam)
    cam_data.sensor_fit = "VERTICAL"
    cam_data.clip_start = 0.05
    cam_data.clip_end = 200
    if ortho_scale:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_scale
    else:
        cam_data.type = "PERSP"
        cam_data.angle_y = math.radians(fov_deg)
    p = V(*pos)
    t = V(*target)
    cam.location = p
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (t - p).to_track_quat("-Z", "Y")
    bpy.context.scene.camera = cam
    return cam


# --------------------------------------------------------------------------- world + lights


def light_dir(az: float, el: float) -> Vector:
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)))


def setup_world(strength: float = 0.6, rotation_deg: float = 0.0, bg_hex: str = "#0D0F11", hemi: bool = False) -> None:
    w = bpy.data.worlds.get("sklop_world") or bpy.data.worlds.new("sklop_world")
    bpy.context.scene.world = w
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    tex = nt.nodes.new("ShaderNodeTexEnvironment")
    if HDRI.exists():
        tex.image = bpy.data.images.load(str(HDRI), check_existing=True)
    else:
        fallback = bpy.utils.system_resource("DATAFILES", path="studiolights/world/studio.exr")
        tex.image = bpy.data.images.load(fallback, check_existing=True)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, 0, math.radians(rotation_deg))
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    nt.links.new(tex.outputs["Color"], bg.inputs["Color"])
    env_shader = bg.outputs["Background"]
    if hemi:
        # three.js HemisphereLight equivalent: sky above / ground below, radiance x 0.35/pi
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
        gt = nt.nodes.new("ShaderNodeMath")
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = 0.0
        nt.links.new(sep.outputs["Z"], gt.inputs[0])
        mixc = nt.nodes.new("ShaderNodeMix")
        mixc.data_type = "RGBA"
        ground = hex_rgb("#0D0F11")
        sky = hex_rgb("#1C2530")
        mixc.inputs["A"].default_value = (*ground, 1)
        mixc.inputs["B"].default_value = (*sky, 1)
        nt.links.new(gt.outputs[0], mixc.inputs["Factor"])
        hb = nt.nodes.new("ShaderNodeBackground")
        hb.inputs["Strength"].default_value = 0.35 / math.pi
        nt.links.new(mixc.outputs["Result"], hb.inputs["Color"])
        add = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(env_shader, add.inputs[0])
        nt.links.new(hb.outputs["Background"], add.inputs[1])
        env_shader = add.outputs["Shader"]
    # camera rays see the flat page colour
    lp = nt.nodes.new("ShaderNodeLightPath")
    dark = nt.nodes.new("ShaderNodeBackground")
    r, g, b = hex_rgb(bg_hex)
    dark.inputs["Color"].default_value = (r, g, b, 1)
    dark.inputs["Strength"].default_value = 1.0
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(env_shader, mix.inputs[1])
    nt.links.new(dark.outputs["Background"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    try:
        w.sun_threshold = 1000.0
        w.use_sun_shadow = False
    except AttributeError:
        pass


def add_sun(name: str, hexcol: str, strength: float, az: float, el: float, shadow: bool = False, angle_deg: float = 3.0) -> bpy.types.Object:
    data = bpy.data.lights.get(name) or bpy.data.lights.new(name, "SUN")
    data.color = hex_rgb(hexcol)
    data.energy = strength
    data.use_shadow = shadow
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, data)
        scene.helper_collection().objects.link(obj)
    d = light_dir(az, el)
    to_light = V(*d)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (-to_light).to_track_quat("-Z", "Y")
    return obj


def add_area(name: str, hexcol: str, power: float, az: float, el: float, dist: float, size=(2.0, 1.0), target=(0.0, 0.5, 0.0)) -> bpy.types.Object:
    data = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.color = hex_rgb(hexcol)
    data.energy = power
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, data)
        scene.helper_collection().objects.link(obj)
    d = light_dir(az, el)
    t = Vector(target)
    pos = t + d * dist
    obj.location = V(*pos)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (V(*t) - V(*pos)).to_track_quat("-Z", "Y")
    return obj


# --------------------------------------------------------------------------- x-ray shader (render only)


def xray_material(mat: bpy.types.Material, rim_power: float, rim_scale: float, base_alpha: float, tint_hex: str, rim_hex: str) -> None:
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(geo.outputs["Incoming"], dot.inputs[1])
    absn = nt.nodes.new("ShaderNodeMath")
    absn.operation = "ABSOLUTE"
    nt.links.new(dot.outputs["Value"], absn.inputs[0])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(absn.outputs[0], inv.inputs[1])
    clamp = nt.nodes.new("ShaderNodeClamp")
    nt.links.new(inv.outputs[0], clamp.inputs["Value"])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = rim_power
    nt.links.new(clamp.outputs[0], pw.inputs[0])
    sc = nt.nodes.new("ShaderNodeMath")
    sc.operation = "MULTIPLY"
    sc.inputs[1].default_value = rim_scale
    sc.use_clamp = True
    nt.links.new(pw.outputs[0], sc.inputs[0])
    rim = sc.outputs[0]
    colmix = nt.nodes.new("ShaderNodeMix")
    colmix.data_type = "RGBA"
    colmix.inputs["A"].default_value = (*hex_rgb(tint_hex), 1)
    colmix.inputs["B"].default_value = (*hex_rgb(rim_hex), 1)
    nt.links.new(rim, colmix.inputs["Factor"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(colmix.outputs["Result"], em.inputs["Color"])
    gl = nt.nodes.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.05
    glm = nt.nodes.new("ShaderNodeMixShader")
    glm.inputs["Fac"].default_value = 0.35
    tr0 = nt.nodes.new("ShaderNodeBsdfTransparent")
    nt.links.new(tr0.outputs[0], glm.inputs[1])
    nt.links.new(gl.outputs[0], glm.inputs[2])
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(em.outputs[0], add.inputs[0])
    nt.links.new(glm.outputs[0], add.inputs[1])
    amix = nt.nodes.new("ShaderNodeMapRange")
    amix.inputs["From Min"].default_value = 0.0
    amix.inputs["From Max"].default_value = 1.0
    amix.inputs["To Min"].default_value = base_alpha
    amix.inputs["To Max"].default_value = 0.92
    nt.links.new(rim, amix.inputs["Value"])
    back = nt.nodes.new("ShaderNodeMath")
    back.operation = "MULTIPLY_ADD"
    back.inputs[1].default_value = -0.5
    back.inputs[2].default_value = 1.0
    nt.links.new(geo.outputs["Backfacing"], back.inputs[0])
    alpha = nt.nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    nt.links.new(amix.outputs["Result"], alpha.inputs[0])
    nt.links.new(back.outputs[0], alpha.inputs[1])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    final = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(alpha.outputs[0], final.inputs["Fac"])
    nt.links.new(tr.outputs[0], final.inputs[1])
    nt.links.new(add.outputs[0], final.inputs[2])
    nt.links.new(final.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    mat.use_backface_culling = False
    mat.show_transparent_back = True


def apply_xray(exploded: bool = False, mobile: bool = False) -> None:
    body = bpy.data.materials.get("mat_body_xray")
    glass = bpy.data.materials.get("mat_glass_xray")
    if body:
        xray_material(body, 2.2 if mobile else 2.6, 1.0, 0.10 if exploded else 0.22, "#123642", "#9FE9FF")
    if glass:
        xray_material(glass, 3.2, 0.7, 0.06, "#9FE9FF", "#9FE9FF")


def paint_material(mat: bpy.types.Material, hex_col: str, metallic: float, rough: float, coat: float, alpha: float = 1.0) -> None:
    """Study material for shell smoothness checks (reflections expose lumps); never exported."""
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*hex_rgb(hex_col), 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.03
    b.inputs["Alpha"].default_value = alpha
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED" if alpha < 1 else "DITHERED"
    mat.use_backface_culling = False


def apply_paint() -> None:
    body = bpy.data.materials.get("mat_body_xray")
    glass = bpy.data.materials.get("mat_glass_xray")
    if body:
        paint_material(body, "#7D858C", 0.0, 0.22, 1.0)
    if glass:
        paint_material(glass, "#0B0E10", 0.0, 0.02, 0.0, 0.85)


def color_management() -> None:
    s = bpy.context.scene
    s.view_settings.view_transform = "Khronos PBR Neutral"
    s.view_settings.look = "None"
    s.view_settings.exposure = 0.0
    s.view_settings.gamma = 1.0
    s.display_settings.display_device = "sRGB"


def eevee(samples: int = 32) -> None:
    s = bpy.context.scene
    s.render.engine = "BLENDER_EEVEE"
    s.eevee.taa_render_samples = samples
    s.eevee.use_raytracing = False
    s.eevee.use_shadows = True
    s.render.filter_size = 1.5


def cycles(samples: int = 128) -> None:
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "OPTIX"
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        s.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 - CPU fallback
        s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.01
    s.cycles.use_denoising = True
    try:
        s.cycles.denoiser = "OPTIX"
    except TypeError:
        s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 6


def set_output(path: str, w: int, h: int, transparent: bool = False) -> None:
    r = bpy.context.scene.render
    r.resolution_x = w
    r.resolution_y = h
    r.resolution_percentage = 100
    r.film_transparent = transparent
    r.image_settings.media_type = "IMAGE"
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA" if transparent else "RGB"
    r.image_settings.color_depth = "8"
    r.filepath = path
