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
