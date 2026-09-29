"""Report opaque parts that poke through the body shell (master surface), per part.

Run: "$BLENDER_EXE" -b --factory-startup 3d/build/car.blend --python-exit-code 1 -P 3d/blender/check_shell.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from lib.bodyshell import Z_MAX, Z_MIN, section  # noqa: E402
from lib.scene import to_vehicle  # noqa: E402

SKIP_CATS = {"hauba", "branici", "blatobrani", "vrata", "retrovizori", "stakla", "brisaci", "farovi", "stop-svetla", "felne-gume"}


def inside(poly, x, y) -> bool:
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                c = not c
    return c


def main() -> None:
    cache: dict[float, list] = {}
    rows = []
    for e in sorted((o for o in bpy.data.objects if o.name.startswith("part__")), key=lambda o: o.name):
        cat = e.name.split("__")[1]
        if cat in SKIP_CATS:
            continue
        worst, count, where = 0.0, 0, None
        for ch in e.children:
            if ch.type != "MESH":
                continue
            mw = ch.matrix_world
            for v in ch.data.vertices:
                p = Vector(to_vehicle(mw @ v.co))
                if not (Z_MIN < p.z < Z_MAX):
                    continue
                zk = round(p.z, 2)
                if zk not in cache:
                    prof = section(zk)
                    cache[zk] = (prof, [(0.0, prof[0][1])] + prof)
                prof, poly = cache[zk]
                if p.y <= prof[0][1] + 0.01:
                    continue
                if not inside(poly, abs(p.x), p.y):
                    # distance above the profile (vertical, near the top) as a severity hint
                    d = min(((abs(p.x) - a) ** 2 + (p.y - b) ** 2) ** 0.5 for a, b in prof)
                    count += 1
                    if d > worst:
                        worst, where = d, (round(p.x, 3), round(p.y, 3), round(p.z, 3))
        if count:
            rows.append((worst, e.name, count, where))
    for worst, name, count, where in sorted(rows, reverse=True):
        print(f"SHELL {name:55s} verts {count:5d}  max {worst * 1000:6.1f} mm at {where}")
    print(f"SHELL parts outside: {len(rows)}")


main()
