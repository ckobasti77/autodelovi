<!-- META | Korak 04 | Opus 5.5 | effort: xhigh | sesija: NASTAVAK koraka 03 | mode: auto -->
# Step 04 — Frontend foundation

Continue as the design engineer who wrote the design system. Implement the foundation every page will use. Production quality — this code will not be rewritten.

## Read first
docs/design/DESIGN-SYSTEM.md · docs/ARCHITECTURE.md (frontend) · docs/ROUTES.md · node_modules/next/dist/docs (layouts, fonts, metadata, images, `proxy`).

## Skills to invoke (by name)
text-reveal · gsap-core · gsap-react · gsap-scrolltrigger · gsap-performance · impeccable · design-taste-frontend · ui-ux-pro-max · motion-design.

## Build
1. **Tokens** — Tailwind v4 `@theme` in app/globals.css from the design system (colors, fonts, type scale, spacing, radii, shadows, z-index, easing and duration as CSS variables). No hard-coded colors in components.
2. **Fonts** — next/font with `latin` + `latin-ext`, `display: swap`, preload only what the first paint needs.
3. **Root layout** — `<html lang="sr-Latn-RS">`, metadataBase from config, viewport / theme-color, skip link, a Next-16-correct ConvexClientProvider, minimal global providers.
4. **Config** — `config/site.ts`: brand name SKLOP, tagline, locale, currency RSD, VAT 20 %, empty-safe contact placeholders, Viber / WhatsApp / tel link builders. Everything brand-related reads from here (Convex settings override it later).
5. **Utilities with Vitest unit tests** — `formatRSD` (Intl sr-Latn-RS, para → dinars), `slugifySr` (č/ć→c, š→s, ž→z, đ→dj, spaces and punctuation), `normalizeOem` (uppercase; strip spaces, dots, dashes, slashes), `parsePastedOemList`, VIN validation + VAG WMI decode (WVW, WVG, WV1, WV2, WAU, WA1, WUA, TRU, TMB, VSS, …) + model-year character.
6. **UI kit** (components/ui/*) — accessible, keyboard-complete, every state from the design system: Button, IconButton, Link, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Badge, Price (retail / mechanic / discount), StockBadge, Card, Sheet/Drawer (mobile bottom sheet with drag), Dialog, Tabs, Toast, Tooltip, Skeleton, EmptyState, Breadcrumbs, Pagination, DataTable (admin), Stepper, Field (label / help / error). Use a headless primitive library only if it earns its weight (decide and log).
7. **Shell** — header (wordmark, OEM search entry, vehicle-picker slot, cart, account, mobile menu), footer (company data from settings/config with graceful empty states, legal links, nominative-use brand disclaimer), not-found, error and loading states.
8. **GSAP setup** — one client module registers plugins; `useGSAP` everywhere; ScrollTrigger refresh on route change and font load; `gsap.matchMedia()` for reduced motion and breakpoints; guaranteed cleanup.
9. **Text reveal (mandatory)** — implement the contract of the text-reveal skill in this repo exactly: `constants/textRevealConfig.ts`, `lib/textReveal.ts` (splitWords / restoreWords), `components/TextRevealGlobal.tsx`, and the stylesheet generated from the shared selectors and inlined by the root layout. The skill documents a system from a previous project, so the files do not exist yet — create them with those names and that behavior. Write the "Text Reveal" section the skill refers to into `.claude/rules/architecture.md` (if that write is not permitted, use docs/rules/architecture.md and note it). Add: an **LCP-safe above-the-fold variant** (words split on the server, CSS keyframe reveal with per-word random delays that starts at first paint without waiting for hydration), a `<noscript>` + `@media (scripting: none)` fallback, and a safety timeout that reveals everything if JS fails. Reduced motion → no animation, text visible.
10. **/styleguide** (noindex) — every token, type style, component and state, motion samples, a text-reveal demo. Remove /lab/koncept or redirect it to /styleguide.
11. Replace the default create-next-app home with a minimal branded placeholder (the real home arrives in steps 10–12).

## Verify
- Vitest unit tests pass; `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.
- Playwright on /styleguide at 390 and 1440: screenshots opened and reviewed; the text-reveal skill's check snippet returns nothing after scrolling; keyboard tab-through shows a visible focus everywhere; no console errors.
- docs/progress/04.md and docs/PROGRESS.md updated · commit · Step report.
