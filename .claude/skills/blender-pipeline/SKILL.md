---
name: blender-pipeline
description: How this project builds its 3D exploded car in Blender headlessly from versioned Python scripts, renders QA images, and exports an optimized GLB + manifest for the web. Use for ANY Blender or 3D-asset work in this repo - modeling parts, materials, exploded-view data, renders, posters, thumbnails, GLB export, optimization and validation against docs/3D-CONTRACT.md.
---

# Blender pipeline (headless, scripted, reproducible)

## Golden rules
1. **Blender is driven only by versioned Python scripts** in `3d/blender/`, run with the Blender command line. No GUI session, no manual edits. Rebuilding from scratch must reproduce the asset. (If Blender MCP tools happen to be available, use them only to inspect.)
2. **Every clickable part follows docs/3D-CONTRACT.md** (node names, categories, material slots). The manifest is generated from the scene, never hand-written.
3. **Look at your renders.** After every geometry or material change, render the QA views and open the PNGs with the Read tool. Judge them like an art director and fix before moving on.
4. **Real-world scale**: 1 Blender unit = 1 meter. Blender is Z-up; the glTF exporter converts to Y-up.

## Running Blender
- The executable path is in the `BLENDER_EXE` environment variable (also in pipeline/env/ENVIRONMENT.md). The path contains spaces — always quote it.
- Git Bash: `"$BLENDER_EXE" -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- --out 3d/build/car.blend`
- PowerShell: `& $env:BLENDER_EXE -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- --out 3d/build/car.blend`
- Script arguments come after `--`: `argv = sys.argv[sys.argv.index("--") + 1:]`.
- `--python-exit-code 1` turns Python exceptions into a non-zero exit. Always check the exit code and stderr.
- Keep each command under ~20 minutes (split render batches). Print progress lines so logs show life.
- Check the version first: `"$BLENDER_EXE" -b --version`. APIs differ between 4.2 LTS, 4.5 LTS and 5.x — branch on `bpy.app.version` and consult https://docs.blender.org/api/<major.minor>/ with WebFetch when unsure.

## Script architecture
```
3d/blender/
  build.py            entry: reset scene, build all systems (or --only <system>), save .blend
  lib/scene.py        units, collections, cleanup, naming + custom-property helpers
  lib/materials.py    PBR material library (names = contract material slots)
  lib/modeling.py     bevel / solidify / array / spin / screw helpers, bmesh utilities, weighted normals, apply modifiers
  parts/<system>.py   body, engine, turbo, intake, cooling, exhaust, brakes, suspension, steering, drivetrain, electrical, lighting, wheels, interior
  export.py           GLB export + manifest JSON from scene data
  render.py           QA views, posters, category thumbnails
3d/scripts/            Node: optimize.mjs (gltf-transform), validate.mjs, images.mjs (sharp: PNG → WebP / AVIF)
3d/assets/hdri/        CC0 HDRIs (Poly Haven)
3d/build/              .blend output
3d/renders/            QA renders (git-ignored)
```

## Hard-surface quality checklist
- Bevel every visible hard edge (Bevel modifier, 2–3 segments, angle limit ~30°, harden normals) and add a Weighted Normal modifier after it.
- Smoothing: Blender 4.1+ removed Auto Smooth — use `mesh.shade_smooth()` + `mesh.set_sharp_from_angle(angle=...)` or the "Smooth by Angle" modifier; custom normals must survive export.
- No n-gons on curved surfaces that get subdivided; support loops where curvature must stay tight.
- Avoid booleans on final meshes unless you clean the result; prefer modeling cuts directly.
- Density targets: mid-poly (brake disc 4–8k tris, turbo 15–30k, engine block 20–40k, body panels 5–20k each). Respect the total budget in the contract.
- Normals outside, no flipped faces, no zero-area faces, no interpenetrating parts in the assembled state.
- Apply rotation and scale before export; keep location — each part's origin sits at its geometric center or mounting point, because explode vectors move object locations in three.js.

## Materials (glTF-friendly)
- Principled BSDF with glTF-compatible inputs only (Base Color, Metallic, Roughness, Normal, Emission, Alpha; Coat / Transmission via glTF extensions). In 4.x the inputs are named "Coat Weight", "Transmission Weight", "Emission Color", "Specular IOR Level".
- Procedural node trees do **not** export. Bake them (Cycles bake to 1K/2K) or use flat values.
- Material names = contract slots (e.g. `mat_cast_iron`, `mat_brushed_alu`, `mat_painted_body`, `mat_rubber`, `mat_chrome`, `mat_glass_clear`, `mat_glass_lens`, `mat_plastic_black`, `mat_copper`, `mat_emissive_led`). three.js overrides some by name (the X-ray body).

## Exploded-view data
- On every part object set custom properties: `part_id`, `category`, `system`, `label_sr`, `explode_dir` (normalized, **document the axis convention** — Blender Z-up or glTF Y-up), `explode_dist` (meters), `explode_stage` (int), optional `focus_cam`.
- Export with `export_extras=True` so these land in node `extras`; `export.py` builds `public/models/car.manifest.json` from them.

## Export
- Example: `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB', export_apply=True, export_extras=True, export_yup=True, export_materials='EXPORT', export_image_format='AUTO')`.
- Argument names change across versions — when one errors, list them: `bpy.ops.export_scene.gltf.get_rna_type().properties.keys()`.
- Optimize afterwards with gltf-transform (check `npx @gltf-transform/cli --help` for current flags): dedup, weld, prune, **meshopt** compression, WebP textures, max texture size 2048. The web side uses the Meshopt decoder.

## Rendering
- Engine enum names differ by version (`BLENDER_EEVEE_NEXT` in 4.2–4.4, `BLENDER_EEVEE` again later). Read valid values from `bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()`.
- EEVEE for fast QA; Cycles (GPU if available, else CPU with adaptive sampling + denoising) for posters.
- Lighting: a CC0 HDRI from Poly Haven (2K .hdr/.exr in 3d/assets/hdri/) + key and rim area lights; dark neutral studio for QA; transparent film for thumbnails.
- Standard QA views: front 3/4, rear 3/4, side, top, exploded 3/4, plus close-ups per system. QA 1600×1000; posters 2560 wide; thumbnails 768×768 transparent.
- Outputs: `3d/renders/qa/<timestamp>/*.png`; posters → `public/images/hero/`; thumbnails → `public/images/parts/<category>.webp` (convert with sharp).
- Always open renders with the Read tool and record verdicts in docs/3d/QA.md.

## Validation (must pass before hand-off)
`3d/scripts/validate.mjs` (@gltf-transform/core): node names vs. manifest, category coverage, triangle count, file size, materials present, no missing textures, sane bounding boxes (car length ≈ 4.2–4.4 m).

## Pitfalls
- `bpy.ops` needs the right context in background mode. Prefer `bpy.data` + bmesh; when an operator is needed, use `bpy.context.temp_override(...)` with the object selected and active.
- Coplanar faces z-fight (decals, labels) — offset by ~0.5 mm.
- The X-ray body: export it opaque with its slot name; three.js swaps in the X-ray shader.
- Windows paths: use forward slashes or raw strings in Python; the project path contains spaces.
