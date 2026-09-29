<!-- META | Korak 08 | Opus 5.5 | effort: max | sesija: NASTAVAK koraka 07 | mode: auto -->
# Step 08 — Build the 3D car in Blender

Your 3D plan from the previous turn is approved. Execute it now in auto mode. This is the showpiece of the site — work like the best automotive CG artist who also ships to the web.

## Rules
- Invoke and follow the **blender-pipeline** skill. Everything is scripted in 3d/blender/*.py and run with the Blender CLI (BLENDER_EXE, headless). Blender does not need to be open; if Blender MCP tools happen to be available, use them for inspection only.
- First save the plan verbatim to docs/3d/PLAN.md.
- Keep a live checklist in docs/progress/08.md (every part: modeled / materials / explode data / QA passed) and update it after each system — your context may be compacted during this long step.
- Commit after each finished system (`git add -A`, then `git commit -m "3d: <system>"`).

## Work loop — repeat per system, in the planned order
1. Write or extend the system module.
2. Rebuild (full or partial, per your script design).
3. Render QA views of that system: assembled, exploded, close-ups.
4. **Open every render with the Read tool** and critique it like an art director: proportions versus real parts, silhouette, bevel highlights, smoothing artifacts, intersections, scale relative to the car, material realism.
5. Fix and re-render until it passes.
6. Tick the checklist.

## Then
- Body & glass pass: smooth, believable panels with gaps; glass and lights; an interior hint (dashboard and seat silhouettes) only if cheap.
- Global art-direction pass on full-car renders (assembled 3/4 front and rear, side, top, exploded hero). The exploded layout must read like a clean technical drawing from the hero camera.
- Export the GLB and generate `public/models/car.manifest.json` from scene data; optimize with gltf-transform (meshopt, WebP textures) into `public/models/car.glb`; write and run `3d/scripts/validate.mjs`.
- Posters: `public/images/hero/car-assembled` and `car-exploded` (2560 px wide, dark studio matching the design system, AVIF + WebP via sharp).
- **Category thumbnails**: `public/images/parts/<category>.webp` (transparent, 768 px) for every contract category. Service categories without a mesh get a tasteful render of a representative item.
- docs/3d/BUILD-NOTES.md (how to rebuild, how to swap one part for a purchased model later, how to add a part) and docs/3d/QA.md (per-part verdicts with render paths).

## Definition of done
Complete car and every contract category modeled at a quality you would show a client · GLB ≤ 8 MB and validator PASS · manifest complete · posters and thumbnails exist · QA.md has no open P0/P1 · committed · Step report with the numbers (file size, triangles, part count, categories covered).
