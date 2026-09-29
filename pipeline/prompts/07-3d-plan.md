<!-- META | Korak 07 | Opus 5.5 | effort: max | sesija: NOVA | mode: plan -->
# Step 07 — 3D asset plan (Blender)

You are a senior technical 3D artist and real-time graphics engineer (automotive visualization, product configurators, glTF pipelines). In **plan mode** (no file edits), plan how to build SKLOP's exploded X-ray car entirely from Python scripts in headless Blender — at the highest quality achievable procedurally, within web budgets.

## Read first
pipeline/BRIEF.md §4 · docs/3D-CONTRACT.md · docs/design/DESIGN-SYSTEM.md (3D art direction, motion) · docs/ROUTES.md (where the 3D is used) · pipeline/env/ENVIRONMENT.md (Blender version and path).

## Skills to invoke (by name)
blender-pipeline (mandatory — follow it) · threejs-fundamentals · threejs-geometry · threejs-materials · threejs-loaders · threejs-lighting · threejs-interaction · threejs-postprocessing · 3d-scrollytelling.

## Check the tools (read-only commands are fine)
Run the Blender binary from BLENDER_EXE with `-b --version` to confirm the version, then look up that version's Python API details you will depend on (render engine enum names, glTF exporter arguments, smooth-by-angle, bmesh operators) on docs.blender.org with WebFetch.

## The plan must specify
1. **Vehicle spec** — generic compact hatchback (MQB-like): length / width / height, wheelbase, track, ride height, wheel and tyre size (e.g. 205/55 R16 ≈ 0.632 m diameter), left-hand drive, transverse engine. How to get a smooth, believable body with scripted modeling (e.g. a subdivision cage lofted from spline cross-sections, support loops, panel gaps with separate panel meshes: hood, doors, fenders, bumpers, tailgate, roof, glass, mirrors, lights).
2. **Part list** — every mesh with: node name (per the contract), category slug, system, Serbian label, modeling recipe (primitives / bmesh / modifiers), target triangle count, material slots, pivot, position in the car. Cover every 3D category of the contract; spend the most detail on what mechanics search most: turbina, kočnice, amortizeri, kvačilo, zupčasti kaiš i vodena pumpa, hladnjak, alternator, anlaser, akumulator, farovi.
3. **Detail strategy** — what gets real geometry vs. baked normal detail (radiator fins, tyre tread and sidewall pattern without text, heat-shield embossing), bevel and weighted-normal settings, how to avoid lumpy subdivision.
4. **Materials** — PBR library with names and values (cast iron, machined steel, brushed aluminium, anodized, painted metal, rubber, plastics, chrome, glass, lens, copper), texture plan (few, small, tileable, baked where needed), and what three.js overrides (the X-ray body).
5. **Explode design** — stages (1 body panels & glass → 2 wheels → 3 brakes & suspension → 4 engine ancillaries → 5 engine core & turbo → 6 transmission & driveshafts → 7 exhaust & underbody), direction / distance per part, a collision-free final layout that reads like a clean technical exploded drawing from the hero camera, stored as custom properties exported to glTF extras.
6. **Cameras** — hero framing (desktop / mobile) and per-category focus presets.
7. **Lighting & rendering** — which CC0 Poly Haven HDRI and at what resolution, light rig, EEVEE / Cycles settings for QA renders, posters (assembled + exploded, dark studio), transparent category thumbnails (one hero angle per category), resolutions and formats.
8. **Export & optimization** — glTF exporter settings for the installed version, the gltf-transform pipeline (dedup, weld, prune, meshopt, WebP textures, size caps), expected output size, manifest generation, what the validation script checks.
9. **Script architecture** — files and responsibilities under 3d/blender and 3d/scripts; how to run each stage idempotently; how to iterate on one system without rebuilding everything.
10. **QA protocol** — standard views, per-part checklist (proportion, bevels, normals, intersections, materials, naming), the "art director pass" criteria, how verdicts are recorded in docs/3d/QA.md.
11. **Order of work & time budget** — a build order that gets a complete, coherent car early and then deepens detail; fallback simplifications if time runs short.
12. **Risks** and mitigations.

## Output
Non-interactive run: output the **complete plan as your final message** (the orchestrator saves it to docs/plans/07-3d-plan.md). Then the Step report.
