<!-- META | Korak 10 | Opus 5.5 | effort: max | sesija: NOVA | mode: auto -->
# Step 10 — The 3D exploded-car experience on the web

You are a creative developer at the level of the best WebGL studios, obsessed with performance and accessibility. Build the hero experience: the X-ray car that explodes on scroll and turns every part into a door to the catalog.

## Read first
docs/3D-CONTRACT.md · docs/3d/BUILD-NOTES.md · public/models/car.manifest.json · docs/design/DESIGN-SYSTEM.md (3D art direction, motion) · docs/ROUTES.md · docs/ARCHITECTURE.md (frontend) · pipeline/BRIEF.md §4 and §9.

## Skills to invoke (by name)
3d-scrollytelling · threejs-fundamentals · threejs-loaders · threejs-materials · threejs-shaders · threejs-lighting · threejs-interaction · threejs-postprocessing · threejs-animation · gsap-react · gsap-scrolltrigger · gsap-timeline · gsap-performance · motion-design · apple-design · text-reveal · impeccable · design-taste-frontend.

## Build (components/three/ and the home hero section)
1. **Stack** — three + @react-three/fiber + @react-three/drei in versions compatible with React 19.2 / Next 16 (verify), meshopt decoder; postprocessing only if it pays for itself on mobile.
2. **Loading** — the section server-renders the poster (`car-assembled` AVIF/WebP, correct sizes and priority) and the LCP-safe headline. The Canvas is a dynamically imported client component that starts after first paint / idle, only when the hero is near the viewport; crossfade poster → live 3D once the first frame is ready; a progress indicator that never shifts layout.
3. **Scene** — manifest-driven part registry; X-ray body material (custom shader per the design spec: fresnel rim, depth-aware opacity, crisp edge lines — premium and restrained); realistic part materials (tuned MeshPhysicalMaterial); a small self-hosted HDRI and light rig; subtle grid/floor per the design; correct color management and tone mapping.
4. **Explode** — a GSAP timeline built from manifest stages and vectors, scrubbed by ScrollTrigger in a pinned section on desktop, a shorter and simpler version on mobile; a „Rasklopi / Sklopi" toggle for non-scroll control; reduced motion → no scrub, instant states.
5. **Interaction** — raycast hover with highlight (rim/outline) and a label callout with a leader line; click/tap selects → camera glides to the part's focus preset → **PartPanel** (drawer on desktop, bottom sheet on mobile) with a Convex query of products in that category filtered by the selected vehicle (shared with the header vehicle picker), role-aware price, stock, add to cart / inquiry, link to the category page. Esc / close returns the camera. Deep links `?deo=<category>` open the panel. Keyboard: an accessible „Lista delova" dialog grouped by system mirrors the 3D; correct focus management and screen-reader labels.
6. **Performance** — DPR clamp, `frameloop="demand"` when idle, pause offscreen, instancing/merging where it helps, dispose on unmount, WebGL context-loss recovery, a low-end tier with reduced effects, no main-thread jank while scrolling (profile it).
7. **Test hooks** — outside production builds expose `window.__sklop3d` (ready flag, `selectPart(id)`, `explode(progress)`) for Playwright.

## Verify
Playwright (1440×900 and 390×844): the hero loads, poster → 3D swap, selecting via the parts list and via the hook opens the panel with products, the deep link works, no console errors. Screenshots of assembled / exploded / selected states — open them, critique with impeccable and design-taste-frontend, iterate until it looks like a flagship. Lighthouse (mobile) against `next build` + `next start` on port 3100: record LCP / CLS / TBT / score in docs/3d/WEB-QA.md. tsc, lint and build pass. Commit. Step report.
