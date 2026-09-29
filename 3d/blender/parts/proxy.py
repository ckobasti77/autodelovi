"""Graybox proxies for every node no real builder produced (keeps the pipeline end to end)."""

from __future__ import annotations

from config.proxies import P, STATIC
from lib.geo import box
from lib.parts import BuildContext


def _proxy_geo(size, mats):
    g = box(*size, mats[0])
    for i in range(len(g.mats)):
        g.mats[i] = mats[i % len(mats)]
    return g


def build(ctx: BuildContext) -> None:
    import bpy

    n = 0
    for node, spec in P.items():
        name = f"part__{node}"
        if bpy.data.objects.get(name) is not None:
            continue
        cat, inst = node.split("__")
        e = ctx.add_part(cat, inst, spec["pivot"], _proxy_geo(spec["size"], spec["mats"]), bevel=0.0)
        e["sk_proxy"] = True
        if spec.get("thin"):
            e["sk_thin"] = True
        n += 1
    for name, spec in STATIC.items():
        if bpy.data.objects.get(name) is not None:
            continue
        o = ctx.add_static(name, spec["system"], _proxy_geo(spec["size"], spec["mats"]), pivot=spec["pivot"])
        o["sk_proxy"] = True
        n += 1
    print(f"[sklop] proxies: {n}", flush=True)
