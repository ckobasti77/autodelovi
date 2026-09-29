# SKLOP — Design direction brief

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Input for step 03 (design system). Related: [3D-CONTRACT](3D-CONTRACT.md) · [ARCHITECTURE §G6 text reveal](ARCHITECTURE.md) · [SEO-ADS §J11 CWV budgets](SEO-ADS.md).

## H. Design direction brief (for step 03 — constraints and north star only)
- **North star „Rendgen"**: an engineering X-ray at night — precise, technical, calm, confident; a premium engineering exhibition / technical drawing. Not a tuning shop, not generic e-commerce, not gaming UI, not sci-fi HUD kitsch.
- **Colour**: dark graphite base, warm off-white text, exactly **one** signal accent (safety orange or electric lime — chosen by measured contrast and character), a cool rim tone reserved for the X-ray glass. Never VW blue, Škoda green, SEAT copper, Audi red as brand colours. Stock and status colours must stay distinguishable without colour alone (icon/label).
- **Type**: display grotesk or condensed face + legible UI sans + monospace for part numbers; all with `latin-ext` (č ć ž š đ verified), tabular numerals for prices/quantities; ≤ 3 families, variable fonts preferred, next/font with `latin` + `latin-ext`; the same families must exist in `@fontsource` (WOFF) for OG images.
- **Ornament with purpose**: 1 px hairlines, measurement ticks, coordinates, part codes in mono, callout leader lines — used to explain (3D callouts, specs, stage captions), never as noise.
- **Imagery**: only Blender renders (posters, part thumbnails) and later the client's photos; no stock, no AI people, no VAG logos; brand names as plain text + nominative-use disclaimer in the footer.
- **Layout**: 360–2560 px; content max width and dense-but-calm product grids; the 3D hero owns the first viewport on desktop, poster-first on mobile.
- **Motion**: GSAP only; text reveal site-wide (LCP-safe variant above the fold); restrained, physical easing; reduced motion fully respected.
- **Accessibility**: WCAG 2.2 AA contrast (4.5:1 text, 3:1 large text/UI), visible 2 px focus with offset, target size ≥ 24 px (44 px primary touch), no information by colour alone.
- **Admin**: same brand, optimized for density and speed; step 03 decides light or dark with reasons (long daylight sessions, print parity for predračun/otpremnica, status colour semantics, glare in the shop).
- **E-mails**: table-based, dark-mode-safe, brand wordmark as text, Serbian, plain-text twin.
- **Deliverables** are defined in step 03's prompt; the design system must give real values (tokens, clamp() scales, durations, eases, contrast table).
