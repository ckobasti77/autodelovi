# SKLOP — Progress log

> Part of the SKLOP docs — index: [README](README.md). Every step appends a dated entry: what was done, what is verified, what remains. Long steps keep a checklist in `docs/progress/<step>.md`.

## 2026-09-29 — Step 01 · Master plan
- Done: research (Next 16 local docs, Convex guidelines + installed types, Convex Auth source, npm versions, Meta/Google/legal web research), master plan A–O → `docs/plans/01-master-plan.md`.
- Verified: versions via `npm view`; `ctx.meta.getRequestMetadata()` present in installed Convex types; Convex Auth server provider reads cookies (drives D2).
- Remains: everything from step 02 on.

## 2026-09-29 — Step 02 · Docs & conventions
- Done: topic docs split verbatim from the master plan (ARCHITECTURE, DATA-MODEL, ROUTES, 3D-CONTRACT, DESIGN-BRIEF, NOTIFICATIONS, SEO-ADS, IMPORT, SECURITY, TESTING, ROADMAP, DECISIONS, HUMAN-TODO, README); CLAUDE.md „Project conventions"; `.gitignore` updated; Prettier + baseline npm scripts.
- Verified: `npx tsc --noEmit` passes (see step report).
- Remains: step 03 design system.

## 2026-09-29 — Step 03 · Design direction & design system
- Done: „Rendgen" design system in `docs/design/DESIGN-SYSTEM.md` (§0 process record + raises, §1 concept + 5 principles with do/don't + design dials, §2 brand: wordmark, lifted-part mark, favicon/app icon, OG frame, §3 colour tokens night/paper/print + computed contrast table, §4 typography with verified latin-ext fonts and exact clamp scale, §5 layout/grid/spacing/radii/elevation/z-index/ornaments, §6 icons, part-glyph plan, renders, photo guide, empty states, §7 3D art direction: X-ray shader, PBR palette, lighting, states, cameras, explode, poster→3D, mobile, reduced motion, §8 motion tokens + GSAP eases + ScrollTrigger rules + micro-interactions + text-reveal parameters, §9 22 components with states, §10 13 page blueprints, §11 Serbian voice + microcopy library, §12 a11y rules + pre-merge checklist); `docs/design/tokens.json`, `docs/design/design-dna.json` (full 3-dimension schema), `docs/design/CRITIQUE.md` (3 rounds), `docs/design/brand/*` (mark, app icon, favicon, OG proof); repo-root `PRODUCT.md` + `DESIGN.md` (impeccable records); display fonts `app/fonts/archivo-*.woff2` (+ OG WOFFs) via `scripts/fonts/fetch-display-fonts.mjs`; concept route `/lab/koncept` (noindex).
- Verified: `node scripts/design/contrast.mjs --check` → 60 pairs, 0 failing; `node scripts/fonts/verify-fonts.mjs` → 6/6 font files contain č ć ž š đ + typographic punctuation + `tnum`; `node scripts/design/validate-dna.mjs` → 228/228 schema fields; impeccable detector static `[]`; `npx tsc --noEmit` exit 0; `npm run lint` 0 problems; Playwright captures 360–2560 px with no console errors.
- Remains (step 04): transcribe tokens into `app/globals.css` `@theme`, move fonts to `lib/fonts.ts` + root layout, build icons from `docs/design/brand/*`, implement text reveal with the §8.6 parameters, redirect `/lab/koncept` → `/styleguide`, re-run impeccable's documenter on the real foundation.
