# 3D build notes (SKLOP exploded X-ray car)

Everything in `public/models/`, `public/images/hero/` and `public/images/parts/` is generated from
versioned scripts — never edit a GLB, the manifest or an image by hand. The plan behind the build
is `docs/3d/PLAN.md`; the runtime contract is `docs/3D-CONTRACT.md` (F1–F8); QA verdicts are in
`docs/3d/QA.md`.

## 1. Rebuild everything

Requirements: Blender 5.1 (`BLENDER_EXE`, see `pipeline/env/ENVIRONMENT.md`), Node 22, the npm
dependencies (`@gltf-transform/*`, `meshoptimizer`, `sharp`, `gltf-validator`, `three`,
`@playwright/test`), the studio HDRI in `3d/assets/hdri/studio_small_09_2k.hdr` (git-ignored; CC0,
Poly Haven: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr`; without
it the renders fall back to Blender's bundled CC0 `studio.exr`).

```bash
npm run 3d                 # node 3d/scripts/run.mjs — all stages, about 5 minutes on the RTX 4060
node 3d/scripts/run.mjs build export optimize validate   # selected stages, in this order
npm run 3d:validate        # budgets, names, extras, coverage, files, reports (exit 1 on errors)
npm run 3d:preview         # headless Chromium: loads both GLBs with three.js + meshopt, screenshots
```

| Stage | Command (inside `run.mjs`) | Output |
|---|---|---|
| taxonomy | `node 3d/scripts/taxonomy-json.mjs` | `3d/build/taxonomy.json` (from `lib/catalog/taxonomy.ts`) |
| build | `blender -b -P 3d/blender/build.py -- --quality desktop` and `--quality lite` | `3d/build/car.blend`, `car-lite.blend`, `pivots.json`; normal-map PNGs in `3d/assets/textures/` |
| explode | `blender -b 3d/build/car.blend -P 3d/blender/explode.py -- --solve --audit` | `3d/build/explode.tuned.json`, `3d/build/reports/{packaging,motion,visibility}.json` |
| export | `blender -b <blend> -P 3d/blender/export.py -- --quality desktop|lite` | `3d/build/car.raw.glb`, `car-lite.raw.glb`, `manifest.base.json` |
| optimize | `node 3d/scripts/optimize.mjs` | `public/models/car.glb`, `car-lite.glb`, `car.manifest.json`; `3d/build/*.qa.glb` (quantized, uncompressed, re-importable) |
| posters | `blender -b 3d/build/car.blend -P 3d/blender/posters.py -- --set all` | layers per state × crop (desktop, tablet, mobile) in `3d/renders/posters/`, `3d/build/env/studio-512.hdr` |
| env | `node 3d/scripts/env.mjs [--cube 64]` | `public/models/env/studio-pmrem.hdr` (three's PMREM cube-UV atlas, baked in headless Chromium, D243) |
| images | `node 3d/scripts/images.mjs` | `public/images/hero/car-*.{avif,webp}`, `public/models/car-shadow{,-exploded}.webp` |
| thumbs | `blender -b 3d/build/car.blend -P 3d/blender/thumbs.py` + `node 3d/scripts/thumbs.mjs` | `public/images/parts/<slug>.webp` (48) |
| validate | `node 3d/scripts/validate.mjs` | PASS/FAIL table |

A partial rebuild of one system is fast: `blender -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- --only brakes`
opens `3d/build/car.blend`, deletes exactly the objects tagged `sk_builder = brakes`, rebuilds them and saves.
Run the explode/export/optimize/validate stages afterwards (the reports record a `scriptsHash`;
the validator warns when they are stale).

QA helpers (renders go to the git-ignored `3d/renders/qa/<tag>/`):

```bash
blender -b 3d/build/car.blend -P 3d/blender/render.py -- --set qa --views front34,rear34,side,top,front,exploded,exploded_m [--paint] [--noshell] --tag name
blender -b 3d/build/car.blend -P 3d/blender/render.py -- --set closeup --nodes part__turbina__main --az 150 --el 20 --solo --tag turbo
node 3d/scripts/qa-closeups.mjs [--only f04,f08] [--prefix final]   # the 18 QA close-ups f01–f18 + sheets in 3d/renders/preview/
blender -b 3d/build/car.blend -P 3d/blender/check_shell.py      # opaque parts poking through the body
blender -b 3d/build/car.blend -P 3d/blender/stats.py            # triangles per part
node 3d/scripts/contact-sheet.mjs out.png 6 motor turbina …    # thumbnail sheet on the card colour
```

## 2. Where things live

| Path | Content |
|---|---|
| `3d/blender/config/vehicle.py` | hard points: dimensions, axles, tyre, engine position/tilt, strut, rack, shut lines |
| `3d/blender/config/explode.py` | explode intent per node (`dir`, `dist`, `order`) + stage spread; `explode.tuned.json` overrides |
| `3d/blender/config/contacts.py` | reviewed assembled contacts (bolted, pressed, meshing, hoses on nozzles) |
| `3d/blender/config/thumbs.py` | thumbnail compositions (kits, rows, yaw, camera overrides) |
| `3d/blender/lib/` | `geo.py` (Geo container + lathe/extrude/sweep/loft/…), `bodyshell.py` (master surface), `parts.py` (part registry, lite material caps, pivots), `materials.py` (24 slots), `textures.py`, `views.py` (cameras, rigs, X-ray shader, explode timing), `layout.py` (camera solver) |
| `3d/blender/parts/<module>.py` | one builder per system: wheels, brakes, suspension, steering, engine, turbo, intake, fuel, belts, electrical, cooling, drivetrain, exhaust, body, lighting; `props.py` (thumbnail-only service props), `proxy.py` (graybox fallback) |

Space: glTF/vehicle space in meters, +Y up, +Z front, +X left. Scripts author in vehicle space
through `V(x, y, z)` → Blender `(x, −z, y)`.

## 3. Swap one part for a purchased model

The runtime only relies on the **part node** (`part__<category>__<instance>`: name, translation =
pivot, extras) — the geometry below it is free to change.

1. Check the licence (commercial web use, no redistribution clause issues) and log it in `docs/DECISIONS.md`. No logos or brand text on the model (styling guard, PLAN §1).
2. Put the source file in `3d/assets/purchased/<slug>/` (add a `LICENSE.txt` next to it).
3. In the system module (e.g. `parts/turbo.py`), replace the builder for that node with an import:
   load the file with `bpy.ops.import_scene.gltf` / `.fbx` / `.obj` under `bpy.context.temp_override`,
   join its meshes into one object, apply transforms, scale to meters, and orient it into vehicle
   space at the same position as the procedural part (compare bounding boxes with `stats.py` and a
   close-up render). Then call `ctx.add_part(category, instance, pivot, geo=None, …)` style code that
   parents the object as the single child `mesh__<category>__<instance>__0` (see `lib/parts.py`
   `add_part`; the helper `link_mesh_object` attaches an existing mesh).
4. Re-assign its materials to contract slots only (`lib/materials.py` names; ≤ 24 total). Bake any
   procedural shading to a texture ≤ 1024² or use flat PBR values.
5. Keep the triangle budget: `stats.py` per part, the validator per file (desktop ≤ 800 k, lite ≤ 250 k).
   For the lite build, decimate the imported mesh (`Decimate` modifier, ratio ~0.4) when `ctx.lite`.
6. Rebuild that module (`--only turbo`), then `explode`, `export`, `optimize`, `thumbs --only turbina`,
   `images` if the part shows in the posters, and `validate`. Check the packaging report (new contacts
   must be reviewed before they are added to `config/contacts.py`).

## 4. Add a part (new clickable node)

1. Taxonomy first: add the instance (and its Serbian `labelSr` in `INSTANCE_LABELS`) or the category in
   `lib/catalog/taxonomy.ts`; slugs are frozen once live (contract F1). Run `npm run test:unit`
   (the taxonomy/label and manifest tests will fail until the model exists).
2. `node 3d/scripts/taxonomy-json.mjs`.
3. Model it in the right `parts/<system>.py` with `add_centered(ctx, "<category>", "<instance>", geo, …)`
   (pivot = bounding-box centre) or `ctx.add_part(…)` with an explicit mounting-point pivot. Use contract
   material slots only.
4. Add its explode intent in `config/explode.py` (`e("<category>__<instance>", dir, dist, order)`;
   `lr()`/`corners()` mirror right-hand instances) and, for a new category, a thumbnail composition in
   `config/thumbs.py` if the default instance is not the best view.
5. Run the full pipeline (`npm run 3d`). Fix packaging overlaps (or declare reviewed contacts), final
   collisions and visibility errors reported by `explode.py`; look at the QA, close-up and exploded
   renders; record the verdict in `docs/3d/QA.md`.

## 5. Tuning the exploded layout

`config/explode.py` holds the intent (directions in vehicle space, distances in meters, `order` 0–1
inside the stage) and `STAGE_SPREAD` (distance multipliers per stage). `explode.py --solve` runs a
local search on every opaque part that still overlaps or sits closer than 20 mm to another part at
p = 1 (the later part of the pair moves; candidates: direction rotated ±12°/±24° about each axis or
distance × 0.85/1.15/1.3; fewest conflicts wins, then the smallest change) and writes only the
changed nodes to `3d/build/explode.tuned.json` (D92); `--check` reports assembled contacts, final
overlaps, clearances (< 20 mm = error, < 35 mm = „tight“) and pass-throughs on the desktop and mobile
timelines; `--audit` renders Workbench ID passes from both exploded cameras and requires visible/solo
≥ 0.40 per part (0.25 for buried parts; right-hand twins may hide when the left twin passes). Delete
`explode.tuned.json` to return to the intent table.

Budget notes: small hardware in the categories listed in `DETAIL_MERGE` (`lib/parts.py`) reuses a
material slot the part already has, so new bolts and plugs add no draw calls (desktop 213 of 220,
D91). Fine casting texture comes from the tiling `tex_cast_n` normal map (D90), not from geometry.

## 6. Known limits (v1)

- The body is a stylised parametric shell (no licensed car); panels are single surfaces with hems, no inner panels.
- Several routed parts pass briefly through neighbours while exploding (listed in `motion.json`); nothing overlaps at p = 1.
- The X-ray look follows DESIGN-SYSTEM §7.2 exactly; see `docs/DECISIONS.md` D88 before changing it (posters must be re-rendered with the same values the runtime uses).

## 7. Web runtime (step 10) — what the pipeline must keep in sync

- **X-ray values** live twice: `3d/blender/config/xray.py` (posters) and `constants/xray.ts` (runtime). `tests/unit/three/xray-parity.test.ts` parses the Python file and fails when they drift; change both, re-render the posters (`npm run 3d`) and re-run `node scripts/qa/hero-parity.mjs` (mean poster ↔ canvas difference should stay near 2/255, see `docs/3d/WEB-QA.md`).
- **Cameras**: the canvas reproduces the posters' framing from the manifest cameras (`object-fit: contain` via `setViewOffset`); a camera change needs new posters, or the crossfade jumps.
- **Nodes and manifest**: the runtime reads only what `lib/three/manifestGuard.ts` checks (node names, categories, pivots, explode vectors/stages/order, label anchors, bboxes, focus, cameras). A new clickable node needs a taxonomy entry, a manifest entry and a `PART_NOTES` line (`lib/catalog/partNotes.ts`) for the hover callout.
- **Shadows and environment**: `public/models/car-shadow*.webp` and `public/models/env/studio-pmrem.hdr` are loaded by the runtime as they are; keep their orientation (F7.7). The environment is a pre-filtered cube-UV atlas: rebake it (`env` stage) whenever the HDRI or the three version changes.
- **Cameras per crop** live once in `3d/blender/lib/views.py` (`CAMERAS`, read by export, posters, the explode audit and QA renders): desktop 16:9, tablet 1:1, mobile 4:5 (D240). After a change run `export optimize posters images` and `explode.py -- --audit` (the exploded cameras must keep every part visible).
- **Thumbnails** (`thumbs` stage): silhouette framed to 70 % of the frame at 48 % height, and an exposure floor from a probe render so every part's mean luminance reaches 2:1 against the tile ground (D241). Check with `node scripts/qa/fix/hero-3d-assets-thumbs.mjs`.

