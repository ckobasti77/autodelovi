"""PBR material library — slot names are the contract (docs/3D-CONTRACT.md §F5 + mat_core_fins).

Values from docs/design/DESIGN-SYSTEM.md §7.3 (base colours given as sRGB hex, converted to
linear here). Principled inputs only; normal maps are image textures (exported as normalTexture).
"""

from __future__ import annotations

import bpy

from .textures import TEX_DIR


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))  # type: ignore[return-value]


# name: (hex, metallic, roughness, extras)
LIBRARY: dict[str, tuple[str, float, float, dict]] = {
    "mat_body_xray": ("#123642", 0.0, 0.5, {"override": "xray-body"}),
    "mat_glass_xray": ("#9FE9FF", 0.0, 0.05, {"override": "xray-glass"}),
    "mat_glass_lens": ("#DDE6EA", 0.0, 0.05, {"alpha": 0.25}),
    "mat_cast_iron": ("#5A5C5E", 1.0, 0.72, {}),
    "mat_machined_steel": ("#A9ADB1", 1.0, 0.28, {"normal": ("tex_machined_n", 0.35)}),
    "mat_steel_dark": ("#3A3D40", 1.0, 0.55, {}),
    "mat_brushed_alu": ("#C4C7CA", 1.0, 0.35, {}),
    "mat_cast_alu": ("#A7A9AB", 1.0, 0.55, {}),
    "mat_painted_black": ("#151617", 0.0, 0.45, {"coat": 0.3}),
    "mat_plastic_black": ("#121314", 0.0, 0.60, {}),
    "mat_plastic_grey": ("#3B3E41", 0.0, 0.55, {}),
    "mat_rubber": ("#1A1A1B", 0.0, 0.85, {}),
    "mat_tyre": ("#1C1C1D", 0.0, 0.90, {"normal": ("tex_tyre_n", 1.0)}),
    "mat_hose": ("#202122", 0.0, 0.75, {}),
    "mat_chrome": ("#E3E5E7", 1.0, 0.08, {}),
    "mat_copper": ("#B87333", 1.0, 0.35, {}),
    "mat_ceramic": ("#D9D6CF", 0.0, 0.40, {}),
    "mat_caliper": ("#2E3136", 0.3, 0.40, {}),
    "mat_battery": ("#1E2022", 0.0, 0.50, {}),
    "mat_heat_shield": ("#9C9FA2", 1.0, 0.45, {"normal": ("tex_emboss_n", 0.8)}),
    "mat_wire": ("#2A2C2E", 0.0, 0.60, {}),
    "mat_emissive_led": ("#F4F1EA", 0.0, 0.30, {"emission": ("#F4F1EA", 1.5)}),
    "mat_emissive_tail": ("#5A0F12", 0.0, 0.35, {"emission": ("#B3261E", 0.8)}),
    "mat_core_fins": ("#4A4E52", 0.6, 0.50, {"normal": ("tex_fins_n", 1.0)}),
}

XRAY = {"mat_body_xray", "mat_glass_xray"}


def _principled(mat: bpy.types.Material) -> tuple[bpy.types.Node, bpy.types.NodeTree]:
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return bsdf, nt


def load_texture(name: str) -> bpy.types.Image:
    img = bpy.data.images.get(f"{name}.png")
    if img is None:
        img = bpy.data.images.load(str(TEX_DIR / f"{name}.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    return img


def build_library() -> dict[str, bpy.types.Material]:
    mats = {}
    for name, (hx, metal, rough, extra) in LIBRARY.items():
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        bsdf, nt = _principled(mat)
        r, g, b = hex_rgb(hx)
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
        if "coat" in extra:
            bsdf.inputs["Coat Weight"].default_value = extra["coat"]
            bsdf.inputs["Coat Roughness"].default_value = 0.25
        if "emission" in extra:
            ehx, strength = extra["emission"]
            er, eg, eb = hex_rgb(ehx)
            bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
            bsdf.inputs["Emission Strength"].default_value = strength
        if "alpha" in extra:
            bsdf.inputs["Alpha"].default_value = extra["alpha"]
            mat.surface_render_method = "BLENDED"
        if "normal" in extra:
            tex_name, strength = extra["normal"]
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = load_texture(tex_name)
            tex.location = (-500, -200)
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = strength
            nm.location = (-200, -200)
            nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        mat.diffuse_color = (r, g, b, 1.0)
        mat.metallic = metal
        mat.roughness = rough
        mats[name] = mat
    return mats


def manifest_materials(used: set[str]) -> list[dict]:
    out = []
    for name in LIBRARY:
        if name not in used:
            continue
        entry: dict = {"name": name}
        if "override" in LIBRARY[name][3]:
            entry["override"] = LIBRARY[name][3]["override"]
        out.append(entry)
    return out
