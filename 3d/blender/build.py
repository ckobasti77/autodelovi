"""Entry: build the car (or selected modules) and save the .blend.

  blender -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- \
      [--quality desktop|lite] [--only wheels,brakes] [--out 3d/build/car.blend]

Without --only the scene is rebuilt from scratch. With --only the existing .blend is opened,
objects tagged sk_builder=<module> are deleted and those modules rebuilt; any node still missing
afterwards is filled with a graybox proxy.
"""

from __future__ import annotations

import argparse
import importlib
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from lib import scene  # noqa: E402
from lib.materials import build_library  # noqa: E402
from lib.parts import BuildContext, report  # noqa: E402
from lib.textures import generate_all  # noqa: E402

MODULES = [
    "wheels",
    "brakes",
    "suspension",
    "steering",
    "engine",
    "turbo",
    "intake",
    "fuel",
    "belts",
    "electrical",
    "cooling",
    "drivetrain",
    "exhaust",
    "body",
    "lighting",
]


def parse():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", default="desktop", choices=["desktop", "lite"])
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default="")
    ap.add_argument("--skip-textures", action="store_true")
    return ap.parse_args(argv)


def main() -> None:
    scene.check_version()
    args = parse()
    out = Path(args.out) if args.out else scene.BUILD / ("car.blend" if args.quality == "desktop" else "car-lite.blend")
    if not out.is_absolute():
        out = scene.ROOT / out
    only = [m for m in args.only.split(",") if m]
    t0 = time.time()
    if only and out.exists():
        bpy.ops.wm.open_mainfile(filepath=str(out))
        for m in only + ["proxy"]:
            k = scene.delete_by_builder(m)
            scene.log(f"removed {k} nodes of {m}")
        modules = only
    else:
        scene.reset_scene()
        if not args.skip_textures:
            generate_all()
        modules = MODULES
    build_library()
    scene.root()
    ctx = BuildContext(quality=args.quality)
    for m in modules:
        try:
            mod = importlib.import_module(f"parts.{m}")
        except ModuleNotFoundError as e:
            if e.name == f"parts.{m}":
                scene.log(f"module {m}: not written yet (proxies)")
                continue
            raise
        ctx.module = m
        t = time.time()
        mod.build(ctx)
        scene.log(f"module {m}: {time.time() - t:.1f}s")
    ctx.module = "proxy"
    importlib.import_module("parts.proxy").build(ctx)
    report()
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out), compress=True)
    scene.log(f"saved {out} in {time.time() - t0:.1f}s")


main()
