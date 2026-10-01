# SKLOP — 3D contract

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [DESIGN-BRIEF](DESIGN-BRIEF.md) · `docs/design/DESIGN-SYSTEM.md` (3D art direction, from step 03) · [ROUTES](ROUTES.md) (home hero, `?deo=`) · [DATA-MODEL](DATA-MODEL.md) (categories.partKey). Slugs in §F1 are frozen; `lib/catalog/taxonomy.ts` is the code source of truth and must match this file.

## F. 3D contract

### F1. Final taxonomy (slugs frozen)
Stage = explode stage (§F6). Instances are node suffixes (`part__<category>__<instance>`). Service categories have no mesh (thumbnail render of a representative item only).

| System (slug · label) | Category slug | Label (sr) | Instances | Stage |
|---|---|---|---|---|
| `motor-i-usis` · Motor i usis | `motor` | Blok motora i glava | `block`, `head` | 5 |
| | `turbina` | Turbina (turbopunjač) | `main` | 5 |
| | `interkuler` | Interkuler | `main`, `pipes` | 4 |
| | `usisna-grana` | Usisna grana i kućište filtera | `manifold`, `airbox` | 4 |
| | `brizgaljke-pumpa-goriva` | Brizgaljke i pumpa goriva | `injectors`, `pump` | 5 |
| | `zupcasti-kais-vodena-pumpa` | Set zupčastog kaiša i vodena pumpa | `belt`, `water-pump` | 5 |
| | `kais-alternatora` | Kaiš alternatora i zatezači | `belt` | 4 |
| | `alternator` | Alternator | `main` | 4 |
| | `anlaser` | Anlaser | `main` | 4 |
| | `paljenje-grejaci` | Svećice, bobine i grejači | `coils` | 5 |
| | `karter-dihtunzi` | Karter, pumpa ulja i dihtunzi | `sump` | 5 |
| | `egr-ventil` | EGR ventil | `main` | 5 |
| | `nosaci-motora` | Nosači motora i menjača | `l`, `r`, `rear` | 4 |
| `izduvni-sistem` · Izduvni sistem | `dpf-katalizator` | DPF i katalizator | `main` | 7 |
| | `auspuh` | Auspuh (lonci i cevi) | `mid`, `rear` | 7 |
| `hladjenje-i-klima` · Hlađenje i klima | `hladnjak-ventilator` | Hladnjak i ventilator | `radiator`, `fan` | 4 |
| | `termostat-creva` | Termostat i creva hlađenja | `thermostat`, `hoses` | 4 |
| | `klima` | Kompresor i kondenzator klime | `compressor`, `condenser` | 4 |
| `transmisija` · Transmisija | `kvacilo-zamajac` | Kvačilo i zamajac | `main` | 6 |
| | `menjac` | Menjač (DSG) | `main` | 6 |
| | `poluosovine` | Poluosovine i homokinetički zglobovi | `l`, `r` | 6 |
| `vesanje-i-upravljanje` · Vešanje i upravljanje | `amortizeri-opruge` | Amortizeri i opruge | `fl`, `fr`, `rl`, `rr` | 3 |
| | `ramena-selen-blokovi` | Ramena i selen blokovi | `fl`, `fr`, `rear-axle` | 3 |
| | `spone-stabilizatori` | Spone i stabilizatori | `tie-rod-l`, `tie-rod-r`, `stabilizer` | 3 |
| | `letva-volana` | Letva volana | `main` | 3 |
| | `lezaj-glavcina` | Ležaj točka i glavčina | `fl`, `fr`, `rl`, `rr` | 3 |
| `kocnice` · Kočnice | `kocioni-diskovi` | Kočioni diskovi | `fl`, `fr`, `rl`, `rr` | 3 |
| | `kocione-plocice` | Kočione pločice | `fl`, `fr`, `rl`, `rr` | 3 |
| | `kocione-celjusti` | Kočione čeljusti | `fl`, `fr`, `rl`, `rr` | 3 |
| | `abs-senzori` | ABS senzori | `fl`, `fr`, `rl`, `rr` | 3 |
| `elektrika-i-svetla` · Elektrika i svetla | `akumulator` | Akumulator | `main` | 4 |
| | `farovi` | Farovi | `l`, `r` | 1 |
| | `stop-svetla` | Stop svetla | `l`, `r` | 1 |
| | `senzori` | Senzori (lambda, parking, temperatura) | `lambda` (7), `park-front` (1), `coolant-temp` (5) | per node |
| `karoserija` · Karoserija | `hauba` | Hauba | `main` | 1 |
| | `branici` | Branici | `front`, `rear` | 1 |
| | `blatobrani` | Blatobrani | `l`, `r` | 1 |
| | `vrata` | Vrata | `fl`, `fr`, `rl`, `rr` | 1 |
| | `retrovizori` | Retrovizori | `l`, `r` | 1 |
| | `stakla` | Stakla | `windshield`, `rear`, `side` | 1 |
| | `brisaci` | Brisači | `main` | 1 |
| `tockovi` · Točkovi | `felne-gume` | Felne i gume | `fl`, `fr`, `rl`, `rr` | 2 |
| `servis` · Servis i održavanje | `filteri` (subcategories `filter-ulja`, `filter-vazduha`, `filter-goriva`, `filter-kabine`) | Filteri | — (no mesh) | — |
| | `ulja-tecnosti` | Ulja i tečnosti | — (no mesh) | — |

Totals: 10 systems, 44 categories (42 with meshes, 91 clickable nodes), 4 filter subcategories. Corner codes: `fl/fr/rl/rr` = front/rear left/right from the driver's seat. Renames vs. the brief's initial list: `usis-filter-vazduha` → `usisna-grana` (air filters live in `filteri/filter-vazduha`), `ulje-karter` → `karter-dihtunzi` (oil filters live in `filteri/filter-ulja`); related links keep both paths discoverable (`relatedSlugs`, part panel „Povezano: Filteri vazduha").

### F2. Space, units, pivots
- glTF 2.0 binary, **meters**, **+Y up, +Z vehicle front, +X vehicle left** (LHD driver side). Blender authoring: Z-up, front = −Y, left = +X; the exporter's Y-up conversion maps Blender (x, y, z) → glTF (x, z, −y). All manifest vectors are in glTF space; `export.py` converts.
- Origin: ground plane (Y = 0), centred on the wheelbase midpoint and the vehicle centreline. Car ≈ 4.28 × 1.79 × 1.45 m, wheelbase ≈ 2.62 m, 205/55 R16 tyres (Ø ≈ 0.632 m) — step 07 finalizes.
- Every `part__*` node's origin = its mounting point or geometric centre (explode moves node positions); rotation/scale applied (identity scale); no negative scales.
- Non-clickable nodes: `body__structure` (X-ray shell: roof, pillars, quarter panels, sills, tailgate), optional `body__interior` (dash/seat silhouettes), `chassis__subframe`. Child meshes of multi-mesh parts: `mesh__<category>__<instance>__<n>` (no extras; runtime resolves the nearest `part__` ancestor).
- Hierarchy: `sklop_car` (root) → `sys__<system>` groups → `part__…` / `body__…` nodes. Names match `^(part|mesh|body|sys|chassis)__[a-z0-9-]+(__[a-z0-9-]+){0,2}$`, unique, ASCII (GLTFLoader sanitizes spaces, dots, colons, slashes, brackets — never use them).
- **Step 08 build (clarifies the above):** every `part__*` node is a transform-only Empty (identity rotation/scale, translation = manifest `pivot`) with exactly one mesh child `mesh__<category>__<instance>__0` (one primitive per material). Shared meshes (wheels, discs, pads, hubs) are linked duplicates; the right-hand copy may carry a 180° yaw on the **mesh child**, never on the part node. The root `sklop_car` is the only name exempt from the regex. Static nodes: `body__structure` (Empty) → `body__structure__{upper,left,right,rear}`; `chassis__subframe`; `chassis__knuckle__fl/fr`. Every mesh-bearing node is a leaf (so meshopt quantization never adds unnamed nodes). Both GLBs carry the identical node-name set.

### F3. Node extras (Blender custom properties → glTF `extras` → three.js `userData`)
```json
{ "partId": "kocioni-diskovi__fl", "category": "kocioni-diskovi", "system": "kocnice",
  "labelSr": "Kočioni disk — prednji levi", "clickable": true, "lod": "core",
  "explodeDir": [0.94, 0.0, 0.34], "explodeDist": 0.42, "explodeStage": 3, "explodeOrder": 0.25,
  "labelAnchor": [0.0, 0.16, 0.0], "focusDir": [0.62, 0.35, 0.70], "focusMinDist": 1.1 }
```
`explodeDir` unit vector in glTF space; `explodeDist` meters; `explodeOrder` 0–1 stagger inside the stage; `labelAnchor` local offset for the callout leader line; `lod: "detail"` nodes are dropped from the lite GLB (each category keeps ≥ 1 core node).
- **Step 08:** all 91 nodes are `lod: "core"` (`"detail"` stays reserved and unused; the lite GLB has the same nodes with lighter geometry and ≤ 3 materials per part). Timing inside a stage window `[s, e]`: `u = clamp((p − s)/(e − s))`, `local = clamp((u − 0.35 · explodeOrder)/0.65)`, `offset = explodeDir × explodeDist × power2.inOut(local)` (`explodeFactor` in `lib/three/manifest.ts`).

### F4. Manifest (`public/models/car.manifest.json`, generated by `3d/blender/export.py`, validated by `3d/scripts/validate.mjs`; TS types in `lib/three/manifest.ts`)
```ts
type Vec3 = [number, number, number]; type Box3 = { min: Vec3; max: Vec3 };
type Cam = { position: Vec3; target: Vec3; fov: number };
type CarManifest = {
  schemaVersion: 1; generatedAt: string;
  source: { blender: string; scriptsHash: string };
  models: { desktop: ModelFile; lite: ModelFile };           // same node names in both
  units: "meters"; axes: { up: "+Y"; front: "+Z"; left: "+X" };
  bbox: Box3;                                                // assembled car
  systems: { slug: string; labelSr: string; order: number }[];
  stages: { stage: number; key: string; labelSr: string; scroll: { desktop: [number, number]; mobile: [number, number] } }[];
  categories: { slug: string; labelSr: string; system: string; nodes: string[]; hasMesh: boolean;
                thumbnail: string; focus: { dir: Vec3; minDistance: number; fov: number } }[];
  parts: { node: string; partId: string; category: string; system: string; labelSr: string;
           clickable: boolean; lod: "core" | "detail";
           explode: { dir: Vec3; distance: number; stage: number; order: number };
           pivot: Vec3; bbox: Box3; labelAnchor: Vec3; triangles: { desktop: number; lite: number };
           materials: string[] }[];
  cameras: { hero: { desktop: Cam; tablet: Cam; mobile: Cam }; exploded: { desktop: Cam; tablet: Cam; mobile: Cam } }; // crop per lib/three/framing.ts: desktop 16:9 (≥ 1024 px), tablet 1:1 (768–1023 px), mobile 4:5
  materials: { name: string; override?: "xray-body" | "xray-glass" }[];
};
type ModelFile = { url: string; bytes: number; sha256: string; triangles: number; drawCalls: number; textures: number };
```
The categories table in Convex (`partKey`) and `categories[]` in the manifest must match 1:1 (a unit test compares `lib/catalog/taxonomy.ts` — the single source for slugs/labels/systems — with the manifest and the seed).
- **Step 08:** the manifest is written in two phases — `export.py` writes the scene data to `3d/build/manifest.base.json`, `optimize.mjs` adds `models.*` (bytes, sha256, triangles, draw calls) and `parts[].triangles` and keeps `generatedAt` when nothing else changed. Service categories (`filteri`, `ulja-tecnosti`) have `hasMesh: false`, `nodes: []` and `focus = { dir: exploded-camera direction, minDistance: 0, fov: 30 }`. `tests/unit/3d-manifest.test.ts` checks taxonomy ↔ manifest.

### F5. Materials and budgets
Material slot names (≤ 24): `mat_body_xray`, `mat_glass_xray` (both replaced by the X-ray shader at runtime; exported opaque), `mat_glass_lens`, `mat_cast_iron`, `mat_machined_steel`, `mat_steel_dark`, `mat_brushed_alu`, `mat_cast_alu`, `mat_painted_black`, `mat_plastic_black`, `mat_plastic_grey`, `mat_rubber`, `mat_tyre`, `mat_hose`, `mat_chrome`, `mat_copper`, `mat_ceramic`, `mat_caliper` (graphite/accent — never an automaker's brand colour), `mat_battery`, `mat_heat_shield`, `mat_wire`, `mat_emissive_led`, `mat_emissive_tail`. glTF-compatible Principled inputs only; procedural nodes baked.

| Budget | `car.glb` (desktop) | `car-lite.glb` (mobile) |
|---|---|---|
| File size | target ≤ 6.5 MB, hard ≤ 8 MB | ≤ 3 MB |
| Triangles | target 450–600 k, hard < 800 k | ≤ 250 k |
| Draw calls (after merging per part × material) | ≤ 220 | ≤ 150 |
| Textures | ≤ 10, ≤ 1024², WebP (tyre sidewall/tread normal, radiator/condenser fins, disc surface, heat shield) | ≤ 512² |
| Nodes | ≤ 400 | ≤ 300 |
| Runtime | 60 fps desktop while scrubbing, GPU memory ≤ 60 MB including the drawing buffer (4× MSAA only below DPR 1.5, D244) | ≥ 30 fps mid-range phone |

Compression: gltf-transform `dedup → weld → prune → (lite: simplify ratio 0.5, error 0.001) → textureCompress webp (resize 1024 / 512) → meshopt`. Web decoding with the meshopt decoder (WASM, workers where available).
- **Step 08:** 24th slot `mat_core_fins` (radiator, condenser and intercooler cores, fin normal map); "anodized" = `mat_caliper`; chrome only on the exhaust tip; `mat_painted_black` has a 0.3 clearcoat (`KHR_materials_clearcoat`). The lite GLB is **built by the scripts** (`build.py --quality lite`, desktop pivots reused) instead of simplified; the programmatic pipeline is `dedup → prune → weld → textureCompress (WebP near-lossless for normal maps) → meshopt level "medium"` (10-bit normals — "high" bands the fresnel rim); never the CLI `optimize` (it flattens the hierarchy).

### F6. Explode choreography (scroll-bound)
Desktop track 320 vh pinned, mobile 200 vh; progress `p ∈ [0,1]`; each node moves `pivot + dir × distance × power2.inOut(local)` with `local` from its stage window, staggered by `explode.order`.

| Stage | Key / label | Desktop window | Mobile (grouped) |
|---|---|---|---|
| 0 | hold assembled, headline | 0.00–0.08 | 0.00–0.10 |
| 1 | `karoserija` — Karoserija, stakla i svetla | 0.08–0.24 | 0.10–0.32 (1+2) |
| 2 | `tockovi` — Točkovi | 0.18–0.32 | ″ |
| 3 | `kocnice-vesanje` — Kočnice, vešanje, upravljanje | 0.28–0.46 | 0.30–0.52 |
| 4 | `agregati` — Pomoćni agregati, hlađenje, usis | 0.42–0.58 | 0.50–0.74 (4+5) |
| 5 | `motor` — Motor, turbina, gorivo, paljenje | 0.54–0.72 | ″ |
| 6 | `transmisija` — Menjač, kvačilo, poluosovine | 0.68–0.84 | 0.72–0.92 (6+7) |
| 7 | `izduvni` — Izduvni sistem | 0.80–0.92 | ″ |
| — | hold exploded, hint „Kliknite na deo" | 0.92–1.00 | 0.92–1.00 |

Camera: dolly-out + ~12° orbit from `cameras.hero` to `cameras.exploded` across 0.08–0.92. X-ray shell opacity 0.22 → 0.10 during stage 1. Stage captions are HTML overlays (system name, part count, measurement ticks) revealed per stage. The exploded layout must read as a clean technical drawing from the hero camera (no overlaps at p = 1).
- **Step 08:** on mobile the two stages of a group run **sequentially** inside the shared window (first stage over its first 55 %, second over the last 55 %) — the explode data are checked for collisions on exactly this timeline and on the desktop one (`3d/build/reports/motion.json`).

### F7. Loading, poster, fallback, tiers
1. SSR: hero section with a sticky frame; poster `car-assembled` via `next/image` (`preload`, `fetchPriority="high"`, `sizes="100vw"`; art-directed portrait crop < 768 px via `getImageProps` + `<picture>`), LCP-safe headline, OEM search (plain GET form to `/pretraga` without JS), vehicle-picker slot, „Lista delova" button. Scroll track height reserved by CSS media queries from the first paint (no layout shift when 3D arrives): `≥1024px & no-preference` → 320 vh, `<1024px & no-preference` → 200 vh, `reduce` → 100 vh.
2. After hydration: tier detection (`lib/three/tier.ts`): **high** (≥ 1024 px, WebGL2, ≥ 4 cores, `deviceMemory ≥ 4` when present, no Save-Data) → desktop GLB, DPR ≤ 2 adaptive; **mid** (capable phones/tablets) → lite GLB, DPR ≤ 1.5, simplified X-ray shader, tap-only; **low** (no WebGL2, a software WebGL renderer — SwiftShader, llvmpipe, softpipe, Microsoft Basic Render — Save-Data, `deviceMemory < 3`; QA forces a tier with `?3d=high|mid`) → no 3D: GSAP crossfade assembled ↔ exploded posters along the same track + stage captions.
3. Start 3D on first intent (pointer over hero, scroll > 40 px, touchstart, focus inside hero) or `requestIdleCallback` ≥ 4 s after `load`. Then dynamic-import the canvas chunk (budget ≤ 350 KB gz for three + r3f + used drei parts), fetch manifest + GLB, decode, `renderer.compileAsync`, build BVH in idle slices.
4. First frame ready → GSAP crossfade poster → canvas (600 ms); poster stays underneath for context-loss fallback. Progress = 2 px hairline inside the hero frame (fixed size), no layout shift; SR text only after intent („Učitava se 3D prikaz").
5. WebGL context loss → poster, one restore attempt; persistent failure → stay on posters silently.
6. Reduced motion → no pin/scrub; „Rasklopi / Sklopi" toggles states instantly; camera moves are cuts.
7. **Step 08 files:** posters `public/images/hero/car-{assembled,exploded}{,-1920,-1440,-1080}.{avif,webp}` (16:9, 2560 master, ≥ 1024 px), `…-t-{1536,1080,768}.{avif,webp}` (1:1, 768–1023 px, mid-tier look without edge lines) and `…-m-{1080,828,640}.{avif,webp}` (4:5, phones), rendered from the manifest cameras of the same crop; contact shadows `public/models/car-shadow.webp` (assembled, 5.2 m square) and `car-shadow-exploded.webp` (p = 1, 6.4 m square): 512², black with alpha ≤ 45 %, top-down, **image up = vehicle front (+Z), image left = vehicle left (+X)**, centred on the origin — crossfade them along the explode; `public/models/env/studio-pmrem.hdr` = three's PMREM cube-UV atlas (cube 64 → 336 × 256 RLE RGBE, ≈ 140 KB) of the poster HDRI, baked by `3d/scripts/env.mjs`; the runtime loads it with `mapping = CubeUVReflectionMapping` and never runs PMREMGenerator (D243).

### F8. Interaction contract
- **Hover** (fine pointer only): rAF-coalesced raycast against BVH; hover highlights **all nodes of the category** (rim/emissive tint via shader uniforms, no postprocessing) + HTML callout (label, part code style ornament) with a leader line to `labelAnchor`; cursor pointer.
- **Click/tap**: select category → camera glides (GSAP, 0.9 s, `power3.inOut`) to `focus` computed from the category's current bbox (`target = bbox centre`, `position = target + dir × max(minDistance, radius × 2.4)`) → **PartPanel** opens (desktop: right drawer; mobile: bottom sheet with drag) → URL `?deo=<category>` via `history.replaceState`. Esc / close / backdrop → camera returns, `?deo` removed. Empty-canvas click deselects.
- **PartPanel** data: `catalog.partPanel({ categorySlug, vehicle?, limit: 12 })` → in-stock first, fits-selected-vehicle first, then popularity; role-aware price; add to cart; „Pošalji upit" (prefilled); „Svi delovi: Kočioni diskovi (48) →" to `/delovi/<slug>` with vehicle params; empty state with inquiry CTA.
- **Keyboard / SR**: visible „Lista delova" button opens an accessible dialog grouped by system (mirrors the 3D; each item selects exactly like a click); a server-rendered „Delovi po sistemima" section below the hero lists the same categories as links (no-JS and SEO equivalent). Canvas has `role="img"` + `aria-label` („Interaktivni 3D prikaz automobila…") and is not a tab stop; focus returns to the trigger on close.
- **Deep link** `/?deo=<category>`: valid slug → explode to that stage's end, select, open panel (works in the low tier too — the panel is HTML). Unknown slug → ignored.
- **Test hooks** (only when `NEXT_PUBLIC_TEST_HOOKS=1`): `window.__sklop3d = { ready: boolean, tier, selectPart(slug), explode(p), getState() }`.
- Rendering stack: R3F `<Canvas frameloop="demand">` (invalidate on scroll/hover/animation), DPR clamp `[1, tier max]` with adaptive drop on sustained < 50 fps, `useGLTF(url, false, true)` (Draco off → no gstatic fetch; meshopt on), `<Bvh>` for raycasts, pause when the hero is off-screen (IntersectionObserver), dispose on unmount, no postprocessing unless step 10 proves it costs < 2 ms/frame on mid tier.

### F9. As built (step 10) — where the runtime differs from F7/F8
Code: `components/three/**` (orchestrator `HeroStage.tsx`, canvas chunk `canvas/*`), pure logic in `lib/three/{explode,camera,framing,tier,stages,assets,manifestGuard}.ts`, values in `constants/xray.ts`. Details and numbers: `docs/3d/WEB-QA.md`.
- **Poster** (F7.1): a static `<picture>` of the pipeline's pre-encoded AVIF/WebP, not `next/image`; high priority only ≥ 768 px through a media-scoped `preload()`, phones load it eagerly at normal priority (the headline is their LCP) — D98. The track is pinned by CSS `sticky` inside `hero-track` (reserved heights as in F7.1), ScrollTrigger only scrubs progress — D104.
- **Tier and start** (F7.2–F7.3): cheap signals at mount, the WebGL2 probe when the 3D starts; idle start (≥ 4 s after `load`) only with a fine pointer, touch devices start on touch/scroll/focus/deep link — D105. While the model loads (and in the low tier, on context loss) the exploded poster follows the progress — D107.
- **Stack**: three + R3F 9, no drei (D97): GLTFLoader + meshopt workers (CSP `worker-src 'self' blob:`, already in SECURITY §L3), HDRLoader + PMREM, pre-baked contact shadows on a shader floor, three-mesh-bvh as a lazy chunk for fine pointers only. Canvas chunk 291 KB gzip (budget 350); manifest checked by a zod-free guard (D102). No post-processing.
- **Look**: the X-ray shell reproduces the poster's Blender semantics and drafting edges; the canvas reports ready after the edges (≤ 2.5 s) — D99. Highlight values tuned (D100).
- **Focus** (F8 click/tap): a telephoto glide from the current viewpoint instead of `target + dir × max(minDistance, radius × 2.4)`; the selected category draws in an overlay layer; desktop scrim behind the copy — D101. The hover callout is informational (no pointer events) — D110.
- **PartPanel** ordering: confirmed fits first, unknown fit last, then stock and popularity; `unmatched` count for the mismatch notice — D109. PartPanel, the parts list, the callout and the vehicle picker are lazy chunks — D106.
- **Test hooks**: `window.__sklop3d` also outside production builds, plus a `?3d=low|mid|high` override (test builds only) — D111.
