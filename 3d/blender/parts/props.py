"""Service props for category thumbnails only (never exported): filters and fluids.

Generic, unbranded shapes: no text, no logos. Built at the scene origin on the ground (y = 0).
"""

from __future__ import annotations

import math

import bpy

from lib import scene
from lib.finish import geo_to_object
from lib.geo import Geo, R, box, cylinder, extrude, lathe, loft, rounded_rect, superellipse2d

PAPER = "mat_ceramic"  # warm off-white filter media
FRAME = "mat_rubber"  # polyurethane frame
CAN = "mat_painted_black"
STEEL = "mat_machined_steel"
ALU = "mat_brushed_alu"
GREY = "mat_plastic_grey"
BLACK = "mat_plastic_black"
CARBON = "mat_steel_dark"


def oil_filter() -> Geo:
    g = Geo()
    seg = 64
    body = [(0.0, 0.000), (0.036, 0.000), (0.039, 0.004), (0.0385, 0.085), (0.036, 0.096), (0.028, 0.102), (0.0, 0.104)]
    g += lathe(body, seg, CAN, hard=False)
    # grip flutes near the dome
    for k in range(24):
        a = 360.0 * k / 24
        rib = box(0.004, 0.018, 0.003, CAN, center=(0.0395, 0.082, 0.0)).transform(R("y", a))
        g += rib
    # base plate, gasket, threaded boss and inlet holes
    g += lathe([(0.012, -0.006), (0.034, -0.006), (0.036, -0.002), (0.036, 0.000), (0.012, 0.000)], seg, STEEL, hard=False)
    g += lathe([(0.027, -0.012), (0.033, -0.012), (0.033, -0.006), (0.027, -0.006), (0.027, -0.012)], seg, "mat_rubber", hard=False)
    g += lathe([(0.009, -0.014), (0.012, -0.014), (0.012, -0.006), (0.009, -0.006), (0.009, -0.014)], 32, STEEL, hard=False)
    return g.transform(R("x", 180)).moved(0, 0.104, 0)


def pleated_panel(w: float, d: float, h: float, pleats: int, media: str, frame: str) -> Geo:
    g = Geo()
    # frame: rounded rectangle ring (extrude with a hole) + a thin seal lip
    outer = rounded_rect(w, d, 0.010, 3)
    inner = rounded_rect(w - 0.022, d - 0.022, 0.004, 2)
    fr = extrude(outer, h, frame, holes=[inner], z0=0.0)
    g += fr.transform(R("x", -90))
    # pleats: zig-zag sheet spanning the inner opening
    iw, idp = w - 0.022, d - 0.022
    xs = [-iw / 2 + iw * k / (pleats * 2) for k in range(pleats * 2 + 1)]
    for k in range(len(xs) - 1):
        x0, x1 = xs[k], xs[k + 1]
        y0 = h * (0.92 if k % 2 == 0 else 0.10)
        y1 = h * (0.10 if k % 2 == 0 else 0.92)
        a = g.v((x0, y0, -idp / 2))
        b = g.v((x1, y1, -idp / 2))
        c = g.v((x1, y1, idp / 2))
        e = g.v((x0, y0, idp / 2))
        g.f((a, b, c, e), media, None, False)
    return g


def fuel_filter() -> Geo:
    g = Geo()
    seg = 56
    prof = [(0.0, 0.0), (0.030, 0.0), (0.040, 0.012), (0.041, 0.020), (0.041, 0.140), (0.040, 0.148), (0.030, 0.160), (0.0, 0.160)]
    g += lathe(prof, seg, ALU, hard=False)
    for y in (0.035, 0.125):
        g += lathe([(0.041, y), (0.0425, y + 0.002), (0.0425, y + 0.008), (0.041, y + 0.010)], seg, ALU, hard=False)
    for y0, y1 in ((-0.030, 0.0), (0.160, 0.190)):
        g += lathe([(0.0, y0), (0.006, y0), (0.006, y1), (0.0, y1)], 20, STEEL, hard=False)
        yb = y0 + 0.010 if y0 < 0 else y1 - 0.012
        g += lathe([(0.006, yb), (0.0078, yb + 0.002), (0.0078, yb + 0.006), (0.006, yb + 0.008)], 20, STEEL, hard=False)
    # lay it down on the ground, axis along x
    return g.transform(R("z", 90)).moved(0.08, 0.041, 0.0)


def oil_jug(scale: float = 1.0, handle: bool = True) -> Geo:
    g = Geo()
    n = 32
    secs = []
    for y, s in ((0.000, 0.96), (0.008, 1.0), (0.200, 1.0), (0.235, 0.88), (0.255, 0.55)):
        pts = superellipse2d(0.085 * s, 0.060 * s, 4.0, n)
        secs.append([(px, y, pz) for px, pz in pts])
    g += loft(secs, GREY, closed=True, caps=True, hard=False)
    # neck + cap
    g += lathe([(0.0, 0.250), (0.024, 0.250), (0.024, 0.275), (0.0, 0.276)], 28, GREY, hard=False).moved(0.035, 0.0, 0.0)
    g += lathe([(0.0, 0.275), (0.027, 0.275), (0.028, 0.280), (0.028, 0.300), (0.024, 0.305), (0.0, 0.305)], 28, BLACK, hard=False).moved(0.035, 0.0, 0.0)
    if handle:
        hnd = extrude(rounded_rect(0.090, 0.110, 0.030, 4), 0.030, GREY, holes=[rounded_rect(0.050, 0.070, 0.018, 3)], z0=-0.015)
        g += hnd.moved(-0.045, 0.215, 0.0)
    return g.transform(__import__("lib.geo", fromlist=["S"]).S(scale))


def build_props() -> dict[str, list[bpy.types.Object]]:
    """Creates the prop objects in the HELPERS collection, hidden from render by default."""
    coll = scene.helper_collection()
    out: dict[str, list[bpy.types.Object]] = {}

    def make(name: str, geo: Geo) -> bpy.types.Object:
        existing = bpy.data.objects.get(name)
        if existing is not None:
            bpy.data.objects.remove(existing, do_unlink=True)
        o = geo_to_object(geo, name, None, coll, bevel=0.0)
        o.hide_render = True
        return o

    out["filter-ulja"] = [make("prop_oil_filter", oil_filter())]
    out["filter-vazduha"] = [make("prop_air_filter", pleated_panel(0.300, 0.200, 0.050, 22, PAPER, FRAME))]
    out["filter-goriva"] = [make("prop_fuel_filter", fuel_filter())]
    cab = pleated_panel(0.250, 0.200, 0.032, 26, CARBON, FRAME)
    out["filter-kabine"] = [make("prop_cabin_filter", cab)]
    group = Geo()
    group += oil_filter().moved(-0.05, 0.0, 0.16)
    group += pleated_panel(0.300, 0.200, 0.050, 22, PAPER, FRAME).moved(0.02, 0.0, -0.10)
    group += fuel_filter().moved(0.18, 0.0, 0.12)
    group += pleated_panel(0.250, 0.200, 0.032, 26, CARBON, FRAME).transform(R("y", 20)).moved(-0.30, 0.0, -0.02)
    out["filteri"] = [make("prop_filters", group)]
    fluids = Geo()
    fluids += oil_jug(1.0, True)
    fluids += oil_jug(0.62, False).transform(R("y", -25)).moved(0.19, 0.0, 0.06)
    out["ulja-tecnosti"] = [make("prop_fluids", fluids)]
    return out


_ = math
