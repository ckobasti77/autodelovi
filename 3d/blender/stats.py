"""Entry: print triangle counts per part node (and per material) of a .blend."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402

rows = []
total = 0
for o in sorted(bpy.data.objects, key=lambda o: o.name):
    if o.type != "MESH":
        continue
    me = o.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    total += n
    top = o.parent.name if o.parent else o.name
    rows.append((n, top, len(me.materials), me.name))
filt = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 1 else ""
for n, top, mats, mesh in sorted(rows, reverse=True):
    if filt and filt not in top:
        continue
    print(f"STAT {n:7d}  mats {mats}  {top}  ({mesh})")
print(f"STAT total {total}")
