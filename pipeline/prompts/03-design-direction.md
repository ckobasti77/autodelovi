<!-- META | Korak 03 | Opus 5.5 | effort: max | sesija: NOVA | mode: auto -->
# Step 03 — Design direction & design system

You are a world-class art director and design engineer (automotive, industrial and editorial web). Define SKLOP's visual and interaction language so precisely that every later step produces coherent, award-level UI without guessing.

## Read first
pipeline/BRIEF.md (§4, §8 and §9 especially) · docs/DESIGN-BRIEF.md · docs/3D-CONTRACT.md · docs/ROUTES.md · docs/ARCHITECTURE.md · CLAUDE.md.

## Skills to invoke (Skill tool, by name) — use them for real
1. **design-dna** — build SKLOP's full Design DNA profile (all three dimensions: tokens, style, visual effects including WebGL/3D and scroll effects). Save it as docs/design/design-dna.json.
2. **ui-ux-pro-max** — run its search / design-system scripts (see the skill) to explore palettes, font pairings, styles and UX guidelines for automotive e-commerce plus a B2B dashboard. Record what you took and why.
3. **design-taste-frontend** — apply its anti-generic rules; set explicit dials for marketing pages vs. admin.
4. **impeccable** — shape the direction, then critique and audit your own concept frames with it.
5. **motion-design** and **apple-design** — define the motion system and interaction physics.
6. **text-reveal**, **gsap-core**, **gsap-scrolltrigger** — the motion system must integrate the site-wide text reveal and GSAP.
7. **3d-scrollytelling** — the hero is a scroll-driven 3D section; define its art direction.

## Deliver docs/design/DESIGN-SYSTEM.md
1. Concept statement („Rendgen") and 5 design principles, each with a do / don't.
2. Brand: typographic wordmark for SKLOP (name read from config), favicon / app-icon concept, OG image frame.
3. Color: complete token set (base, surfaces, elevation, text tiers, lines, one accent, X-ray rim, focus, success/warning/danger/info, stock statuses, price/discount) and light/dark decisions per surface (storefront, admin, e-mails), with a **contrast table of computed WCAG ratios**.
4. Typography: families with **latin-ext** glyphs (č ć ž š đ — verify on Google Fonts), roles, fluid type scale (clamp values), weights, tracking, line heights, tabular numerals, monospace for part numbers, loading with next/font (subsets `latin`, `latin-ext`).
5. Layout: grid, breakpoints, spacing scale, container widths, radii, hairlines, elevation, z-index scale, technical ornaments (ticks, coordinates, callouts) and the rules for when to use them.
6. Iconography & imagery: icon set, custom part-glyph plan, how renders are used (posters, thumbnails), guidelines for future product photos, empty-state approach (no stock photos, no AI people).
7. **3D art direction**: X-ray glass shader spec (fresnel rim color and width, opacity range, edge lines, subtle detail — premium, never sci-fi kitsch), part material palette with real-world PBR values, lighting (HDRI + key/rim), background and floor, hover/selected states, label callouts with leader lines, camera framing per breakpoint, explode choreography (stages, timing, easing), poster→3D transition, mobile simplifications.
8. **Motion system**: principles, duration and easing tokens (GSAP eases), choreography rules, ScrollTrigger patterns, micro-interactions, the site-wide text-reveal parameters (word stagger, blur, lift, randomness, the LCP-safe hero variant), reduced-motion behavior.
9. Component inventory with anatomy, variants and every state (default/hover/focus/active/disabled/loading/error): buttons, inputs, select/combobox, vehicle picker, OEM search with hints, filters, product card, price block (retail vs. mechanic), stock badge, part panel/drawer, cart drawer, checkout stepper, toasts, dialogs, admin tables, tabs, pagination, breadcrumbs, empty states, skeletons, notification bell.
10. Page blueprints (annotated Markdown wireframes): home, category, product, search, cart/checkout, order status, VIN inquiry, za-majstore, mechanic dashboard, admin shell / dashboard / orders / products / import.
11. Voice & microcopy: Serbian guidelines and a starter library (CTAs, empty states, errors, confirmations, e-mail subject lines) — natural Serbian, never sounding translated.
12. Accessibility rules and a pre-merge design checklist.

## Prove it on screen
- Build a noindex concept route `/lab/koncept`: the hero composition at mid fidelity (typography, color, grid, technical ornaments, a static placeholder where the 3D goes), a product card with price and stock, and a small admin table. Use the real fonts and tokens (temporary CSS is fine; step 04 formalizes it).
- Screenshot it with Playwright at 1440×900 and 390×844, open the images, critique them with impeccable and design-taste-frontend, and iterate **at least twice**. Record each critique round in docs/design/CRITIQUE.md.

## Definition of done
docs/design/DESIGN-SYSTEM.md is complete and specific (real values, not adjectives) · docs/design/design-dna.json · docs/design/CRITIQUE.md · /lab/koncept looks intentional at both sizes · `npx tsc --noEmit` passes · decisions logged · commit · Step report.
