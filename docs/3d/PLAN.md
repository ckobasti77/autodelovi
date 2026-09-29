# SKLOP — 3D asset plan (step 07; executed by step 08, polished by step 09)

## Context
The home hero is an exploded X-ray car (BRIEF §4). The body is a ghosted shell with a cold rim. Inside are 91 solid, realistic clickable nodes in 42 categories, and they explode in 7 scroll stages. Step 08 resumes this session and has a hard limit of 540 min (`pipeline/steps.json`). In that time it builds the car from versioned Python in headless Blender 5.1.1, exports a desktop GLB, a lite GLB and a manifest that satisfy `docs/3D-CONTRACT.md`, and renders posters and 48 thumbnails.

This plan fixes every decision step 08 needs. Honesty rule: the body is a stylised shell, and the detail budget goes to the parts mechanics search for most: turbina, kočnice, amortizeri, kvačilo, zupčasti kaiš + vodena pumpa, hladnjak, alternator, anlaser, akumulator, farovi.

**Inputs read:** BRIEF §4/§8/§9; 3D-CONTRACT F1–F8; DESIGN-SYSTEM §6.3, §7, §8; ROUTES; ARCHITECTURE §0.2; DECISIONS D7–D9 and D23; `lib/catalog/taxonomy.ts`; ENVIRONMENT.md; the step 08/09/10 prompts; the blender-pipeline, threejs-* and 3d-scrollytelling skills.

**Review:** two independent review agents checked the draft. One checked contract compliance and budgets. The other ran a numeric box and motion simulation of all 94 nodes. Their fixes are merged here.

What step 08 must deliver (from its prompt):
- Save this plan verbatim to `docs/3d/PLAN.md` before anything else.
- Keep a live checklist in `docs/progress/08.md`.
- Commit after each system.
- Posters: `public/images/hero/car-assembled` and `car-exploded`, 2560 px, AVIF + WebP.
- Thumbnails: `public/images/parts/<slug>.webp`, transparent, 768 px.
- `docs/3d/BUILD-NOTES.md` and `docs/3d/QA.md`.
- Definition of done: validator PASS, and no open P0/P1 items in QA.md.

---

## 0. Verified tool facts (this machine, 2026-09-29)

| Fact | Value / consequence |
|---|---|
| Blender | **5.1.1** (b70da489d7f4), Python 3.13, glTF add-on **5.1.19** |
| Render engines | `CYCLES`, `BLENDER_EEVEE` (`_NEXT` id removed in 5.0), `BLENDER_WORKBENCH` |
| GPU | RTX 4060 Laptop 8 GB. Cycles OPTIX/CUDA and EEVEE both work headless (in-memory test renders: EEVEE 4.6 s, Cycles OptiX 2.8 s incl. compile). i7-13620H, 16 threads |
| Smoothing | Auto Smooth is gone. Use `Mesh.set_sharp_from_angle(angle)` (mesh-data function), `object.shade_smooth_by_angle(angle, keep_sharp_edges)`, Bevel `harden_normals`, WeightedNormal, `Mesh.normals_split_custom_set` |
| Modifiers | Bevel (`limit_method`, `angle_limit`, `segments`, `profile`, `miter_outer`, `harden_normals`, `use_clamp_overlap`, `loop_slide`), WeightedNormal (`mode`, `weight`, `keep_sharp`, `thresh`), Subsurf (`levels`, `quality`, `use_limit_surface`, `boundary_smooth`, `use_creases`, `use_custom_normals`), Boolean solvers `FLOAT/EXACT/MANIFOLD` + `use_hole_tolerant`, DataTransfer (custom normals), Triangulate (`keep_custom_normals`) |
| bmesh / mathutils | `spin`, `bridge_loops`, `extrude_*`, `inset_region(use_boundary, use_even_offset, thickness)`, `bisect_plane`, `triangle_fill`, `grid_fill`, `mirror`, `remove_doubles`, `recalc_face_normals`, …; `mathutils.geometry.delaunay_2d_cdt` for caps with holes; `mathutils.bvhtree.BVHTree.overlap` for collisions |
| 5.0/5.1 API breaks | `Material.use_nodes` / `World.use_nodes` are deprecated (trees always exist; never call them). Set `ImageFormatSettings.media_type` **before** `file_format`. `scene.node_tree` → `scene.compositing_node_group`. RNA props are no longer IDProperty dict-accessible. Boolean `FAST` → `FLOAT` |
| Principled inputs | `Base Color, Metallic, Roughness, IOR, Alpha, Normal, Specular IOR Level, Coat Weight, Coat Roughness, Transmission Weight, Emission Color, Emission Strength …` |
| Colour | View transforms `AgX`, **`Khronos PBR Neutral`** (= three.js `NeutralToneMapping`), `Filmic`, `Standard`. Output formats include PNG, EXR, WEBP, AVIF |
| Custom props → extras | `True` stays bool; float lists → `IDPropertyArray`. The exporter's `generate_extras` copies every custom prop verbatim, so helper props must be stripped before export |
| glTF exporter (5.1.19) | `export_format='GLB'`, `export_extras`, `export_yup` (default True), `export_apply`, `export_normals`, `export_texcoords`, `export_tangents`, `export_materials`, `export_image_format (AUTO/JPEG/WEBP/NONE)`, `export_vertex_color (MATERIAL/ACTIVE/NAME/NONE)`, `use_active_collection(+_with_nested)`, `use_renderable`, `export_gpu_instances`, `export_shared_accessors`, `export_hierarchy_flatten_objs`, `export_hierarchy_full_collections`, `export_draco_mesh_compression_enable`, `export_use_gltfpack`, `export_cameras`, `export_lights`, `export_animations`. Emission > 1 → `KHR_materials_emissive_strength`; Coat → `KHR_materials_clearcoat` |
| glTF importer | Cannot decode `EXT_meshopt_compression`. Supports `KHR_mesh_quantization` and `EXT_texture_webp`, so QA re-imports a quantized, uncompressed copy |
| Workbench | `color_type='OBJECT'`, `light='FLAT'`, `render_aa='OFF'` → exact per-object ID renders for the visibility audit |
| Freestyle | Global `crease_angle`; lineset `select_by_collection`, `select_crease`, `select_border`, visibility `RANGE` (QI) |
| EEVEE world | `sun_threshold`, `use_sun_shadow`, `probe_resolution` (disable sun extraction for parity) |
| Network | `api.polyhaven.com` / `polyhaven.com` time out. **`dl.polyhaven.org` works** (HTTP 200). npm registry works; jsDelivr times out |
| HDRIs | `studio_small_09` 2K .hdr = 6 312 947 B. Alternates: studio_small_08/03/01, photo_studio_loft_hall, brown_photostudio_02. CC0 offline fallback: Blender's `…/5.1/datafiles/studiolights/world/studio.exr` (1K, Poly Haven, license.txt CC0) |
| gltf-transform 4.5.1 | CLI `optimize` defaults to flatten/join/instance/palette/simplify = true, which would destroy the hierarchy, so **never use it**. `quantize()` (inside `meshopt()`) multiplies a dequantisation matrix into every mesh-bearing leaf node, or adds an **unnamed** child when that node has children. `meshopt({level:'high'})` caps normals at 8 bits (octahedral); `'medium'` keeps 10-bit normals. `textureCompress` has `lossless` / `nearLossless` (WebP). `dedup({keepUniqueNames})`, `prune({keepLeaves, keepAttributes, keepExtras})`, `weld()` (exact only) |
| npm | three 0.186.1, drei 10.7.9, meshoptimizer 1.3.0, sharp 0.35.5, @gltf-transform/* 4.5.1 (= ARCHITECTURE §0.2). Not installed yet. Step 08 adds `@gltf-transform/{core,functions,extensions}`, `meshoptimizer`, `sharp`, `gltf-validator` (dev) and `three@0.186.1` (for the GLB preview check; step 10 needs it anyway) |

---

## 1. Vehicle spec: a generic compact hatchback (MQB-like, unbranded)

All coordinates are in **glTF/vehicle space**, in metres: `x` = left (+), `y` = up, `z` = front (+). The origin is on the ground at the wheelbase midpoint on the centreline. Scripts use `V(x, y, z)`, which returns Blender coordinates `(x, −z, y)`, so authors always think in vehicle terms.

| Item | Value |
|---|---|
| Length / width / height | **4 280 / 1 790 (2 027 over the mirrors) / 1 450 mm** |
| Wheelbase / track F / track R | **2 620 / 1 540 / 1 510 mm**. Axles at z = ±1.310; wheel planes x = ±0.770 (front), ±0.755 (rear) |
| Overhangs | Front 880 (bumper z = +2.190); rear 780 (z = −2.090) |
| Ride height | Ground clearance 140 mm (sump/subframe); sill bottom y 0.17 |
| Wheels / tyres | 16 × 6.5J ET46, 5 × 112 PCD, bore Ø57. **205/55 R16** → Ø 631.9 mm; wheel centre y 0.316. Hub face x ±0.816 (F) / ±0.801 (R) |
| Arches | r 0.370 around the wheel centre; lip flare 15 mm. The fender runs 0.14 m behind the arch to the door |
| Brakes | Front vented Ø288 × 25; rear solid Ø272 × 10 with EPB caliper |
| Suspension | Front MacPherson: L-arm, anti-roll bar, rack behind the axle, EPS. Caster 6.5°, KPI 11.6°. Rear **torsion beam** (one `rear-axle` node) with separate springs and dampers |
| Layout | **LHD. Transverse, MQB-style rotated install:** engine tilted 12° toward the firewall, intake faces the radiator, exhaust and turbo face the firewall. Timing end on the **right** (−x); DSG on the **left** (+x) |
| Engine | Inline-4 turbo. Block x −0.40…+0.06, bore spacing 88 mm (cylinders at x −0.038 / −0.126 / −0.214 / −0.302), crank axis (y 0.43, z 1.46) |
| Timing drive | Plane x −0.43, pitch 9.525 mm. Crank 21T (Ø63.7), cams 42T × 2 (Ø127.3, 2 : 1), pump 19T (Ø57.6), tensioner Ø60, idler Ø55. Belt length rounded to whole teeth by moving the idler |
| Accessory drive | Plane x −0.47 (outboard of the timing belt). Crank damper Ø150, which belongs to `kais-alternatora`; alternator OAP Ø54; A/C Ø110; tensioner Ø70 |

Hard points live in `config/vehicle.py`. They are the starting set: **the graybox packaging check is the arbiter**, and every change is recorded in BUILD-NOTES.

| Point | glTF (x, y, z) |
|---|---|
| Hood leading edge / rear edge at the cowl | (0, 0.76, 2.08) / (0, 1.00, 0.80). At (±0.57, z 1.25) the hood is at y 0.93, above the strut tops |
| Bumper top / headlamps | (0, 0.64, 2.16) / centre (±0.66, 0.725, 2.02), spanning y 0.66–0.79 between bumper and hood |
| Windshield, roof, rear glass | Cowl (0, 1.00, 0.80) → A-pillar top (0, 1.41, 0.10) → roof peak (0, 1.45, −0.45) → roof rear (0, 1.41, −1.42) → rear glass base (0, 1.02, −1.86) |
| Shut lines | Fender / front door z 0.80. B-pillar z −0.18. Rear door / quarter z −1.02 (door lower rear cut by the arch). Bumper joins z 1.92 (front) and −1.80 (rear). Belt line y 0.98 |
| Plan half-width | Nose (z 2.15) 0.72 · front axle 0.895 · B-pillar 0.895 · rear axle 0.895 · tail (z −2.05) 0.80. Greenhouse half-width 0.83 at the belt, 0.64 at the roof side |
| Strut (front) | Knuckle clamp (±0.66, 0.44–0.52, 1.30); spring y 0.62–0.84 (OD 150, inner edge at x ±0.555); top mount (±0.57, 0.86–0.90, 1.25) |
| Knuckles / subframe | Knuckles (±0.68, 0.10–0.55, 1.31). H-frame within x ±0.45, y 0.16–0.30, z 0.95–1.28 (the rails stop before the sump) |
| Steering | Rack axis (y 0.33, z 1.16), x within ±0.36. Tie rods run to steering arms (±0.66, 0.30, 1.16), behind the axle |
| Engine volumes | Block y 0.20–0.70, z 1.30–1.62 · head y 0.70–0.92 · sump y 0.14–0.30, x −0.40…+0.04 |
| Intake | Plenum x −0.33…+0.03, y 0.62–0.88, z 1.64–1.78. Throttle body at the **right** end (−0.36, 0.72, 1.72). EGR at the left end (0.09, 0.80, 1.66). Injectors under the plenum (x −0.30…−0.04, y 0.66, z 1.62) |
| Turbo | (−0.06, 0.64, 1.16); shaft along x; compressor on the +x side, clear of the bellhousing |
| Ancillaries | Alternator (−0.34, 0.48, 1.72) and A/C compressor (−0.33, 0.29, 1.72), both with pulleys in the x −0.47 plane. Oil-filter module (−0.13, 0.46, 1.66). Starter (0.25, 0.30, 1.66) at the front of the bellhousing |
| Gearbox | Bellhousing x 0.06–0.20; case 0.20–0.58, y 0.22–0.60, z 1.20–1.62. Diff outputs at (y 0.33, z 1.31): left x 0.40, right x 0.08. DMF + clutch x 0.065–0.19 |
| Mounts | Right (−0.52, 0.82, 1.52) and left (0.52, 0.74, 1.50), both **ahead** of the strut towers. Torque rod (0.05, 0.22, 1.10) |
| Battery / airbox / thermostat | Battery (0.58, 0.595, 1.745), box 278 × 190 × 175. Airbox (0.38, 0.84, 1.36). Thermostat (0.11, 0.71, 1.45) with the coolant sensor surface-mounted on its front face (0.11, 0.71, 1.51). HP pump (0.10, 0.90, 1.30) |
| Cooling pack | Intercooler z 2.07 (y 0.18–0.36, tanks to x ±0.40). Condenser z 2.01. Radiator z 1.95 (y 0.32–0.82, x within ±0.33). Fan z 1.84–1.90, motor back to z 1.80 |
| Charge pipes | Both stay in front of the engine and outside the cooling-pack footprint. **Hot:** compressor → forward over the gearbox (x 0.34, y 0.68, under the airbox) → down in front of the gearbox (z 1.92) → IC left tank. **Cold:** IC right tank → up the right front corner (x −0.38, z 1.98) → throttle body |
| Exhaust | Turbo outlet → downpipe behind the block → DPF can under the tunnel (z 0.95…0.40) → mid silencer (z −0.25…−0.75) → pipe over the beam → rear silencer (z −1.75…−1.98), tip x +0.45 |
| Rear axle | Beam (0, 0.28, −1.18); pivots (±0.62, 0.35, −0.75); springs (±0.52, 0.25–0.47, −1.24); dampers (±0.62, 0.30–0.75, −1.40) |

**Styling guard:** no VW/Audi/Škoda/SEAT/Cupra grille shape, light signature, C-pillar kink or wheel design. No logos, badges or text anywhere (tyres, battery, covers). Use a generic 5-twin-spoke wheel and generic L-shaped light guides.

### 1.1 Body method (smooth, believable, scriptable)
1. **Master surface** covers the sides, top and greenhouse between the front join (z ≈ 1.92) and the rear join (z ≈ −1.80).
   - It is a quad cage lofted from about 32 sections. Stations sit **exactly on the shut lines** (z 0.80, −0.18, −1.02 and the hood/fender join).
   - Feature points are parameter-aligned: rocker, door crease, shoulder line, belt, window sill, hood shut line, roof side, roof centre. That way every shut line is a grid iso-line and every feature line runs continuously.
   - Feature lines use edge creases (0.6–0.9), not extra loops.
   - The cage is symmetric with a welded centreline.
   - Catmull-Clark level 3 is the *normal reference* and is never exported. Level 2 is the desktop mesh; level 1 is lite.
2. **Separate lofts** for the front fascia/bumper and the rear bumper. **Lamp lens patches** continue the master's tangents across their joins (G1). This way the master never has to close at the nose or tail.
3. **Panels** are sets of grid faces between iso-lines.
   - Gaps: `inset_region(use_boundary=True, use_even_offset=True, thickness=0.002)`, then delete the rim. This gives an exact 4 mm in-surface gap.
   - A 6 mm inward hem with one rounded segment gives the rim and edge lines a crisp outline.
4. **Booleans** are used only for wheel arches (cylinders), lamp, grille and intake openings, and window openings that are not iso-lines.
   - Solver `EXACT`, hole tolerant, with cutters **bounded to one side**.
   - After every boolean, custom normals are transferred from the level-3 reference (DataTransfer), so the fresnel rim stays smooth whatever the triangulation.
5. **`body__structure`** is the remaining faces (roof, pillars, sills, quarters, tailgate frame) plus lofted floor/tunnel, firewall/cowl and strut towers. It is split into 5 children so transparent sorting works in EEVEE and three.js.
6. **Checks every round:** zebra, fresnel and clay renders. A lump in the shell is a P1.

---

## 2. Scene conventions (compatible with the contract; clarified in 3D-CONTRACT by step 08)
- **Every part node is a transform-only Empty** `part__<category>__<instance>`.
  - Identity rotation and scale; origin at the mounting point or geometric centre. It carries exactly the F3 extras.
  - It has **one child `mesh__<category>__<instance>__0`** that holds all of the part's geometry as one primitive per material.
  - Why:
    - `meshopt()` rewrites the matrix of mesh-bearing leaf nodes, so keeping the mesh on a child leaves the part's TRS exact.
    - Draw calls then equal the sum of materials per part.
    - Node names are identical in both GLBs.
    - A purchased model can later replace a part by swapping only the child.
- **Mesh children** may carry a rotation. They share mesh data (linked duplicates) for rotationally symmetric parts: wheels, discs, pads and hubs; the right side is yawed 180°. Mirrored parts are separate meshes made by mirroring the mesh data (`Mesh.transform(scale −1)` + `flip_normals`), never by negative object scale.
- **Hierarchy:** `sklop_car` (the only name exempt from the F2 regex) → 9 `sys__<system>` Empties (`servis` has no nodes) → `part__` / `body__` / `chassis__`.
- **Non-clickable nodes:**
  - `body__structure` (Empty) with children `body__structure__{upper,left,right,rear,floor}`;
  - optional `body__interior`;
  - `chassis__subframe`;
  - **`chassis__knuckle__fl/fr`**, static anchors of the corner drawing.
- Every mesh-bearing node is a leaf, so quantize never creates unnamed nodes.
- **Extras only on part nodes**, and exactly the F3 keys: `partId, category, system, labelSr, clickable, lod, explodeDir, explodeDist, explodeStage, explodeOrder, labelAnchor, focusDir, focusMinDist`. They are camelCase and in glTF space. Builder tags (`sk_builder`, `sk_quality`) are removed by `export.py`, and mesh datablocks carry no custom props.
- **Both GLBs have the same node-name set.** All 91 part nodes are `lod: "core"`; `"detail"` stays reserved and unused. Lite differs only in geometry and material count (§9).
- **Node labels:** step 08 adds a `labelSr` per instance to `lib/catalog/taxonomy.ts` (`TaxonomyInstance.labelSr`, with a unit test for completeness). They reach Blender via `3d/build/taxonomy.json`, written by `3d/scripts/taxonomy-json.mjs` (Node 22 strips TS types natively).
- **Deterministic builds:** every random choice is seeded from the node name, and no timestamps go into the GLB.

---

## 3. Part list (91 clickable nodes + static nodes)

Legend: stage per F1 · tris = desktop target (±25 %) · "shared" = one mesh reused, right side yawed · "mirror" = separate mirrored mesh · materials = contract slots without the `mat_` prefix (§5) · pivot = geometric centre unless stated. Serbian labels go into the taxonomy (§2).

### 3.1 Karoserija (stage 1). X-ray panels come from §1.1.
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__hauba__main` | Hauba | z 0.82–2.08, y 0.76–1.00 | master grid region + in-surface gap + hem | 5k | body_xray |
| `part__branici__front` | Prednji branik | z 1.75–2.19, y 0.20–0.64, wings to the arches | own loft + grille/intake openings (bounded cutters) + X-ray slats; steel crash beam inside | 8k | body_xray, steel_dark |
| `part__branici__rear` | Zadnji branik | z −2.09…−1.72 | own loft + diffuser lip | 5k | body_xray |
| `part__blatobrani__l` / `__r` | Blatobran — levi / desni | x ±0.80–0.90, z 0.80–1.92, y 0.45–0.98 | master region + arch cut + arch lip + hem (mirror) | 4k ea | body_xray |
| `part__vrata__fl/fr/rl/rr` | Vrata — prednja leva / prednja desna / zadnja leva / zadnja desna | front z 0.80…−0.18, rear z −0.18…−1.02 (arch cut), y 0.30–1.40 | master region incl. the window sash; handle recess; simplified inner panel | 4.5k ea | body_xray |
| `part__retrovizori__l` / `__r` | Retrovizor — levi / desni | (±0.95, 1.02, 0.66) | 1-level sub-d cap; arm/base extrude + bevel; glass plane (mirror) | 2.5k ea | body_xray, plastic_black, machined_steel |
| `part__stakla__windshield` | Vetrobransko staklo | cowl → A-pillar top | master greenhouse region + 2 mm edge band | 2k | glass_xray |
| `part__stakla__rear` | Zadnje staklo | y 1.02–1.40, z −1.42…−1.86 | same | 1.5k | glass_xray |
| `part__stakla__side` | Bočna stakla | 4 door + 2 quarter panes | six regions in one node | 4k | glass_xray |
| `part__brisaci__main` | Brisači | cowl; pivots at x +0.30 / −0.20 | arms: swept flat profile; blades extruded along the glass; pivot caps | 2.5k | painted_black, rubber |
| `body__structure` (+5 children) | — | whole car | remaining master faces + floor/tunnel/firewall/tower lofts | 18k | body_xray |
| `body__interior` (only if cheap) | — | cabin | dash top, steering wheel, 4 seat shells | (5k) | body_xray |

### 3.2 Elektrika i svetla
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__farovi__l` / `__r` (st. 1) | Far — levi / desni | (±0.66, 0.725, 2.02) | lens = master-continuing patch +1 mm; housing = lens outline extruded 0.18 m back, tapered + bevel; projector (lathe + lens cap); 2 reflector bowls; DRL light guide (swept flat strip); bezel (mirror) | 9k ea | glass_lens, plastic_black, brushed_alu, emissive_led |
| `part__stop-svetla__l` / `__r` (st. 1) | Stop svetlo — levo / desno | (±0.72, 0.95, −1.88) | lens patch; housing extrude; generic L light guide; reflector (mirror) | 4.5k ea | glass_lens, plastic_black, emissive_tail |
| `part__senzori__park-front` (st. 1) | Senzori za parkiranje — prednji | 4 × in the bumper face (x ±0.18 / ±0.52, y 0.45, z 2.17); pivot = centroid | lathe sensor + clip housing × 4 | 1k | plastic_black |
| `part__akumulator__main` (st. 4) | Akumulator | (0.58, 0.595, 1.745) | 278 × 190 × 175 box with 12 mm vertical radii; lid with vent strip + handle recess; posts, clamps and covers; inset label zone | 3.5k | battery, plastic_grey |
| `part__senzori__coolant-temp` (st. 5) | Senzor temperature rashladne tečnosti | thermostat front face (0.11, 0.71, 1.51) | lathe hex + body + connector, surface-mounted (no hidden thread) | 0.5k | plastic_grey |
| `part__senzori__lambda` (st. 7) | Lambda sonda | on the downpipe (−0.02, 0.55, 1.06) | lathe (hex, thread, guard tube) + swept cable + connector | 0.8k | machined_steel, plastic_black |

### 3.3 Točkovi (stage 2)
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__felne-gume__fl/fr/rl/rr` | Felna i guma — prednja leva / prednja desna / zadnja leva / zadnja desna | wheel centres; pivot = wheel centre | **Rim:** lathe barrel (flanges, bead seats, humps, well); face = 5 twin spokes (one sector outline extruded onto the dished face profile, radial array × 5, welded); 5 bolt bores; plain centre cap; bolts in rim material. **Tyre:** lathe profile (sidewall bulge, shoulder radius, 4 circumferential grooves as geometry); tread UV u = angle × 24, sidewall radial UVs | 12k (shared × 4) | brushed_alu, painted_black (barrel), tyre (+`tex_tyre_n`) |

### 3.4 Kočnice (stage 3). Left side is built; right side is yawed or mirrored.
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__kocioni-diskovi__fl/fr` | Kočioni disk — prednji levi / prednji desni | ring centre x ±0.771 on the axle | vented Ø288 × 25: lathe (hat Ø160, heat groove, two 9 mm rings) + 36 straight pillar vanes (radial array) + 5 × Ø14 holes on PCD 112 + Ø57 bore (CDT cap); polar UVs on the friction faces | 6k (shared) | machined_steel (+`tex_machined_n`), cast_iron |
| `part__kocioni-diskovi__rl/rr` | Kočioni disk — zadnji levi / zadnji desni | x ±0.756 | solid Ø272 × 10, deeper hat | 4k (shared) | same |
| `part__kocione-plocice__fl/fr` | Kočione pločice — prednje leve / prednje desne | inside the caliper, trailing side | 2 pads: backing plate (outline with abutment ears, 5 mm) + friction block (disc-concentric arc, 11 mm, chamfers, centre slot) + shim | 1.4k (shared) | steel_dark, rubber (friction compound) |
| `part__kocione-plocice__rl/rr` | Kočione pločice — zadnje leve / zadnje desne | | smaller | 1.1k (shared) | same |
| `part__kocione-celjusti__fl/fr` | Kočiona čeljust — prednja leva / prednja desna | trailing edge (±0.77, 0.34, 1.19) | bridge = section swept on a disc-concentric arc; inboard piston housing (lathe Ø64); outboard fingers; carrier bracket; guide-pin boots; bleed nipple + banjo (mirror) | 5k ea | caliper, rubber |
| `part__kocione-celjusti__rl/rr` | Kočiona čeljust — zadnja leva / zadnja desna | (±0.755, 0.34, −1.425) | same + EPB motor/gear unit | 6k ea | caliper, rubber |
| `part__abs-senzori__fl/fr/rl/rr` | ABS senzor — prednji levi / prednji desni / zadnji levi / zadnji desni | top-rear of the bearing | lathe head + mounting ear + swept 0.15 m cable + connector | 0.8k ea | plastic_black |

### 3.5 Vešanje i upravljanje (stage 3)
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__lezaj-glavcina__fl/fr` | Ležaj točka i glavčina — prednji levi / prednji desni | inboard of the hub face (±0.79, 0.316, 1.31) | lathe (flange Ø140, spigot Ø57, bearing body, ABS encoder ring) + 5 threaded bores + 3-ear flange | 2.5k (shared) | machined_steel |
| `part__lezaj-glavcina__rl/rr` | Ležaj točka i glavčina — zadnji levi / zadnji desni | rear carriers | same + stub flange | 2.5k (shared) | machined_steel |
| `part__amortizeri-opruge__fl/fr` | Amortizer i opruga — prednji levi / prednji desni | clamp → top mount (§1); pivot = axis midpoint | lathe damper tube, seats, top mount, bump stop, bellows boot; **spring** = helix sweep (wire 12 mm, OD 150, 5.5 coils, closed ground ends); clamp + link bracket (mirror) | 9k ea | steel_dark (spring), painted_black, machined_steel (rod), rubber |
| `part__amortizeri-opruge__rl/rr` | Amortizer i opruga — zadnji levi / zadnji desni | spring + damper (§1); pivot = their midpoint | barrel spring helix + damper with eyes | 7k ea | steel_dark, painted_black, rubber |
| `part__ramena-selen-blokovi__fl/fr` | Rame — prednje levo / prednje desno | subframe bushings (±0.35…0.40, 0.24, 1.00–1.30) → ball joint (±0.72, 0.18, 1.31) | pressed L-arm: outline extruded 25 mm + flange lip + bevel; 2 bushings; ball joint (mirror) | 3.5k ea | steel_dark, rubber |
| `part__ramena-selen-blokovi__rear-axle` | Zadnja torziona greda i selen blokovi | beam (0, 0.28, −1.18) | U-profile beam (swept open section), tapered trailing arms (lofted), pivot bushings, spring pads, damper mounts, hub flanges | 8k | painted_black, rubber |
| `part__spone-stabilizatori__tie-rod-l` / `-r` | Spona — leva / desna | rack end → steering arm (§1) | rod + inner axial joint + outer end (ball housing, tapered stud, lock nut) + boot (mirror) | 1.8k ea | steel_dark, rubber |
| `part__spone-stabilizatori__stabilizer` | Prednji stabilizator i štangle | behind the subframe, arms forward to the struts | swept U-bar Ø22 + 2 bushings with clamps + 2 drop links | 4k | steel_dark, rubber |
| `part__letva-volana__main` | Letva volana | axis (0.02, 0.33, 1.16) | rack tube, bellows boots, pinion housing + column stub, EPS motor (lathe + ribs), 2 clamps | 6k | cast_alu, rubber, steel_dark |
| `chassis__subframe` (static) | — | H-frame (§1) | swept box sections + plates | 6k | painted_black |
| `chassis__knuckle__fl/fr` (static) | — | (±0.68, 0.10–0.55, 1.31) | cast knuckle: strut clamp, steering arm, ball-joint boss, caliper ears, bearing bore (mirror) | 3k ea | cast_iron |

### 3.6 Motor i usis
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__motor__block` (st. 5) | Blok motora | x −0.40…+0.06, crank (y 0.43, z 1.46), tilted 12° | casting from the extruded side profile + skirt; vertical ribs (array); bosses; alu oil-filter module; flywheel flange; bevel 4 mm | 20k | cast_iron, cast_alu |
| `part__motor__head` (st. 5) | Glava motora | y 0.70–0.92 | head casting (extruded profile); cam cover (sub-d, coil wells via CDT, PCV); 2 × 42T cam sprockets at the right end; flanges | 16k | cast_alu, plastic_black, steel_dark |
| `part__turbina__main` (st. 5) | Turbina (turbopunjač) | (−0.06, 0.64, 1.16); shaft along x | **turbine volute** = spiral sweep with growing section + V-band outlet; **compressor volute** with an open Ø60 inlet showing a 6 + 6 blade wheel (twisted strips, radial array); CHRA (lathe); oil/coolant lines; wastegate can + rod + bracket; heat-shield half shell | 24k | cast_iron, cast_alu, machined_steel, steel_dark, heat_shield |
| `part__interkuler__main` (st. 4) | Interkuler | (0, 0.27, 2.07); core 700 × 180 × 60 | core box (planar UVs) + end tanks (sub-d wedges) + Ø55 nozzles | 5k | core_fins (+`tex_fins_n`), cast_alu |
| `part__interkuler__pipes` (st. 4) | Creva i cevi interkulera | routes in §1 | swept Ø55 tubes + silicone couplers + clamps | 5k | brushed_alu, hose |
| `part__usisna-grana__manifold` (st. 4) | Usisna grana | plenum (§1) | plenum (sub-d) + 4 swept runners + head flange + throttle body at the right end | 8k | plastic_black, cast_alu |
| `part__usisna-grana__airbox` (st. 4) | Kućište filtera vazduha | (0.38, 0.84, 1.36) | sub-d box + lid clips + snorkel to the front + outlet bellows to the turbo | 4k | plastic_black, rubber |
| `part__brizgaljke-pumpa-goriva__injectors` (st. 5) | Brizgaljke i razvodna cev | under the plenum | 4 injectors (lathe + connector) + rail (swept tube + cups + pressure sensor) | 4k | steel_dark, plastic_black |
| `part__brizgaljke-pumpa-goriva__pump` (st. 5) | Pumpa visokog pritiska | (0.10, 0.90, 1.30) | lathe body + flange + connector + HP line | 2.5k | cast_alu, machined_steel |
| `part__zupcasti-kais-vodena-pumpa__belt` (st. 5) | Zupčasti kaiš i zatezač | plane x −0.43; sprockets in §1 | belt path from tangents + arcs; strip with inner teeth (pitch 9.525, width 25); eccentric tensioner + idler | 8k | rubber, steel_dark |
| `part__zupcasti-kais-vodena-pumpa__water-pump` (st. 5) | Vodena pumpa | inside the loop (−0.41, 0.52, 1.32) | alu body (extrude + bevel) + generated 19T sprocket + gasket | 4k | cast_alu, steel_dark |
| `part__kais-alternatora__belt` (st. 4) | Kaiš alternatora i zatezač | plane x −0.47 | poly-V belt (6 ribs, swept) + automatic tensioner (arm casting, pulley, spring housing) + **crank vibration damper Ø150** | 7k | rubber, cast_alu |
| `part__alternator__main` (st. 4) | Alternator | (−0.34, 0.48, 1.72) | two housings (segmented spin leaving real vent slots), copper stator band, fan, OAP pulley (6 grooves), rear cover + B+ terminal, 2 ears | 10k | cast_alu, copper, steel_dark |
| `part__anlaser__main` (st. 4) | Anlaser | (0.25, 0.30, 1.66) | motor can (lathe), solenoid + terminals, nose casting + flange, pinion (generated gear) | 7k | painted_black, cast_alu, machined_steel |
| `part__paljenje-grejaci__coils` (st. 5) | Bobine i svećice | 4 × along the tilted bore axes | pencil coils (lathe + connector) + spark plugs (ceramic insulator, hex, thread, electrode) under each | 4.5k | plastic_black, ceramic, machined_steel |
| `part__karter-dihtunzi__sump` (st. 5) | Karter | x −0.40…+0.04, y 0.14–0.30, z 1.30–1.62 | upper alu sump (extrude + ribs + bevel) + pressed steel pan (sub-d) + drain plug | 5k | cast_alu, steel_dark |
| `part__egr-ventil__main` (st. 5) | EGR ventil | (0.09, 0.80, 1.66) | valve casting + actuator box + connector + flange + short pipe | 4k | cast_alu, plastic_black |
| `part__nosaci-motora__r` (st. 4) | Nosač motora — desni | (−0.52, 0.82, 1.52) | hydro mount (lathe) + bracket arm (extrude + bevel) | 2k | cast_alu, rubber |
| `part__nosaci-motora__l` (st. 4) | Nosač menjača — levi | (0.52, 0.74, 1.50) | rubber block in an alu bracket | 2k | cast_alu, rubber |
| `part__nosaci-motora__rear` (st. 4) | Zadnji nosač motora | (0.05, 0.22, 1.10) | torque rod: 2 bushings + arm | 2k | cast_alu, rubber |

### 3.7 Hlađenje i klima (stage 4)
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__hladnjak-ventilator__radiator` | Hladnjak motora | z 1.95 | core box (planar UVs) + plastic side tanks (sub-d) + nozzles, pins | 4k | core_fins, plastic_black |
| `part__hladnjak-ventilator__fan` | Ventilator hladnjaka | z 1.84–1.90 | shroud (extrude, round opening via CDT) + 7 twisted blades + motor + resistor | 5k | plastic_black, steel_dark |
| `part__termostat-creva__thermostat` | Termostat | (0.11, 0.71, 1.45) | housing (lathe + boxes) + outlets | 1.5k | plastic_grey |
| `part__termostat-creva__hoses` | Creva hlađenja | upper: thermostat → radiator top-left; lower: radiator bottom-right → coolant pipe on the block's right front | swept Ø32 tubes + clamps | 3.5k | hose, steel_dark |
| `part__klima__compressor` | Kompresor klime | (−0.33, 0.29, 1.72) | lathe body + ribs + clutch pulley + rear head + service ports + ears | 6k | cast_alu, steel_dark |
| `part__klima__condenser` | Kondenzator klime | z 2.01, y 0.35–0.80 | core box + receiver/drier + pipes | 2.5k | core_fins, steel_dark |

### 3.8 Transmisija (stage 6) and Izduvni sistem (stage 7)
| Node(s) | labelSr | Position / pivot | Recipe | Tris | Materials |
|---|---|---|---|---|---|
| `part__kvacilo-zamajac__main` | Kvačilo i zamajac | crank axis, x 0.065–0.19 | DMF (lathe) + starter ring gear (132 generated teeth); clutch disc (friction segments, hub, 6 torsion springs); pressure plate (lathe cover + 18 diaphragm fingers) | 10k | machined_steel, cast_iron, steel_dark, rubber (lining) |
| `part__menjac__main` | Menjač (DSG) | §1 | bellhousing lofted around the crank axis + case (extruded profile + ribs) + mechatronic cover + diff bulge + output flanges + breather | 16k | cast_alu, plastic_black, steel_dark |
| `part__poluosovine__l` | Poluosovina — leva | diff x 0.40 → hub | tripod joint + boot + shaft + CV bell + boot | 4.5k | machined_steel, rubber, steel_dark |
| `part__poluosovine__r` | Poluosovina — desna | diff x 0.08 → right hub | same, longer, with damper weight | 6k | same |
| `part__dpf-katalizator__main` | DPF i katalizator | turbo outlet → tunnel z 0.95…0.40 | downpipe + ribbed flex section + oval can with cones (lofted) + **embossed heat-shield half shell** + lambda boss | 6k | steel_dark, heat_shield (+`tex_emboss_n`) |
| `part__auspuh__mid` | Srednji lonac auspuha | z −0.25…−0.75 | pipe + oval can (lofted) + rubber hangers | 4k | steel_dark, rubber |
| `part__auspuh__rear` | Zadnji lonac auspuha | over the beam → transverse can; tip at x +0.45 | swept pipe + transverse can + tailpipe + chrome tip | 5k | steel_dark, chrome, rubber |

### 3.9 Budget roll-up (desktop)
| Group | Tris | Draw calls |
|---|---|---|
| Stage-1 panels, glass, lights, wipers, PDC | 87k | 36 |
| Static: structure, subframe, knuckles (no interior) | 30k | 8 |
| Wheels (12k shared × 4) | 48k | 12 |
| Brakes | 50k | 28 |
| Hubs, suspension, steering | 71k | 33 |
| Engine, turbo, intake, fuel, belts, ancillaries, mounts | 144k | 47 |
| Cooling + A/C | 23k | 11 |
| Transmission | 37k | 13 |
| Exhaust + battery + sensors | 20k | 12 |
| **Total** | **≈ 510k rendered / ≈ 455k unique** | **≈ 200** |

Limits: F5 allows target 450–600k (hard < 800k) and ≤ 220 draw calls. Nodes ≈ 201 (limit 400). **Lite** comes from the same builders with `quality='lite'`: ≈ 230k tris, ≈ 140 draw calls (max 2 materials per part, except lamps, turbo and front struts at 3) and the identical node set (limits 250k / 150 / 300). The graybox carries the real material lists, so draw calls are measured from the first hour.

---

## 4. Detail strategy

| Real geometry (silhouette, rim light, 1024 px masters) | Tiling normal maps (≤ 1024², generated) |
|---|---|
| Disc vanes, hat groove and holes; caliper bulges, boots, nipple; spring coils; turbo volutes, compressor blades, actuator; poly-V ribs, pulley grooves, timing-belt and sprocket teeth; alternator vent slots + fan; starter pinion; ring gear; diaphragm fingers; wheel spokes + 4 tyre grooves; pad chamfers + slot; headlamp projector, reflectors, light guide; fan blades | Tyre tread blocks/sipes (non-directional) + sidewall ribs, **no text** (`tex_tyre_n`) · radiator/condenser/intercooler fins + tubes (`tex_fins_n`) · turning/grinding marks, with UVs aligned to the machining direction (`tex_machined_n`) · heat-shield dimple emboss (`tex_emboss_n`) |

Hard-surface rules (`lib/modeling.py`):
- **Castings, boxes, extrusions:**
  1. Shade smooth, then `set_sharp_from_angle(30°)`.
  2. Bevel: `limit_method='ANGLE'`, 30°. Width by size class: S 0.6 / M 1.2 / L 2.5 / XL 4 mm. Segments 2 (S/M) or 3 (L/XL). `profile` 0.5 (castings 0.6). `miter_outer='MITER_ARC'`, `harden_normals=True`, `use_clamp_overlap=True`, `loop_slide=True`.
  3. WeightedNormal: `mode='FACE_AREA'`, `weight=50`, `keep_sharp=True`, `thresh=0.01`.
  4. Apply.
- **Lathe parts:** fillets and chamfers are drawn into the 2D profile (3–4 arc points). 48–96 segments by diameter (lite × 0.6). Shade smooth + sharp from 35°; no bevel modifier.
- **Tubes, hoses, springs, belts:** curve objects (`bevel_mode` ROUND or OBJECT profile) → `new_from_object`. 8–12 sides. Smooth, with chamfered caps.
- **Holes without booleans:** caps via `delaunay_2d_cdt`, then extrude. Booleans only on the body (§1.1), always followed by normal transfer and never by subdivision.
- **Anti-lump rules:** subdivide only all-quad cages with even loops; support with creases; no n-gons on curved faces; triangulate last (`keep_custom_normals`).
- **UVs:** every mesh gets a UV map (lathe = cylindrical, boxes = cube projection, belts/tubes = along the path). `prune` later removes UVs from primitives with no texture. No normal-mapped primitive may lack TEXCOORD_0, because that is a glTF-Validator error.
- **Lite quality switch:** segments × 0.6, no bolts/clips/fin geometry, tyre grooves as normal map only, simpler spoke fillets, body at subdivision level 1 (smooth shading still comes from the transferred normals).
- **No baked vertex AO in v1:** it blotches on sparse faces and costs COLOR_0.
- **Collisions:** parts may overlap inside one part. Different parts must not interpenetrate when assembled; contacts ≤ 2 mm are allowed only if declared in `config/contacts.py`.

---

## 5. Materials and textures

glTF metallic-roughness, linear workflow; sRGB hex values are converted to linear in code. Principled inputs only; no procedural nodes in exported materials.

| Slot | Base | Metal | Rough | Notes / used by |
|---|---|---|---|---|
| `mat_body_xray` | `#123642` | 0 | 0.5 | exported opaque; runtime X-ray shader (`override: "xray-body"`) |
| `mat_glass_xray` | `#9FE9FF` | 0 | 0.05 | exported opaque; runtime (`"xray-glass"`) |
| `mat_glass_lens` | `#DDE6EA` | 0 | 0.05 | alpha 0.25 BLEND, no transmission |
| `mat_cast_iron` | `#5A5C5E` | 1 | 0.72 | block, disc hats, knuckles, turbine, DMF body |
| `mat_machined_steel` | `#A9ADB1` | 1 | 0.28 | + `tex_machined_n`; disc faces, shafts, rods, pinions, mirror glass |
| `mat_steel_dark` | `#3A3D40` | 1 | 0.55 | springs, arms, brackets, belt hardware, exhaust pipes |
| `mat_brushed_alu` | `#C4C7CA` | 1 | 0.35 | wheel faces + bolts, charge pipes, lamp reflectors |
| `mat_cast_alu` | `#A7A9AB` | 1 | 0.55 | head, gearbox, alternator, rack, mounts |
| `mat_painted_black` | `#151617` | 0 | 0.45 | **Coat Weight 0.3, Coat Roughness 0.15** (→ `KHR_materials_clearcoat`); subframe, dampers, beam, barrels, starter can, wipers |
| `mat_plastic_black` | `#121314` | 0 | 0.60 | covers, airbox, housings, connectors, cables |
| `mat_plastic_grey` | `#3B3E41` | 0 | 0.55 | thermostat, battery covers/label |
| `mat_rubber` | `#1A1A1B` | 0 | 0.85 | bushings, boots, belts, pad friction compound, clutch lining |
| `mat_tyre` | `#1C1C1D` | 0 | 0.90 | + `tex_tyre_n` |
| `mat_hose` | `#202122` | 0 | 0.75 | coolant and charge hoses |
| `mat_chrome` | `#E3E5E7` | 1 | 0.08 | **exhaust tip only** (DS §7.3) |
| `mat_copper` | `#B87333` | 1 | 0.35 | alternator stator |
| `mat_ceramic` | `#D9D6CF` | 0 | 0.40 | spark-plug insulators |
| `mat_caliper` | `#2E3136` | 0.3 | 0.40 | graphite **anodised / powder-coat** finish (the "anodized" entry of the PBR library); calipers + EPB units; accent only as the runtime selection |
| `mat_battery` | `#1E2022` | 0 | 0.50 | battery case |
| `mat_heat_shield` | `#9C9FA2` | 1 | 0.45 | + `tex_emboss_n` |
| `mat_wire` | `#2A2C2E` | 0 | 0.60 | reserved (cables use plastic_black to save draw calls) |
| `mat_emissive_led` | `#F4F1EA` | 0 | 0.30 | emissive `#F4F1EA` × 1.5 (`KHR_materials_emissive_strength`) |
| `mat_emissive_tail` | `#5A0F12` | 0 | 0.35 | emissive `#B3261E` × 0.8 |
| **`mat_core_fins`** (24th slot) | `#4A4E52` | 0.6 | 0.50 | + `tex_fins_n`; radiator, condenser, intercooler cores |

**Textures:** generated in `lib/textures.py` from numpy height fields, then converted to tangent-space normals (OpenGL +Y), seeded. PNG masters go to `3d/assets/textures/` (git-ignored, regenerated). They ship as **WebP near-lossless**, because lossy WebP's 4:2:0 chroma subsampling damages normal maps.

| Texture | Size | Content |
|---|---|---|
| `tex_tyre_n` | 1024² | top half: tread tile (blocks, sipes, shoulder slots); bottom half: sidewall band (fine concentric ribs, plain zone) |
| `tex_fins_n` | 512² tiling | flat tubes every 10 mm + louvred zig-zag fins at 1.5 mm pitch |
| `tex_machined_n` | 512² tiling | fine lines along u with seeded amplitude jitter |
| `tex_emboss_n` | 512² tiling | hex dimple emboss |

That makes 4 textures (limit 10); lite resizes them to 512².

- **Runtime overrides (step 10):** by material name, `mat_body_xray` gets the X-ray shell shader and `mat_glass_xray` the X-ray glass. Flags are in `manifest.materials[].override`; all other materials stay as authored.
- **Render-only materials (never exported):** `thumb_primer` (`#2F3337`, rough 0.55; body panels in thumbnails look like primed replacement panels), `thumb_glass` (transmission), `poster_xray_body/glass` (§8.2), `floor_ruler`, `shadow_decal`.

---

## 6. Explode design

### 6.1 Concept ("workshop order") and rules
The exploded state should read like a service-manual plate from the exploded camera (front-left, elevated):
1. Body panels lift away and spread fore-aft into a halo.
2. Wheels slide off along the axles.
3. Each corner fans out: the caliper and pads pull back off the disc, then the disc and hub slide out, the strut rises and the arm drops forward.
4. Ancillaries leave the engine along their mounting faces. Right-side ones go forward, where the camera sees them.
5. **The engine core is hoisted:** coils along the bore axis, then the head and turbo; the block lifts 0.25 m.
6. The gearbox moves forward-left and the clutch appears in the gap.
7. The exhaust slides out to the left.

Rules:
- Each part moves along its assembly axis.
- **Outside-in order within a stage.** A part never sweeps through a part that has not moved yet.
- **Under-car rule:** in stages 3–6, anything below y 0.5 with x within ±0.6 moves along its own axis or vertically, never "backward" into the tunnel mouth the DPF needs.
- `body__structure`, the subframe and the knuckles stay put as anchors.
- Nothing ends below y 0.02, except the wheels, which roll out at y = 0.
- The envelope at p = 1 is about x ±1.6, y 0–1.95, z −2.6…+2.75.

### 6.2 Timing (added to the contract)
`u = clamp((p − start)/(end − start), 0, 1)` with the stage window from taxonomy.

`local = clamp((u − 0.35·order)/0.65, 0, 1)`

`offset = dir × dist × power2.inOut(local)`

This reconciles F3's order ∈ [0, 1] with DS §7.7's "≤ 0.35 of the window".

On mobile, grouped stages share one window (1+2, 4+5, 6+7). If they moved simultaneously, stage-5 parts would start while the stage-4 parts sitting on them are still moving. **Recommendation for step 10:** run grouped stages sequentially inside the shared window (first stage over [0, 0.55], second over [0.45, 1]). The solver validates exactly this timeline and the desktop one.

### 6.3 Initial vectors (glTF `[left, up, front]`; right-hand instances negate x unless both are listed)
These values were checked by the box/motion simulation and clear all real opaque collisions found there. BVH checks settle the few contacts under 7 mm.

| St. | Node | dir | dist | order |
|---|---|---|---|---|
| 1 | brisaci__main | (0, 0.60, 0.80) | 0.24 | 0.00 |
| 1 | hauba__main | (0, 0.80, 0.60) | 1.10 | 0.10 |
| 1 | branici__front / __rear | (0, 0.10, ±0.99) | 0.55 / 0.50 | 0.20 |
| 1 | stakla__windshield | (0, 0.84, 0.54) | 0.36 | 0.30 |
| 1 | stakla__rear | (0, 0.76, −0.65) | 0.36 | 0.30 |
| 1 | senzori__park-front | (0, 0.90, 0.44) | 0.60 | 0.35 |
| 1 | farovi__l | (0.35, 0.45, 0.82) | 0.50 | 0.40 |
| 1 | stop-svetla__l | (0.35, 0.40, −0.85) | 0.45 | 0.45 |
| 1 | blatobrani__l | (0.62, 0.62, 0.48) | 0.60 | 0.55 |
| 1 | retrovizori__l | (0.70, 0.62, 0.35) | 0.70 | 0.60 |
| 1 | vrata__fl / __rl | (0.80, 0.52, 0.30) / (0.80, 0.52, −0.30) | 0.60 | 0.70 / 0.75 |
| 1 | stakla__side (one node, both sides) | (0, 1, 0) | 0.55 | 1.00 |
| 2 | felne-gume__fl / __rl | (1, 0, 0) | 0.72 / 0.70 | 0.00 / 0.40 |
| 3 | kocione-celjusti__fl / __rl | (0.50, 0.20, −0.84) | 0.46 | 0.00 |
| 3 | kocione-plocice__fl / __rl | (0.55, 0.15, −0.82) | 0.28 | 0.10 |
| 3 | abs-senzori__fl / __rl | (0.40, 0.80, −0.45) | 0.30 | 0.20 |
| 3 | kocioni-diskovi__fl / __rl | (1, 0, 0) | 0.21 | 0.35 |
| 3 | lezaj-glavcina__fl / __rl | (1, 0, 0) | 0.09 | 0.50 |
| 3 | amortizeri-opruge__fl / __rl | (0.20, 0.98, 0) | 0.45 | 0.60 |
| 3 | ramena-selen-blokovi__fl | (0.45, −0.45, 0.77) | 0.28 | 0.70 |
| 3 | ramena-selen-blokovi__rear-axle | (0, −0.30, −0.95) | 0.30 | 0.70 |
| 3 | spone-stabilizatori__tie-rod-l | (0.30, 0, −0.95) | 0.22 | 0.80 |
| 3 | spone-stabilizatori__stabilizer | (0, −1, 0) | 0.16 | 0.85 |
| 3 | letva-volana__main (along its own axis) | (0.90, 0.40, 0) | 0.22 | 0.95 |
| 4 | interkuler__main | (0, −0.13, 0.99) | 0.45 | 0.00 |
| 4 | interkuler__pipes | (0.30, 0.20, 0.93) | 0.40 | 0.10 |
| 4 | klima__condenser | (0, 0.12, 0.99) | 0.40 | 0.15 |
| 4 | akumulator__main | (0.39, 0.88, 0.29) | 0.51 | 0.20 |
| 4 | usisna-grana__airbox | (0.10, 0.99, −0.05) | 0.72 | 0.25 |
| 4 | hladnjak-ventilator__radiator | (0, 0.16, 0.99) | 0.30 | 0.30 |
| 4 | nosaci-motora__r | (−0.35, 0.50, 0.79) | 0.60 | 0.30 |
| 4 | kais-alternatora__belt (incl. crank damper) | (−0.78, 0.58, 0.24) | 0.51 | 0.35 |
| 4 | hladnjak-ventilator__fan | (0, 0.27, 0.96) | 0.26 | 0.45 |
| 4 | alternator__main | (−0.69, 0.45, 0.57) | 0.42 | 0.50 |
| 4 | anlaser__main | (0.31, −0.16, 0.94) | 0.32 | 0.55 |
| 4 | klima__compressor | (−0.72, −0.05, 0.69) | 0.44 | 0.60 |
| 4 | usisna-grana__manifold | (0, 0.89, 0.46) | 0.39 | 0.70 |
| 4 | termostat-creva__thermostat | (0.45, 0.89, 0) | 0.34 | 0.75 |
| 4 | termostat-creva__hoses | (0, 0.62, 0.78) | 0.32 | 0.80 |
| 4 | nosaci-motora__l | (0.60, 0.30, 0.74) | 0.55 | 0.90 |
| 4 | nosaci-motora__rear | (0, −1, 0) | 0.14 | 1.00 |
| 5 | paljenje-grejaci__coils (bore axis) | (0, 0.978, −0.208) | 0.85 | 0.00 |
| 5 | brizgaljke-pumpa-goriva__injectors | (0, 0.40, 0.92) | 0.35 | 0.05 |
| 5 | brizgaljke-pumpa-goriva__pump | (0.05, 0.996, −0.08) | 0.85 | 0.10 |
| 5 | egr-ventil__main | (0.48, 0.84, 0.24) | 0.42 | 0.15 |
| 5 | senzori__coolant-temp | (0.45, 0.80, 0.40) | 0.45 | 0.20 |
| 5 | zupcasti-kais-vodena-pumpa__belt | (−0.55, 0.45, 0.70) | 0.42 | 0.20 |
| 5 | zupcasti-kais-vodena-pumpa__water-pump | (−0.30, 0.95, 0.10) | 0.30 | 0.25 |
| 5 | motor__head | (0, 1, 0) | 0.60 | 0.30 |
| 5 | turbina__main | (0.10, 0.994, 0.05) | 0.50 | 0.50 |
| 5 | motor__block | (0, 1, 0) | 0.25 | 0.80 |
| 5 | karter-dihtunzi__sump | (0, −1, 0) | 0.03 | 0.90 |
| 6 | menjac__main | (0.30, 0.35, 0.89) | 0.45 | 0.00 |
| 6 | kvacilo-zamajac__main | (0.55, 0.80, −0.25) | 0.32 | 0.25 |
| 6 | poluosovine__l / __r (along the shaft axis) | (−0.93, 0.15, 0.33) / (0.94, −0.03, −0.33) | 0.24 / 0.22 | 0.50 |
| 7 | senzori__lambda | (0.50, 0.87, 0) | 0.35 | 0.00 |
| 7 | auspuh__mid | (0.97, −0.24, 0) | 0.50 | 0.15 |
| 7 | dpf-katalizator__main | (0.93, 0.33, −0.16) | 0.55 | 0.35 |
| 7 | auspuh__rear | (0.85, −0.10, −0.52) | 0.50 | 0.60 |

Vectors are normalised in code. The intent table lives in `config/explode.py`; tuned values go to `3d/build/explode.tuned.json`, and `export.py` stamps them into the extras and the manifest.

**If the static knuckles still trap the corners** after tuning, the fallback is to give them explode data (`clickable: false`, stage 3 after the strut, (±1, 0, 0) × 0.10, with hub 0.20 and disc 0.34). This needs a contract note and runtime support, so it is logged as a decision only if it is used.

### 6.4 Solver and checks (`3d/blender/explode.py`)
1. **Packaging (assembled):** world-space BVHs per part and static node, `overlap()`. Any hit fails unless it is a declared contact. This runs on the graybox from P0.
2. **Motion:** 201 samples of global p on **both** timelines (desktop windows; mobile sequential-within-group). Collision classes:
   - opaque ↔ opaque and opaque ↔ static anchors: strict;
   - X-ray panels/glass ↔ each other: final state only, aiming for ≥ 0.10 m gaps so the side panels separate;
   - X-ray ↔ opaque: reported as a "ghost overlap" (P2 when it shows in the hero view);
   - `body__structure` and the interior: exempt.
3. **Auto-tune:**
   1. Grow `dist` of the later-order node in 0.02 m steps up to 1.6×.
   2. Then rotate `dir` up to ±10° toward +y.
   3. Parts that stay boxed in are reported as **trapped**, with the blocking parts, for a manual vector or order change. This does not loop forever.
4. **Clearance:** gaps between opaque parts under 15 mm at p = 1 are warnings ("tight"). The ground check and the under-car rule are asserted.
5. **Readability audit:** Workbench flat per-object ID renders with AA off, at p = 1, from the exploded desktop and mobile cameras, with X-ray objects hidden. Solo areas come from single-object Workbench renders (≈ 0.2 s each).
   - Pass: `visible / solo` ≥ 0.40 (≥ 0.25 for inherently buried parts: water pump, hubs, pads).
   - Pass: ≥ 400 px at 1440 × 810.
6. **Reports:** `3d/build/reports/{packaging,motion,visibility}.json`. `validate.mjs` fails on errors or a stale `scriptsHash`.

---

## 7. Cameras
- **Azimuth:** 0° = front (+z), 90° = left (+x), 180° = rear. The same convention is used for the DS §7.4 lights.
- **FOV:** vertical, as in three.js. Blender cameras use `sensor_fit='VERTICAL'`, `angle_y = fov`, clip 0.05–100 m.
- **Solver** (`export.py`): bisection on distance plus a least-squares target offset, using the projected hull. Reference solutions come from the review simulation.

| Camera | Aspect | az / el | FOV | Constraint | Reference solution (position → target) |
|---|---|---|---|---|---|
| `hero.desktop` | 16:9 | 36° / 14° | 28° | assembled car = 56 % of the width, centred at x 64 %, y 52 % | (3.06, 2.20, 6.14) → (−0.90, 0.52, 0.69); car spans x 36–92 %, y 20–84 % |
| `exploded.desktop` | 16:9 | 43° / 24° (orbit 12.0°, dolly 1.3×) | 28° | envelope inside x [38 %, 94 %], y [12 %, 86 %] (copy column, callout lane, stage strip) | between (4.56, 4.21, 7.09) → (−0.88, 0.66, 1.26) [tight] and (5.41, 4.90, 8.30) → (−1.03, 0.69, 1.39) [8 % margin] |
| `hero.mobile` | 4:5 | 30° / 16° | 38° | car = 92 % of the width, centred, y 58 % | (2.98, 2.62, 5.82) → (−0.30, 0.74, 0.14); x 4–96 %, y 31–85 % |
| `exploded.mobile` | 4:5 | 36° / **20°** (orbit ≈ 6.9°) | 38° | envelope with 8 % margins | ≈ (5.43, 4.47, 7.94) → (−0.03, 0.72, 0.43); width-bound |

- The manifest keeps the contract's `{position, target, fov}`. The desktop targets sit about 0.9 m off the car to place it at 64 %. A lens shift (`filmOffset` / Blender `shift_x` ≈ 0.14–0.16) would keep the target on the car; that is an option for step 10 and would need an optional manifest field.
- **Category focus** (`categories[].focus`): `dir = normalize(0.55·ĉ + 0.35·ē + 0.10·ŷ)`.
  - ĉ points from the category's exploded centre to the exploded desktop camera, ē is the mean explode direction, ŷ is up.
  - `minDistance = clamp(2.4 · r, 0.45, 3.2)`, where r is the exploded bounding-sphere radius. `fov` 30°.
  - Service categories get `{dir: exploded-camera direction, minDistance: 0, fov: 30}` with `hasMesh: false` and `nodes: []`.
- **Node focus** (`focusDir` / `focusMinDist`) is computed per node from its own exploded bbox and direction; right-hand nodes are mirrored. This lets step 10 focus on the clicked node, or on `fl` when chosen from the list, instead of framing four corners at once.
- **Overrides:**
  - from the front-right: `zupcasti-kais-vodena-pumpa`, `kais-alternatora`, `alternator`, `klima`;
  - from low rear-left: exhaust and the rear axle;
  - from the left: `menjac`, `kvacilo-zamajac`.
- **Deep-link stage** for categories spread over several stages = max stage of their nodes (`senzori` → 7).
- **`labelAnchor`:** by default the top-centre of the node's local bbox + (0, 0.03, 0). Overrides: wheels (tyre top), doors (upper-front corner), glass (centre), belts (loop top), hoses (upper bend).

---

## 8. Lighting and rendering

### 8.1 Rig (one studio rig; posters mirror the web lights)
- **World:** Poly Haven **`studio_small_09` 2K .hdr**, fetched from `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_09_2k.hdr`.
  - sha256 pinned. Fallbacks: `studio_small_08`, then Blender's bundled CC0 `studio.exr`.
  - Strength **0.6** (DS §7.4), rotated so the main softbox sits at az ≈ 35°, el ≈ 40°.
- **Thumbnails / QA lights:**
  - area key 2 × 1 m, `#FFF4E8`, az 35° / el 40°;
  - area rim 1 × 3 m, `#CFEFFF` (QA) or `#9FE9FF` (thumbnails, DS §6.3), az 200° / el 25°;
  - shadows on.
- **Posters (parity with the web's DS §7.4 rig):**
  - Sun key `#FFF4E8` strength 1.6 at az 35° / el 40°; Sun rim `#CFEFFF` 1.2 at az 200° / el 25°. three.js directional intensity = Blender sun W/m² (both are irradiance into a Lambert BRDF).
  - Hemisphere fill as a world split: `#1C2530` above, `#0D0F11` below, radiance × 0.35/π.
  - **All shadows off** (the web has none); `world.sun_threshold` high; `use_sun_shadow=False`.
- **Shared environment for step 10:** a 512 × 256 Radiance copy of the same HDRI, `public/models/env/studio-512.hdr` (≈ 0.4 MB). Step 10 can self-host it for parity (its prompt asks for "a small self-hosted HDRI") or keep RoomEnvironment (D-list) and accept a small shift.
- **Colour everywhere:** Khronos PBR Neutral, look None, exposure 0, gamma 1, sRGB display.

### 8.2 Posters: two layers composited in display space (the same blend as three.js)
- **Layer A:** opaque parts + floor + contact shadow; shell hidden.
- **Layer B:** shell + glass + (desktop only) edge lines, with every opaque part set to holdout.
- Both are rendered film-transparent. `images.mjs` (sharp) blends B over A **in sRGB with straight alpha** and then over `#0D0F11`. This matches three.js, which tone-maps per fragment and blends in display space; one linear EEVEE pass would not.
- **Shell shader** `poster_xray(rimPower, rimScale, baseAlpha, tint, rimColor)`, mirroring DS §7.2:
  - `rim = pow(1 − clamp(dot(N, I)), rimPower) · rimScale`;
  - `col = mix(tint, rimColor, rim)` as Emission 1, plus Glossy(0.05) × 0.35;
  - `alpha = mix(baseAlpha, 0.92, rim)`, × 0.5 on back faces;
  - BLENDED.
  - Body: 2.6 / 1.0 / 0.22 assembled or 0.10 exploded / `#123642` / `#9FE9FF`. Glass: 3.2 / 0.7 / 0.06 / `#9FE9FF`. Mobile: rim power 2.2, no edges.
- **Edge lines:** Freestyle lineset on the shell collection. Crease (global `crease_angle` 152° = EdgesGeometry 28°) + Border. **Visibility RANGE, QI 0–1**: far-side edges seen only through the near shell stay; edges behind closed opaque parts go. This matches depth-tested `LineSegments` over a shell that writes no depth. Colour `#9FE9FF`, α 0.35 assembled / 0.20 exploded, 1 px at 2560.
- **Parity check (step 10):** SSIM ≥ 0.9 on the car region between poster and first frame. If it fails, step 10 may re-render the posters from its own WebGL stack with the same cameras (log a decision).

### 8.3 Floor and contact shadows (shared with the web)
- **`public/models/car-shadow.webp`** (assembled) and **`car-shadow-exploded.webp`** (p = 1).
  - 512², black + alpha, 45 % maximum.
  - Cycles top-down orthographic render of a white ground under a uniform white world, with the car invisible to the camera but casting shadows.
  - Converted to alpha, Gaussian 3 px. Footprint 5.2 m (assembled) / 6.4 m (exploded).
  - The web crossfades them along the explode; posters use the matching one.
- **Ruler floor**, procedural in both renderers with constants in `config/floor.py`:
  - 6.4 m disc, radial gradient `#15191D` → transparent at 55 %;
  - world-space lines every 0.5 m (`#9FE9FF` 6 %) and 1.0 m (10 %), 3 mm wide, radial fade from 2.2 m;
  - derivative anti-aliasing on the web, TAA in EEVEE.

### 8.4 Outputs
| Output | Size | Settings | Files |
|---|---|---|---|
| QA views | 1600 × 1000 | EEVEE TAA 64, studio rig; plus Workbench clay (matcap + cavity), zebra and fresnel passes | `3d/renders/qa/<timestamp>/<view>.png` (git-ignored) |
| Posters | 2560 × 1440 (16:9), 1080 × 1350 (4:5) | EEVEE TAA 128, poster rig, two layers | `public/images/hero/car-assembled.{avif,webp}` and `car-exploded.{avif,webp}` (2560, per the 08 prompt) + `-1920/-1440/-1080` + mobile `-m-1080/-m-828/-m-640`; AVIF q ≈ 55, WebP q ≈ 80 |
| Thumbnails (48) | 1024² master → 768² | Cycles OptiX, 128 spp adaptive (0.01) + denoise, studio rig, shadow catcher, film transparent. Camera az 35° / el 20°, **35 mm lens** (DS §6.3; switch to 50 mm if QA sees distortion, and log it). Bounding sphere fills 70 %, optical centre at 48 % height. X-ray slots → `thumb_primer` / `thumb_glass` | `public/images/parts/<slug>.webp` **transparent 768** (08 prompt); the DS radial background `#1A1E23 → #0F1114` is drawn by CSS in the UI; masters stay in `3d/renders/thumbs/` |
| Contact shadows | 512² | §8.3 | `public/models/car-shadow{,-exploded}.webp` |
| Web environment | 512 × 256 .hdr | downsampled studio HDRI | `public/models/env/studio-512.hdr` |
| Stage previews | 1440 × 810 | EEVEE, every stage end | `3d/renders/explode/stage-<n>.png` |

**Thumbnail compositions** (`config/thumbs.py`):
- Default = first instance (`fl` / `l` / `front` / `main`).
- Kits: `motor` (block + head); `usisna-grana` (manifold + airbox); `brizgaljke-pumpa-goriva`; `zupcasti-kais-vodena-pumpa` (belt kit + pump); `termostat-creva`; `klima`; `hladnjak-ventilator`; `spone-stabilizatori` (tie rod + stabilizer); `senzori` (lambda + PDC + temperature in a row).
- `poluosovine` uses `r`; `auspuh` uses `rear`. Parts whose working face points −x get a 180° yaw.
- **Service props** (`parts/props.py`, never exported): `filteri` (group of four), `filter-ulja` (spin-on canister), `filter-vazduha` (pleated panel), `filter-goriva` (inline canister), `filter-kabine` (pleated panel with a carbon layer), `ulja-tecnosti` (unbranded 4 L jug + 1 L bottle, no text).

**Render time on the RTX 4060:** QA set ≈ 2 min, posters ≈ 3 min, thumbnails ≈ 8 min (batches of 12, each command < 20 min), audit ≈ 2 min.

---

## 9. Export, optimisation, manifest, validation

### 9.1 Two builds, two exports
- `build.py --quality desktop` produces `3d/build/car.blend`; `--quality lite` produces `car-lite.blend`. Same builders, same config, same pivots and explode data.
- Before exporting, `export.py`:
  - applies modifiers, then triangulates (`keep_custom_normals`);
  - removes builder props and any non-F3 custom props;
  - asserts identity rotation/scale on part Empties;
  - sets the active collection to `EXPORT`.
```python
bpy.ops.export_scene.gltf(
    filepath=RAW_GLB, export_format='GLB',
    use_active_collection=True, use_active_collection_with_nested=True, use_renderable=True,
    export_extras=True, export_yup=True, export_apply=True,
    export_normals=True, export_texcoords=True, export_tangents=False,
    export_materials='EXPORT', export_image_format='AUTO', export_vertex_color='NONE',
    export_attributes=False, export_cameras=False, export_lights=False,
    export_animations=False, export_skins=False, export_morph=False,
    export_gpu_instances=False, export_shared_accessors=False,
    export_hierarchy_flatten_objs=False, export_hierarchy_full_collections=False,
    export_draco_mesh_compression_enable=False, export_use_gltfpack=False,
    export_unused_images=False, export_unused_textures=False)
```
- **Argument guard:** check against `bpy.ops.export_scene.gltf.get_rna_type().properties.keys()` and fail with a clear message.
- **Manifest, phase 1:** `export.py` writes `3d/build/manifest.base.json` with everything scene-derived: systems, stages, categories, parts (pivot, bbox, explode, labelAnchor, materials, focus), cameras, materials + overrides, bbox, `source.blender`, `source.scriptsHash` (sha256 of sorted `3d/blender/**/*.py` + config + taxonomy.json).

### 9.2 gltf-transform (`3d/scripts/optimize.mjs`, programmatic; never the CLI `optimize`)
Pipeline for each raw GLB:
1. `dedup({keepUniqueNames: true})`;
2. `prune({keepLeaves: false, keepAttributes: false, keepExtras: true})`;
3. `weld()`;
4. lite only, and only if it is over 250k: `simplify({ratio: 0.85, error: 0.0005, lockBorder: true})` as a top-up;
5. `textureCompress({encoder: sharp, targetFormat: 'webp', nearLossless: true, resize: [1024,1024] | [512,512]})`;
6. `meshopt({encoder: MeshoptEncoder, level: 'medium'})`: positions 14 bit, **normals 10 bit** (the 'high' mode's 8-bit octahedral normals band the fresnel rim), UV 12 bit.

Never use `flatten`, cross-mesh `join`, `instance` or `palette`.

- **Outputs:** `public/models/car.glb` and `car-lite.glb`, plus `3d/build/car{,-lite}.qa.glb` (quantized, not meshopt-compressed) for Blender re-import QA.
- **Expected:**
  - desktop ≈ 3.5–4.5 MB (≈ 455k unique tris at ≈ 6 B/tri + textures ≈ 1 MB);
  - lite ≈ 1.3–1.8 MB.
- **Manifest, phase 2:** `optimize.mjs` inspects both GLBs (triangles per part and total, draw calls = primitives in the scene graph, textures, bytes, sha256), fills `models.*` and `parts[].triangles`, and writes `public/models/car.manifest.json`. It keeps the previous `generatedAt` when nothing else changed, so rebuilds cause no git noise.

### 9.3 Validation (`3d/scripts/validate.mjs`, exit 1 on any error)
- **Budgets:** desktop ≤ 8 MB (warn > 6.5), tris < 800k (warn outside 450–600k), draw calls ≤ 220, textures ≤ 10 at ≤ 1024², nodes ≤ 400. Lite ≤ 3 MB, ≤ 250k tris, ≤ 150 draw calls, textures ≤ 512², ≤ 300 nodes. All textures WebP.
- **Names:** F2 regex (root `sklop_car` exempt), unique, ASCII, no unnamed nodes.
- **Structure:**
  - mesh nodes are leaves with a `part__` / `body__` / `chassis__` parent;
  - part nodes have identity rotation/scale and translation = manifest pivot ± 0.1 mm;
  - both GLBs contain the same name set.
- **Extras:**
  - only on part nodes, exactly the F3 keys with the right types;
  - unit `explodeDir`; stage per taxonomy including the `senzori` overrides; `labelSr` equal to the taxonomy instance label.
- **Coverage:**
  - all 91 `allPartNodes()` in both GLBs;
  - manifest ↔ taxonomy 1:1: 44 categories (42 `hasMesh`), systems, stages/windows, thumbnails.
- **Materials:** ≤ 24, names from the contract list, overrides flagged, every textured primitive has TEXCOORD_0.
- **Geometry and files:**
  - car bbox length 4.2–4.4 m;
  - ground rule (wheels exempt);
  - files: 48 thumbnails, all poster variants, both shadows, env HDR;
  - sha256 matches.
- **Reports:** §6.4 reports clean and fresh.
- **Khronos gltf-validator:** 0 errors on both GLBs.
- **Tests:**
  - `tests/unit/3d-manifest.test.ts` (Vitest) compares taxonomy ↔ manifest (F4) and checks that every instance has a `labelSr`;
  - `lib/three/manifest.ts` gets the TS types + a zod schema, which step 10 extends with the loader.

---

## 10. Script architecture
```
3d/
  blender/
    build.py        entry: --quality desktop|lite, --only <module>[,…], --graybox[=<module>,…], --out
    explode.py      entry: --check (packaging) | --solve (explode.tuned.json) | --motion | --preview
    export.py       entry: raw GLB + manifest.base.json (strips helper props)
    render.py       entry: --set qa|posters|thumbs|shadow|audit|explode|env [--only <slug|view>] [--glb <qa.glb>]
    config/         vehicle.py (hard points) · parts.py (node specs: module, pivot rule, materials, tri target,
                    anchors, thumb) · explode.py · contacts.py · cameras.py · thumbs.py · floor.py · materials.py
    lib/            scene.py (reset, units, collections, V(), naming, extras, Empty + child, mirror/duplicate)
                    modeling.py (lathe, extrude_profile, cdt_cap, sweep, helix, radial_array, gear_profile,
                                 belt_path, bevel + weighted stack, apply, uv helpers)
                    bodyshell.py (master loft, grid regions, gaps, hems, bounded cutters, normal transfer)
                    materials.py · textures.py · measure.py (bbox, tris, BVH overlap, motion sampling)
                    taxonomy.py (reads 3d/build/taxonomy.json) · log.py
    parts/          wheels.py · brakes.py · suspension.py · steering.py · engine.py · turbo.py · intake.py
                    fuel.py · belts.py · electrical.py · cooling.py · drivetrain.py · exhaust.py
                    body.py · lighting.py · props.py
  scripts/          run.mjs (stage runner + cache) · taxonomy-json.mjs · fetch-assets.mjs
                    optimize.mjs · validate.mjs · images.mjs (sharp) · preview.mjs (three + Playwright GLB check)
  assets/hdri/      fetched HDRI (git-ignored)        assets/textures/ generated PNG masters (git-ignored)
  build/            *.blend (ignored, D23) · *.raw.glb · *.qa.glb · manifest.base.json · taxonomy.json ·
                    explode.tuned.json · reports/
  renders/          qa/ · explode/ · thumbs/ · posters/ (ignored)
```
- **Modules and tags:** every object gets `sk_builder=<module>` and `sk_quality`. `build.py --only brakes` opens the saved `.blend`, deletes exactly the objects tagged `brakes`, rebuilds them and saves, in seconds. 16 modules write into 9 systems without wiping each other. Unfinished modules fall back to graybox proxies, so the pipeline always runs end to end.
- **Stages:** `run.mjs` runs `taxonomy → assets → build (desktop, lite) → explode → export → optimize → render → images → validate`.
  - Each stage hashes its inputs into `3d/build/.cache.json` and is skipped when unchanged (`--force` overrides).
  - Outputs are written to temp files and renamed.
  - npm scripts: `3d`, `3d:build`, `3d:render`, `3d:validate`.
- **Blender calls (Git Bash):**
  - build: `"$BLENDER_EXE" -b --factory-startup --python-exit-code 1 -P 3d/blender/build.py -- --quality desktop --out 3d/build/car.blend`
  - later stages open the file: `"$BLENDER_EXE" -b --factory-startup "3d/build/car.blend" --python-exit-code 1 -P 3d/blender/export.py -- …`
  - Every script asserts `bpy.app.version >= (5, 1, 0)`, prints progress, uses `pathlib` and quotes paths.

---

## 11. QA protocol
**Severity** (recorded in `docs/3d/QA.md`; the step 08 DoD and step 09 goal require no open P0/P1):
- **P0** — broken or blocking:
  - validator fail, missing or misnamed part;
  - holes, black faces or interpenetration in a hero view;
  - a brand cue.
- **P1** — clearly visible defect in a poster, hero view or thumbnail:
  - lumpy shell or wobbling rim;
  - wrong proportions of a priority part;
  - an opaque collision at p = 1;
  - a part that fails the visibility audit.
- **P2** — minor: a seam in a close-up, a tight clearance, a ghost overlap.
- **P3** — polish.

**Standard views every round:** front ¾ left (hero cam), rear ¾ right, side left (ortho), top (ortho), front (ortho), exploded desktop, exploded mobile, underside ¾, and a contact sheet of stage ends 0–7. Also:
- system close-ups with the shell hidden;
- clay (Workbench matcap + cavity) per system;
- zebra + fresnel on the shell;
- re-import renders of both `.qa.glb` files.

Every PNG is opened with the Read tool before a verdict is written. **At least 16 part close-ups** (the step 09 goal needs ≥ 12): turbina, front brake corner (disk + čeljust + pločice), amortizer fl, kvačilo i zamajac, zupčasti kaiš + vodena pumpa, hladnjak + ventilator, alternator, anlaser, akumulator, far l, felna i guma, menjač, blok + glava, interkuler, DPF, letva + spone.

**Per-part checklist:**
- key dimensions within ±10 % of §1/§3;
- silhouette readable at 320 px;
- consistent bevel language;
- clean normals;
- packaging report clean;
- correct material slots;
- names and extras (validator);
- tris within ±25 %;
- pivot at the mounting point or centre;
- explode along the assembly axis, with no collision and visibility above threshold.

**Art-director pass** (scored 1–5; posters and the ten priority parts need ≥ 4, everything else ≥ 3):
1. Reads instantly as a generic compact hatchback, with no brand cues.
2. Clean rim with no lumps, crisp panel outlines.
3. A mechanic recognises each priority part at a glance.
4. Material honesty: cast, machined, rubber and plastic are distinguishable.
5. Light reveals form, with no blown or crushed tones.
6. Exploded composition: clear tiers, balanced negative space, nothing touching, fits the frame.
7. Consistent detail scale.
8. No kitsch.
9. Thumbnails share angle, size and centre.
10. Poster ↔ 3D parity.

**Recording:** `docs/3d/QA.md` holds one table per round (date, round, view/part, score, severity, verdict PASS/FIX/WAIVE, note, render path), a summary per category, and open items carried to step 09.

---

## 12. Order of work (step 08: ≤ 8 h of work + 1 h reserve inside 540 min)

| Phase | Content | Budget | Exit |
|---|---|---|---|
| P0 | Save the plan verbatim to `docs/3d/PLAN.md`; `docs/progress/08.md` checklist; deps; taxonomy labels + test; lib scaffolding; **graybox of every node with real material lists**; export → optimise → validate → manifest end to end; packaging + motion checks on the graybox; commit | 1.0 h | validator green on the graybox, packaging clean, draw calls counted |
| P1 | Systems in this order, each looping build → QA renders → Read → fix → checklist → commit (`3d: <system>`): (1) wheels + brakes + hubs · (2) suspension + steering + subframe + knuckles · (3) engine core + turbo + fuel + ignition · (4) belts + ancillaries + intake + cooling + battery/sensors · (5) transmission + exhaust | 4.5 h | each system AD ≥ 3, priority parts ≥ 4 |
| P2 | Body & glass pass incl. lamps (interior only if cheap) | 1.25 h | zebra/fresnel clean, no P1 |
| P3 | Global art-director pass on full-car renders; explode solve on final geometry; cameras | 0.5 h | motion 0 errors, visibility met |
| P4 | Lite build, export/optimise/validate, posters, thumbnails, shadows, env HDR, BUILD-NOTES (rebuild, swap a part for a purchased model, add a part), QA.md, DECISIONS, PROGRESS, contract clarifications, commit | 0.75 h | all checks green |
| Reserve | Overruns, re-renders | 1.0 h | |

**Cuts decided up front:**
- no vertex AO;
- no interior unless P2 ends early;
- low-priority parts built "clean simple" from the start, still credible: mounts, sensors, hoses, EGR, HP pump, wipers, tie rods, thermostat, PDC;
- priority parts first within each system.

**If time still runs short, in this order:**
1. thumbnails in EEVEE;
2. posters without Freestyle edges;
3. tyre grooves as normal map only;
4. fewer vanes and blades;
5. fewer body feature lines (keep the silhouette and gaps);
6. accept "tight" warnings (never intersections).

**Step 09** (goal loop, 420 min) takes the detail iteration on priority parts and the remaining P2s.

---

## 13. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Procedural body looks lumpy or cheap | Shut lines on grid iso-lines, separate bumper/lamp lofts, normal transfer, hems, zebra/fresnel QA; fallback: fewer features with perfect smoothness |
| gltf-transform breaks the hierarchy or moves parts | Programmatic pipeline; Empty + single child; validator checks pivots and the name set |
| Draw calls or triangles over budget | Material lists fixed per part and counted from the graybox; shared meshes; lite built from the scripts |
| Explode overlaps or trapped parts | Outside-in order, under-car rule, BVH motion on both timelines, trapped-part report, visibility audit, knuckle fallback |
| Engine-bay packaging | Corrected hard points; packaging BVH check from P0 with declared contacts |
| Blender 5.1 API drift | §0 facts, version guard, exporter-arg introspection, bmesh/data API first, `temp_override` for operators |
| Poster ≠ 3D | Same cameras, tone map, lights, no shadows, display-space composite, shared floor/shadows/env; step 10 SSIM check with the WebGL re-render fallback |
| Fresnel banding / normal-map damage | meshopt `medium` (10-bit normals); near-lossless WebP |
| Render time | EEVEE for QA and posters; Workbench audit; Cycles OptiX + adaptive + denoise for thumbnails, in batches under 20 min |
| Network | Direct `dl.polyhaven.org` URL with sha256; bundled CC0 `studio.exr` fallback |
| Trademark resemblance | Styling guard (§1); no text or logos |
| Unattended crash or compaction | Module rebuilds, stage cache, atomic writes, commit per system, `docs/progress/08.md` |
| Transparent sorting on the web | Shell split into 5 structure children + separate panels |

---

## 14. Decisions for step 08 to log (`docs/DECISIONS.md`) and doc updates
1. Part nodes are Empties with a single `mesh__…__0` child. Both GLBs have the identical node set; lite is built by the scripts (`quality='lite'`), not by simplification; `lod: "detail"` is unused.
2. `mat_core_fins` is the 24th slot. "Anodized" is `mat_caliper`. Chrome is used only on the exhaust tip. Painted black has a 0.3 clearcoat.
3. Programmatic gltf-transform pipeline with meshopt `medium` (10-bit normals) and near-lossless WebP normal maps. The manifest is generated in two phases with a stable `generatedAt`.
4. Posters use the studio HDRI plus the web's directional lights, no shadows, and a two-layer display-space composite. `studio-512.hdr` is offered to step 10.
5. Static `chassis__knuckle__fl/fr` and `body__structure__*` children; root exemption from the regex.
6. `TaxonomyInstance.labelSr` in `lib/catalog/taxonomy.ts`.
7. MQB-style packaging: narrow block, rotated install, FMIC pipes in front, crank damper in `kais-alternatora`.
8. Explode timing formula, outside-in order, under-car rule, and the recommendation to run mobile groups sequentially.
9. Thumbnails are transparent 768 px (08 prompt), with the DS background drawn in CSS (refines DS §6.3).
10. HDRI and generated textures are git-ignored and reproducible.
11. No vertex AO in v1.

**Doc updates:**
- `docs/3D-CONTRACT.md`:
  - §F2: Empty + child, root exemption, static nodes;
  - §F3: timing formula, `lod` unused;
  - §F4: two-phase manifest, same node set;
  - §F5: 24th slot, lite from scripts, meshopt medium;
  - §F6: mobile sequential grouping;
  - §F7: shadow and env files, floor constants.
- `.gitignore`: `3d/assets/hdri/`, `3d/assets/textures/*.png`, `3d/build/*.glb`, `3d/build/reports/`.
- `docs/3d/{PLAN,BUILD-NOTES,QA}.md`; PROGRESS.

---

## 15. Verification (end of step 08)
- `node 3d/scripts/run.mjs all` exits 0; `node 3d/scripts/validate.mjs` prints PASS with the budget table (size, tris, draw calls, nodes, textures for both GLBs).
- `gltf-validator` reports 0 errors on both GLBs.
- `npm run test:unit` passes (incl. `3d-manifest.test.ts`); `npx tsc --noEmit` and `npm run lint` pass.
- `preview.mjs`: headless Chromium loads both GLBs with the meshopt decoder; node names match the manifest; a hero-cam screenshot is reviewed.
- QA renders are opened and their verdicts recorded, with no open P0/P1. The 48 thumbnails, the poster set, both shadows and the env HDR exist. Everything is committed.

## 16. Notes for step 10
- Crossfade parity:
  - use the manifest cameras exactly during the crossfade, then ease to DS §7.6 tablet framings;
  - keep the vertical FOV up to the poster aspect and lock the horizontal FOV when wider;
  - build the edge lines before the crossfade (or accept a late fade-in);
  - optionally self-host `studio-512.hdr` at 0.6;
  - crossfade the two contact shadows along the explode.
- Explode:
  - implement the §6.2 timing formula;
  - run mobile grouped stages sequentially;
  - deep-link stage = max node stage.
- Focus: focus the clicked node (or `fl`); the category bbox framing applies to single-node categories.
- Hover tint needs per-part material instances or per-object uniforms, because materials are shared across parts.
- Lens shift (`filmOffset`) would let targets sit on the car. It needs an optional manifest field (contract amendment).
