# SKLOP — Design system „Rendgen“

> Part of the SKLOP docs — index: [../README.md](../README.md). Business intent: `pipeline/BRIEF.md` §4, §8, §9. Constraints: [../DESIGN-BRIEF.md](../DESIGN-BRIEF.md). 3D: [../3D-CONTRACT.md](../3D-CONTRACT.md).
> Machine-readable companions: [tokens.json](tokens.json) (colors + contrast pairs), [design-dna.json](design-dna.json) (3-dimension DNA). Proof on screen: `/lab/koncept` (step 03), later `/styleguide` (step 04). Critique log: [CRITIQUE.md](CRITIQUE.md).
> Status: written in step 03 (2026-09-29). Step 04 transcribes §3–§8 into `app/globals.css` `@theme`, `constants/motion.ts`, `constants/textRevealConfig.ts`, `lib/fonts.ts`. Change a value here first, then in code.

**Contents** — 0 How this was decided · 1 Concept and principles · 2 Brand · 3 Color · 4 Typography · 5 Layout · 6 Iconography and imagery · 7 3D art direction · 8 Motion · 9 Components · 10 Page blueprints · 11 Voice and microcopy · 12 Accessibility and pre-merge checklist

---

## 0. How this was decided (process record)

| Input | What it contributed |
|---|---|
| Brief §8 (pinned north star) | „Rendgen“, dark graphite, warm off-white, exactly one signal accent, cool rim only on the X-ray glass, ornament with purpose, three type roles with latin-ext. A pinned brief beats any roll or taste. |
| impeccable (`PRODUCT.md`, concept seed `9fc882b6`, persuade) | The seed assigned candidate 7 of our grounded list (precision measuring instruments). The brief-pinned world wins; the roll and the dealt challengers were fused and turned into **named raises** (below). Unattended run: no decision page, no interview; `PRODUCT.md` records facts from the brief only. |
| ui-ux-pro-max (`--design-system` storefront + admin, style/color/typography/ux/web/landing/chart searches) | Taken: industrial grey + safety orange lane, Swiss 12-col grid with a single accent, dark-mode hygiene (no pure black, `color-scheme`, visible focus), data-dense dashboard pattern for admin, "search is the CTA" marketplace pattern, UX rules (44 px targets, 8 px target spacing, validate on blur, errors under fields, skeleton > 300 ms, z-index scale, reduced motion, 1–2 animated elements per view). Rejected: "3D & Hyperrealism" (poor a11y/perf), red CTA #DC2626 (Audi red, collides with danger), HUD/cyberpunk (kitsch), Fira Code headings, blue admin palette (VW-blue adjacent), horizontal scroll journey, Space Grotesk / DM Sans (template tells). |
| design-taste-frontend | Dials per surface (§1.3); anti-slop rules adopted (no Inter, no pure black, no neon glow, no 3 equal feature cards, no centered hero, `min-h-[100dvh]`, grid over flex math, full state cycles, tactile press). Overridden by the brief: Framer Motion → GSAP only; perpetual micro-animations and magnetic buttons → not used (calm principle, craft floor); "mono for all numbers in cockpit mode" → tabular figures of the UI sans for amounts, mono only for codes and measurements. |
| motion-design + apple-design | Motion personality **Instrument** (rigid metal: 0 % overshoot, decisive deceleration), velocity-aware sheet physics with GSAP Draggable + InertiaPlugin, interruptible tweens from the presentation value (§8). |
| text-reveal, gsap-core, gsap-scrolltrigger, 3d-scrollytelling | Reveal parameters incl. the LCP-safe variant (§8.6), ScrollTrigger rules (§8.4), sticky stage + HTML overlays + refs-not-state (§7). |
| Measurements | Fonts rendered with Serbian text (`scripts/design/font-specimen.html` → `screens/fonts-*.png`), glyph/feature checks with fontkit, file sizes from the Google Fonts API, contrast computed by `scripts/design/contrast.mjs` (60 pairs, 0 failing). |

### 0.1 Raises (what the rejected alternatives donated)
- **Instrument truth** (the roll: engraved scales) — every tick, dimension and coordinate on screen is a real value (car dimensions from the manifest bbox, part pivots in metres). No decorative numbers.
- **Course colour** (orienteering map) — orange is the active leg: *yours* or *next*. It never decorates and never signals status.
- **Graticule and detents** (oscilloscope bench) — the hero stage is a measured field with a ruler floor; the explode control is detented at stage boundaries (buttons and keyboard step stage by stage).
- **Cue list** (theatre cyclorama) — every explode stage is a named, deep-linkable state with a text equivalent in the parts list.
- **Running order** (title card) — a persistent `00–07` stage index; captions change by hard cut, not crossfade mush.
- **Parts-catalogue plate** (impeccable's pick, familiar by design) — callout → table discipline: a part is always shown with its position, OEM number, name and quantity in the same order everywhere (panel rows, cart lines, quick-order rows, admin items).

---

## 1. Concept and principles

### 1.1 Concept statement — „Rendgen“
SKLOP shows the car the way a mechanic thinks about it: an assembly of parts, each with a number. The interface is **an engineering X-ray at night** — a graphite field, warm drawing ink, one signal colour for what is yours and what comes next, and a cold rim light that only the car wears. The car is the only spectacle; everything around it is a calm technical sheet: hairlines, a title block, true dimensions, part codes in a monospace. Nothing decorates unless it measures something. The result should feel like a premium engineering exhibition you can buy from — not a tuning shop, not a generic shop template, not a game HUD.

### 1.2 Five principles

| # | Principle | Do | Don't |
|---|---|---|---|
| 1 | **Measure, don't decorate** | Dimension lines with the car's real millimetres; plain-language part positions („prednji levi“); part and order codes in mono; a title block that states honest facts ("Generički kompaktni hečbek, nije konkretan model"). | HUD brackets, invented numbers, grids that measure nothing, mono used for prose or labels, "scan lines". |
| 2 | **One signal: orange = yours / next** | Primary action, current selection, keyboard focus, the selected vehicle chip, „Vaša cena“, the active explode stage, unread counts. | Orange dividers or icons for flavour, orange status badges (warnings are amber with an icon), two orange primary buttons in one view region. |
| 3 | **The part number is the product** | OEM + cross numbers visible, copyable and searchable in any format; fitment stated plainly; price incl. PDV beside stock and lead time; always a next step (upit, poziv, Viber). | Codes hidden behind tabs, marketing adjectives, fake scarcity, prices without PDV note, dead-end empty states. |
| 4 | **Quiet surface, loud object** | One authored motion moment per page (the explode on home; text reveal is the site grammar, not a moment); chrome in graphite and hairlines; renders carry the colour. | Glows on UI, glass as decoration, gradients on text or buttons, parallax layers, bounce/elastic eases, looping ambient motion. |
| 5 | **Workshop-proof** | Readable on a phone in a bright workshop: 16 px body, ≥ 4.5:1 for all text (meta 6:1 on the page), 44 px touch targets, tabular figures, forgiving inputs (spaces, dots, dashes in OEM numbers), poster first, 3D never blocks. | Grey-on-grey meta, hover-only affordances, thin weights < 400 for text, carousels, anything that waits for WebGL before the page is usable. |

### 1.3 Design dials per surface (design-taste-frontend)

| Surface | Visitor mode (impeccable) | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY | Notes |
|---|---|---|---|---|---|
| Home, `/za-majstore`, ads landings | Persuade | 7 | 6 (the explode) / 3 for UI chrome | 4 | Asymmetric: copy left, object right; one authored moment. |
| Catalog, search, vehicle hubs, product | Operate / Read | 4 | 3 | 6 | Grid discipline, filters, dense but calm cards. |
| Cart, checkout, inquiry | Operate | 2 | 2 | 5 | No ornaments except mono codes; focus on fields. |
| Mechanic portal `/majstor` | Operate | 3 | 2 | 7 | List views by default, quick-order box sticky. |
| Admin `/admin` | Operate | 2 | 1 | 8 | Paper theme, tables with 1 px dividers, no card boxes around metrics unless they are links. |
| E-mails, print (predračun, otpremnica) | Read | 1 | 0 | 5 | Table layouts, black-on-white print. |

---

## 2. Brand

### 2.1 Wordmark (typographic, name from config)
- Text = `site.brand.name` (config, overridden by settings) rendered **uppercase via CSS** (source text stays as typed), Archivo Expanded 700, tracking `0.08em`, colour `ink-1`. No image logo, so renaming takes one config change.
- Sizes: header 18 px (≥ 1024 px) / 17 px (< 1024 px); admin sidebar 15 px; footer 16 px; e-mail 20 px (live text in the HTML e-mail with a system fallback: `Arial Black, Arial, sans-serif`, letter-spacing 2px); OG 28 px.
- Lockup: mark (§2.2) at 22 px + 10 px gap + wordmark; the mark's base sits on the wordmark baseline, the lifted part rises above cap height. Clear space: one cap height (≈ 0.69 em) on every side. Minimum size 14 px wordmark / 16 px mark.
- The tagline „Rasklopi auto. Nađi deo.“ is never locked to the wordmark; it lives as the hero statement and in the OG frame.

### 2.2 Mark — „izvučen deo“ (the lifted part)
- A miniature **exploded view**: a slotted base (ink) with one part lifted out of its slot along a dashed assembly axis; the lifted part is **`#FF6B1A`** — the part you find („Rasklopi auto. Nađi deo.“), the only orange in the mark (orange = yours/next). It does not depend on the brand name, so it survives a rename. Files: `docs/design/brand/mark.svg`, `app-icon.svg`, `favicon-16.svg`; preview `brand/icons-preview.png`.
- Why not the first idea (a drafting centre mark): rendered large, every centre-mark variant read as a rifle-scope reticle or a target (`brand/mark-variants.png`) — an aggressive association for a calm parts brand. Alternatives rendered in `brand/mark-variants-2.png`: an exploded three-layer stack (reads as an I-beam / "layers" icon) and the initial „S“ (generic, changes on rename).
- Geometry (24-unit grid): part `rect x 7 y 2.5 w 10 h 5 rx 0.75` orange; axis `M12 8.5v4.5`, stroke 1.25, dash 1.3/1.1, ink; base `M3 14h4v2.5h10V14h4v7H3z` ink (the 10-unit slot matches the part width — "it fits here"). Ink = `currentColor` (`#F1ECE3` on dark, `#121518` on light).
- Favicon / app icon (step 04 builds `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `app/manifest.ts` icons from these files):
  - master 512 × 512: graphite rounded square `#0D0F11`, radius 22 % (113 px), mark in `#F1ECE3` with the orange part, scaled to 62 % of the tile, centred;
  - `favicon.ico` 16/32/48 — the 16 px variant is pixel-snapped (part 6 × 4 px, base with a 6 px slot) and drops the dashed axis;
  - `apple-icon.png` 180 × 180, no transparency; maskable 192/512 with the mark inside the 80 % safe zone;
  - `theme_color` `#0D0F11`, `background_color` `#0D0F11`.

### 2.3 OG image frame (1200 × 630)
```
┌──────────────────────────────────────────────────────────────────────┐ bg #0D0F11
│  ▣ SKLOP                                              [render 520²]  │ 1px frame inset 32 px, line #2C3238,
│                                                        rim-lit part   │ 14 px corner ticks line-strong
│  KOČIONI DISKOVI                                       or car poster  │ title: Archivo Expanded 700 caps,
│  ZA VW GOLF VII                                                       │ 52 px / 1.0, ≤ 3 lines, ink-1
│                                                                       │ meta: Martian Mono 22 px ink-3
│  OEM 5Q0 615 301 F · Brembo                                           │
│ ─┬────┬────┬────┬────┬────┬────┬────┬───  [domain] · Rasklopi auto.  │ ruler ticks every 12 px (line), no labels
└──────────────────────────────────────────────────────────────────────┘
```
- Rendered proof: `docs/design/brand/og-frame.html` → `brand/og-frame.png` (category example). The domain comes from `NEXT_PUBLIC_SITE_URL`/settings and is omitted while unknown.
- Product OG: render/photo + name + OEM + manufacturer, **no price** (SEO-ADS §J). Category OG: category render + „{n} artikala“. Default OG: hero poster + tagline.
- Fonts for `ImageResponse` (ttf/otf/woff only): `assets/fonts/og/archivo-*.woff` (generated by `scripts/fonts/fetch-display-fonts.mjs`), `@fontsource/public-sans` and `@fontsource/martian-mono` WOFF files (`latin` + `latin-ext`).

---

## 3. Color

### 3.1 Themes per surface (light/dark decided by the use scene)

| Surface | Theme | Why |
|---|---|---|
| Storefront (home, catalog, product, search, cart, checkout, inquiry, account, `/majstor`) | **Night** (dark) | The X-ray concept needs a dark field for the rim light; evening phone browsing from ads; warm ink at 16:1 and meta at ≥ 5.2:1 keep it readable in a bright workshop. |
| Admin `/admin` | **Paper** (light) work area + **night** sidebar | Staff sit at a counter PC through the working day; dense 13.5 px tables need maximum contrast (18:1); status colours read more reliably on white; parity with printed predračun/otpremnica; less glare from daylight on a dark screen. The night sidebar keeps the brand. |
| Transactional e-mails | **Paper** (light), dark-mode-safe | E-mail clients invert unpredictably; a light base with solid colours survives inversion. |
| Print views | **Print** (white, black ink) | Toner, legibility, legal documents. |

### 3.2 Tokens — night (storefront)
All values in `tokens.json` → `color.night`. Alpha tokens are stored as their composite over `bg` so contrast is measurable; CSS may express them with `color-mix()`.

| Token | Hex | Role |
|---|---|---|
| `bg` | `#0D0F11` | Page field (graphite night, never `#000`). |
| `bg-raised` | `#121518` | Header (at 88 % + 12 px blur), footer, alternate bands. |
| `surface-1` | `#16191D` | Cards, list rows, panels at rest. |
| `surface-2` | `#1C2025` | Inputs, table headers, secondary buttons at rest, hover on surface-1 lists. |
| `surface-3` | `#23282E` | Popovers, callouts, drawers, sheets, dialogs. |
| `surface-4` | `#2B3138` | Hover/pressed on surface-3, selected neutral chip. |
| `line-faint` | `#1E2227` | Decorative hairlines on the page (ruler minor ticks). |
| `line` | `#2C3238` | Dividers, card borders, table rules. |
| `line-strong` | `#434A52` | Emphasis rules, card hover border, corner ticks, table header rule. |
| `control` | `#6E767F` | Borders that identify controls (inputs, checkboxes, secondary buttons) — ≥ 3:1 against every surface they sit on. |
| `ink-1` | `#F1ECE3` | Primary text (warm off-white "drawing paper" ink). |
| `ink-2` | `#C4BEB4` | Secondary text, body in dense areas, nav at rest. |
| `ink-3` | `#969088` | Meta, captions, placeholders, out-of-stock label (≥ 4.7:1 on every surface). |
| `ink-4` | `#6B6760` | Disabled text only (exempt from 1.4.3), ruler labels. |
| `accent` | `#FF6B1A` | Safety orange — the one signal (§3.5). |
| `accent-hover` | `#FF8A4A` | Hover on accent fills (lighter on dark). |
| `accent-active` | `#E95E0E` | Pressed accent. |
| `on-accent` | `#0D0F11` | Text/icons on accent fills (6.74:1). |
| `accent-subtle` | `#2A1A12` | Selected rows/chips (12 % accent over bg). |
| `rim` | `#9FE9FF` | X-ray rim and glass edges — **3D and X-ray art only**, never UI. |
| `rim-soft` | `#4DB5D6` | Inner glow of the rim, glass fill tint. |
| `rim-deep` | `#123642` | Shell body tint in shadow. |
| `success` / `success-subtle` | `#4FD18B` / `#152620` | Na stanju, isporučena, confirmations. |
| `warning` / `warning-subtle` | `#F4C04A` / `#292418` | Malo na stanju, čeka deo, "check fitment". |
| `danger` / `danger-subtle` | `#FF6166` / `#2A191B` | Errors, otkazana, destructive actions. |
| `info` / `info-subtle` | `#9DB8D0` / `#1E2328` | Po porudžbini, poslata/potvrđena, neutral notices. |
| `scrim` | `#07080A` at 72 % | Modal backdrop. |

### 3.3 Tokens — paper (admin, e-mail) and print

| Token | Paper | Print | Role |
|---|---|---|---|
| `bg` | `#F3F4F5` | `#FFFFFF` | Page. |
| `surface-1` / `surface-3` | `#FFFFFF` | — | Panels, tables / popovers. |
| `surface-2` | `#F7F8F9` | — | Table header, zebra-free hover. |
| `selected` | `#EEF1F4` | — | Selected table rows (neutral; the accent tint is reserved for „Nova“/needs-action chips — round-1 critique showed both vanishing into one colour). |
| `line-faint` / `line` / `line-strong` | `#E8EAED` / `#DADDE1` / `#BEC3C9` | `#BDBDBD` rule | Dividers. |
| `control` | `#838B94` | — | Input borders (3.45:1 on white). |
| `ink-1` / `ink-2` / `ink-3` / `ink-4` | `#121518` / `#3D444C` / `#5D6570` / `#9AA1AA` | `#141414` / `#4A4A4A` | Text tiers (ink-4 disabled only). |
| `accent` / `accent-hover` | `#FF6B1A` / `#FF8A4A` | — | Fills only (buttons, active indicators, the mark). |
| `accent-text` | `#B8470A` | — | Orange as text/links/focus on light (5.32:1). |
| `on-accent` | `#121518` | — | Label on accent fills (6.43:1). |
| `accent-subtle` | `#FFEADD` | — | Selected rows, „Nova“ status tint. |
| `success` / `-subtle` | `#1D7A4A` / `#E3F4EA` | — | |
| `warning` / `-subtle` | `#8C5B00` / `#FBF0D9` | — | |
| `danger` / `-subtle` | `#C4303A` / `#FBE4E5` | — | |
| `info` / `-subtle` | `#3A5F80` / `#E5EDF4` | — | |

### 3.4 Contrast table (computed, WCAG 2.2)
Generated by `node scripts/design/contrast.mjs` from `tokens.json` (run it with `--check` in CI from step 04). Thresholds: 4.5:1 text, 3:1 UI components/graphics and focus indicators; disabled text is exempt and listed for information.

| Use | Foreground | Background | Ratio | Required | Result |
|---|---|---|---|---|---|
| Body text on page | `night.ink1` #F1ECE3 | `night.bg` #0D0F11 | **16.32:1** | 4.5:1 | pass |
| Body text on card | `night.ink1` #F1ECE3 | `night.surface1` #16191D | **14.99:1** | 4.5:1 | pass |
| Body text in drawer / popover | `night.ink1` #F1ECE3 | `night.surface3` #23282E | **12.62:1** | 4.5:1 | pass |
| Secondary text on page | `night.ink2` #C4BEB4 | `night.bg` #0D0F11 | **10.40:1** | 4.5:1 | pass |
| Secondary text on card | `night.ink2` #C4BEB4 | `night.surface1` #16191D | **9.55:1** | 4.5:1 | pass |
| Secondary text in drawer | `night.ink2` #C4BEB4 | `night.surface3` #23282E | **8.04:1** | 4.5:1 | pass |
| Meta / captions on page | `night.ink3` #969088 | `night.bg` #0D0F11 | **6.07:1** | 4.5:1 | pass |
| Meta / captions on card | `night.ink3` #969088 | `night.surface1` #16191D | **5.58:1** | 4.5:1 | pass |
| Meta in input / table header | `night.ink3` #969088 | `night.surface2` #1C2025 | **5.18:1** | 4.5:1 | pass |
| Meta in drawer | `night.ink3` #969088 | `night.surface3` #23282E | **4.70:1** | 4.5:1 | pass |
| Disabled text (exempt, informative) | `night.ink4` #6B6760 | `night.surface2` #1C2025 | **2.91:1** | 2:1 | pass |
| Accent text (Vaša cena, active label) on page | `night.accent` #FF6B1A | `night.bg` #0D0F11 | **6.74:1** | 4.5:1 | pass |
| Accent text on card | `night.accent` #FF6B1A | `night.surface1` #16191D | **6.19:1** | 4.5:1 | pass |
| Accent text in drawer | `night.accent` #FF6B1A | `night.surface3` #23282E | **5.21:1** | 4.5:1 | pass |
| Accent text on selected row | `night.accent` #FF6B1A | `night.accentSubtle` #2A1A12 | **5.87:1** | 4.5:1 | pass |
| Body text on selected row | `night.ink1` #F1ECE3 | `night.accentSubtle` #2A1A12 | **14.22:1** | 4.5:1 | pass |
| Primary button label | `night.onAccent` #0D0F11 | `night.accent` #FF6B1A | **6.74:1** | 4.5:1 | pass |
| Primary button label, hover | `night.onAccent` #0D0F11 | `night.accentHover` #FF8A4A | **8.22:1** | 4.5:1 | pass |
| Primary button label, pressed | `night.onAccent` #0D0F11 | `night.accentActive` #E95E0E | **5.55:1** | 4.5:1 | pass |
| Focus ring vs page (UI 3:1) | `night.accent` #FF6B1A | `night.bg` #0D0F11 | **6.74:1** | 3:1 | pass |
| Focus ring vs drawer (UI 3:1) | `night.accent` #FF6B1A | `night.surface3` #23282E | **5.21:1** | 3:1 | pass |
| Input border vs input fill (UI 3:1) | `night.control` #6E767F | `night.surface2` #1C2025 | **3.56:1** | 3:1 | pass |
| Input border vs page (UI 3:1) | `night.control` #6E767F | `night.bg` #0D0F11 | **4.17:1** | 3:1 | pass |
| Checkbox border in drawer (UI 3:1) | `night.control` #6E767F | `night.surface3` #23282E | **3.22:1** | 3:1 | pass |
| Success text (Na stanju) on card | `night.success` #4FD18B | `night.surface1` #16191D | **9.09:1** | 4.5:1 | pass |
| Success badge text on its tint | `night.success` #4FD18B | `night.successSubtle` #152620 | **8.14:1** | 4.5:1 | pass |
| Warning text (Malo na stanju) on card | `night.warning` #F4C04A | `night.surface1` #16191D | **10.48:1** | 4.5:1 | pass |
| Warning badge text on its tint | `night.warning` #F4C04A | `night.warningSubtle` #292418 | **9.18:1** | 4.5:1 | pass |
| Danger / error text on page | `night.danger` #FF6166 | `night.bg` #0D0F11 | **6.54:1** | 4.5:1 | pass |
| Error text in input group | `night.danger` #FF6166 | `night.surface2` #1C2025 | **5.58:1** | 4.5:1 | pass |
| Danger badge text on its tint | `night.danger` #FF6166 | `night.dangerSubtle` #2A191B | **5.71:1** | 4.5:1 | pass |
| Info text (Po porudžbini) on card | `night.info` #9DB8D0 | `night.surface1` #16191D | **8.57:1** | 4.5:1 | pass |
| Info badge text on its tint | `night.info` #9DB8D0 | `night.infoSubtle` #1E2328 | **7.69:1** | 4.5:1 | pass |
| Out-of-stock label on card | `night.ink3` #969088 | `night.surface1` #16191D | **5.58:1** | 4.5:1 | pass |
| X-ray rim vs page (3D graphic, 3:1) | `night.rim` #9FE9FF | `night.bg` #0D0F11 | **14.24:1** | 3:1 | pass |
| Strong hairline vs page (decorative, informative) | `night.lineStrong` #434A52 | `night.bg` #0D0F11 | **2.14:1** | 1.5:1 | pass |
| Admin body text on page | `paper.ink1` #121518 | `paper.bg` #F3F4F5 | **16.64:1** | 4.5:1 | pass |
| Admin body text on panel | `paper.ink1` #121518 | `paper.surface1` #FFFFFF | **18.32:1** | 4.5:1 | pass |
| Admin secondary text on panel | `paper.ink2` #3D444C | `paper.surface1` #FFFFFF | **9.86:1** | 4.5:1 | pass |
| Admin meta on panel | `paper.ink3` #5D6570 | `paper.surface1` #FFFFFF | **5.90:1** | 4.5:1 | pass |
| Admin meta on page | `paper.ink3` #5D6570 | `paper.bg` #F3F4F5 | **5.36:1** | 4.5:1 | pass |
| Admin meta in table header | `paper.ink3` #5D6570 | `paper.surface2` #F7F8F9 | **5.55:1** | 4.5:1 | pass |
| Admin link / accent text on panel | `paper.accentText` #B8470A | `paper.surface1` #FFFFFF | **5.32:1** | 4.5:1 | pass |
| Admin accent text on page | `paper.accentText` #B8470A | `paper.bg` #F3F4F5 | **4.84:1** | 4.5:1 | pass |
| Admin body text on selected row | `paper.ink1` #121518 | `paper.selected` #EEF1F4 | **16.16:1** | 4.5:1 | pass |
| Admin meta on selected row | `paper.ink3` #5D6570 | `paper.selected` #EEF1F4 | **5.20:1** | 4.5:1 | pass |
| Admin „Nova“ chip text on its tint | `paper.accentText` #B8470A | `paper.accentSubtle` #FFEADD | **4.58:1** | 4.5:1 | pass |
| Sidebar focus ring (night accent on night bg) | `night.accent` #FF6B1A | `night.bg` #0D0F11 | **6.74:1** | 3:1 | pass |
| Admin primary button label | `paper.onAccent` #121518 | `paper.accent` #FF6B1A | **6.43:1** | 4.5:1 | pass |
| Admin input border (UI 3:1) | `paper.control` #838B94 | `paper.surface1` #FFFFFF | **3.45:1** | 3:1 | pass |
| Admin focus ring vs panel (UI 3:1) | `paper.accentText` #B8470A | `paper.surface1` #FFFFFF | **5.32:1** | 3:1 | pass |
| Admin success on tint | `paper.success` #1D7A4A | `paper.successSubtle` #E3F4EA | **4.67:1** | 4.5:1 | pass |
| Admin warning on tint | `paper.warning` #8C5B00 | `paper.warningSubtle` #FBF0D9 | **5.14:1** | 4.5:1 | pass |
| Admin danger on tint | `paper.danger` #C4303A | `paper.dangerSubtle` #FBE4E5 | **4.52:1** | 4.5:1 | pass |
| Admin info on tint | `paper.info` #3A5F80 | `paper.infoSubtle` #E5EDF4 | **5.67:1** | 4.5:1 | pass |
| Admin success on panel | `paper.success` #1D7A4A | `paper.surface1` #FFFFFF | **5.34:1** | 4.5:1 | pass |
| Admin danger on panel | `paper.danger` #C4303A | `paper.surface1` #FFFFFF | **5.48:1** | 4.5:1 | pass |
| Admin sidebar text (night ink on night bg) | `night.ink2` #C4BEB4 | `night.bg` #0D0F11 | **10.40:1** | 4.5:1 | pass |
| Print text | `print.ink` #141414 | `print.paper` #FFFFFF | **18.42:1** | 7:1 | pass |
| Print secondary text | `print.ink2` #4A4A4A | `print.paper` #FFFFFF | **8.86:1** | 4.5:1 | pass |

60 pairs, 0 failing

Accent decision (measured): **safety orange `#FF6B1A`** — 6.74:1 on the night field and 6.74:1 for a dark label on it; on the light admin it works as a fill (6.43:1 with dark label) with a darker text shade `#B8470A` (5.32:1). Electric lime `#C6F21E` measured 14.74:1 on dark but **1.30:1 on white** (unusable for focus rings or button edges in the light admin), competes with the ink for brightness, and sits next to Škoda's Electric Green. Orange is also the workshop's own colour (safety equipment, tool trays) and is none of the VAG brand colours (VW blue, Škoda green, SEAT copper, Audi red).

### 3.5 Usage rules
1. **Orange means yours or next** — primary action (max one per view region), selection, focus ring, active tab/stage, the chosen vehicle chip, „Vaša cena“, unread counts. On accent fills the focus ring switches to `ink-1` (night) / `ink-1` paper.
2. **Status never by colour alone** — every status has an icon shape and a word (§3.6). Warning is amber, not orange; danger is a pink-red `#FF6166`, not orange.
3. **Rim cyan is reserved** for the X-ray shell, glass edges and X-ray illustrations (posters, empty-state drawings). Never for links, info, focus or charts.
4. **Neutral temperature**: surfaces and lines are cool graphite (hue ≈ 215°, very low chroma); ink is warm (hue ≈ 40°). The tension is deliberate (night sheet, drawing ink); do not introduce a third neutral family.
5. **Browser surfaces are themed**: `::selection` accent fill with `on-accent` text (paper: `accent-subtle` + `ink-1`), `caret-color: accent`, `color-scheme: dark` on night / `light` on paper, scrollbars `scrollbar-color: #434A52 transparent` (night) / `#BEC3C9 transparent` (paper), `accent-color: #FF6B1A` for native checkboxes/radios where unstyled.
6. **Depth by surface steps, not by shadows** on night (§5.5); overlays commit to an edge, not a hairline plus a wide shadow.
7. **Arrows and symbols are icons**, never glyphs: Public Sans has no `→`/`←` (they fall back to Arial) — use Phosphor `ArrowRight`/`ArrowLeft` at 13–16 px.
8. **Native controls are themed or replaced**: `input[type=search]::-webkit-search-cancel-button { display: none }` (our own clear button), `scroll-padding-top: 80px` on `html` so anchors and focused elements are never hidden under the sticky header.

### 3.6 Status mapping

| Domain | Status | Color token | Icon (Phosphor) | Label |
|---|---|---|---|---|
| Stock | na stanju | `success` | `Square` fill | „Na stanju · 4 kom.“ |
| | malo na stanju (≤ threshold) | `warning` | `SquareHalfBottom` fill | „Malo na stanju · 2 kom.“ |
| | po porudžbini | `info` | `Clock` | „Po porudžbini · 3–5 dana“ |
| | nema na stanju | `ink-3` | `Square` regular (outline) | „Nema na stanju“ |
| Order | nova | `accent-subtle` bg + accent text (admin: needs action) / storefront: `info` | `WarningCircle` (admin) · `Receipt` (storefront) | „Nova“ / „Primljena“ |
| | potvrdjena | `info` | `CheckCircle` | „Potvrđena“ |
| | spremna_za_preuzimanje | `info` | `Package` | „Spremna za preuzimanje“ (admin compact: „Za preuzimanje“) |
| | poslata | `info` | `Truck` | „Poslata“ |
| | preuzeta / isporucena | `success` | `CheckCircle` | „Preuzeta“ / „Isporučena“ |
| | zavrsena | `ink-3` | `CheckSquare` | „Završena“ |
| | ceka_deo | `warning` | `Warning` | „Čeka deo“ |
| | otkazana | `danger` | `XCircle` | „Otkazana“ |
| Inquiry | nov / u_obradi / ponuda_poslata / prihvacena / odbijena / istekla | accent-subtle (admin) / info / info / success / ink-3 / warning | `WarningCircle` / `Hourglass` / `PaperPlaneTilt` / `CheckCircle` / `XCircle` / `ClockCounterClockwise` | „Nov“ / „U obradi“ / „Ponuda poslata“ / „Prihvaćena“ / „Odbijena“ / „Istekla“ |
| Mechanic | pending / approved / rejected / suspended | warning / success / danger / ink-3 | `Hourglass` / `SealCheck` / `XCircle` / `Prohibit` | „Čeka odobrenje“ / „Odobren“ / „Odbijen“ / „Suspendovan“ |
| Fitment | fits / generation only / unknown / no | success / warning / ink-3 / danger | `CheckCircle` / `Question` / `Question` / `XCircle` | „Odgovara za Golf VII 2.0 TDI“ / „Odgovara za Golf VII — proverite motor“ / „Kompatibilnost nije potvrđena“ / „Ne odgovara za izabrano vozilo“ |

### 3.7 Price and discount
- Retail price: `ink-1`, Archivo Condensed 600 tabular, unit „RSD“ in Public Sans 600 at 50 % size, note „sa PDV-om“ `ink-3` 12 px.
- Mechanic view: first line `MP 4.290 RSD` in `ink-3` 12 px with 1 px line-through; label „Vaša cena“ 12 px 600 `accent`; value in `accent` (night) / `accent-text` (paper); then „sa PDV-om“ like retail (B2B buyers must see whether VAT is included). The rabat % appears only on the product page and in the mechanic portal („Rabat 15 %“), never as a promotion badge (D22: no consumer „stara cena“).
- Totals (cart/checkout): subtotal `ink-2`, delivery line, total `ink-1` condensed 600; PDV line „U cenu je uračunat PDV 20 %: 2.165 RSD“ `ink-3`.

### 3.9 Token names in code (step 04 `app/globals.css`)
Tailwind v4 `@theme` names so utilities read naturally (`bg-surface-1`, `text-ink-2`, `border-line`, `text-accent`, `font-display`, `rounded-xs`, `ease-sk-out`):

| Group | CSS variables |
|---|---|
| Colour (night = `:root`, paper = `[data-theme="paper"]`) | `--color-bg`, `--color-bg-raised`, `--color-surface-1…4`, `--color-selected` (paper only; night uses `--color-accent-subtle`), `--color-line-faint`, `--color-line`, `--color-line-strong`, `--color-control`, `--color-ink-1…4`, `--color-accent`, `--color-accent-hover`, `--color-accent-active`, `--color-accent-text` (paper), `--color-on-accent`, `--color-accent-subtle`, `--color-success`/`-subtle`, `--color-warning`/`-subtle`, `--color-danger`/`-subtle`, `--color-info`/`-subtle`, `--color-rim`, `--color-rim-soft`, `--color-rim-deep`, `--color-scrim` |
| Fonts | `--font-display` (Archivo Expanded 700), `--font-display-600`, `--font-condensed`, `--font-ui` (default `--font-sans`), `--font-mono` |
| Type scale | `--text-display-xl`, `--text-display-l`, `--text-display-m`, `--text-numeral-xl/l/m/s`, `--text-h1…h4`, `--text-lead`, `--text-body`, `--text-body-s`, `--text-caption`, `--text-label`, `--text-code-l/code/code-s` (each with `--line-height` and `--letter-spacing` companions per §4.3) |
| Space / layout | Tailwind default `--spacing: 0.25rem`; `--space-section`, `--margin`, `--gutter`, `--pad`, `--container-content: 1440px`, `--container-reading: 720px`, `--header-h: 64px` (56 px < 1024) |
| Shape | `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 10px`, `--radius-full: 999px` |
| Elevation | `--shadow-paper-3`, `--shadow-paper-4` (night has no shadow tokens by design) |
| Z-index | `--z-raised 10`, `--z-sticky 20`, `--z-header 30`, `--z-dropdown 40`, `--z-overlay 50`, `--z-drawer 60`, `--z-dialog 70`, `--z-toast 80`, `--z-tooltip 90`, `--z-skip 100` |
| Motion | `--ease-sk-out`, `--ease-sk-in-out`, `--ease-sk-in`, `--ease-sk-snap`, `--dur-instant 80ms`, `--dur-quick 140ms`, `--dur-base 220ms`, `--dur-panel 360ms`, `--dur-panel-exit 240ms`, `--dur-stage 600ms`, `--dur-camera 900ms`, `--dur-reveal 620ms` (mirrored in `constants/motion.ts` for GSAP) |

### 3.8 Data visualisation (admin charts, step 15)
Bars/lines in `ink-2` (paper `#3D444C`), the current period in `accent` (fill) — the only highlighted series; comparison period `#BEC3C9`; grid `line-faint`; axes and labels `ink-3` 12 px tabular; value labels on bars; every chart has a „Prikaži tabelu“ table alternative. No pie charts; no more than two series per chart.

---

## 4. Typography

### 4.1 Families (all verified for č ć ž š đ Č Ć Ž Š Đ — 10/10 glyphs — with fontkit; all on Google Fonts and on @fontsource 5.3.0)

| Role | Family | Delivery | Files / weight | Why |
|---|---|---|---|---|
| **Display** (statements, section and category titles, wordmark) | **Archivo** (Omnibus-Type, OFL) as static instances **Expanded 125 · 600/700** | `next/font/local` → `app/fonts/archivo-expanded-{600,700}.woff2` | 15.1 / 16.0 KB (Latin + Latin-1 + Latin Ext-A + punctuation, one file each) | Wide capitals read like model badges and drawing title blocks — the automotive vernacular without a costume. The full variable font (wdth 62–125) would cost 172 KB; static instances cost 16 KB. |
| **Numerals** (prices, stage index, KPI figures) | **Archivo Condensed 75 · 600** | `next/font/local` → `app/fonts/archivo-condensed-600.woff2` | 15.9 KB, `tnum` retained | Instrument-like figures that stay compact in cards and tables. |
| **UI and text** | **Public Sans** (USWDS, OFL), variable wght 100–900 | `next/font/google`, subsets `latin`, `latin-ext` | 26 + 18 KB | Neutral, sturdy, government-grade legibility; `tnum` for aligned money; shares Archivo's Franklin-gothic roots so the pair is harmonious without being the same voice. |
| **Mono** (OEM/cross numbers, SKU, order and inquiry numbers, VIN, dimensions, coordinates) | **Martian Mono** (Evil Martians, OFL), wght 100–800 | `next/font/google`, subsets `latin`, `latin-ext`, **preload: false** | 23 + 15 KB | Dotted zero and distinct 1/l/I (0/O confusion is the classic OEM-number error); engraved-plate character that pairs with the wide display. |

Rejected (rendered side by side in `screens/fonts-*.png`): Barlow/Barlow Condensed (sports signage), Sofia Sans Extra Condensed (newspaper), Hubot/Mona Sans (single-storey quirks in text, GitHub association, 120 KB), Saira/Tektur (motorsport/sci-fi), Chivo Mono and Azeret Mono (0 and O indistinguishable, no `zero` feature), Atkinson Hyperlegible Next (slashed zero in prices), JetBrains Mono (dev-tool association), Space Grotesk/Inter/DM Sans/IBM Plex/Instrument Sans (impeccable and design-taste reflex lists), Geist (create-next-app default).

Font budget (home, first paint): Archivo expanded-700 16 KB + condensed-600 16 KB + Public Sans 44 KB = **76 KB preloaded** (expanded-600, used below the fold, is declared in the same `localFont` call as 700 and costs another 15 KB if both are preloaded — keep it in a separate call with `preload: false`). Martian Mono 38 KB is fetched on demand. Budget (SEO-ADS §J11): ≤ 3 families, ≤ 150 KB preloaded — met.

### 4.2 Loading (step 04, `lib/fonts.ts`)
```ts
import localFont from "next/font/local";
import { Martian_Mono, Public_Sans } from "next/font/google";

export const display = localFont({            // statements, wordmark
  src: [{ path: "../app/fonts/archivo-expanded-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-display", display: "swap", fallback: ["Arial", "sans-serif"],
});
export const displaySemibold = localFont({    // section/category titles (below the fold)
  src: [{ path: "../app/fonts/archivo-expanded-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-display-600", display: "swap", preload: false, fallback: ["Arial", "sans-serif"],
});
export const condensed = localFont({          // prices, stage numerals, KPI figures
  src: [{ path: "../app/fonts/archivo-condensed-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-condensed", display: "swap", fallback: ["Arial Narrow", "Arial", "sans-serif"],
});
export const ui = Public_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-ui", display: "swap" });
export const mono = Martian_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap", preload: false });
```
`next/font` generates size-adjusted fallbacks (no CLS). Regenerate the Archivo files with `node scripts/fonts/fetch-display-fonts.mjs` (committed; OG WOFFs land in `assets/fonts/og/`).

### 4.3 Type scale (fluid between 360 px and 1440 px viewports; clamp values are exact)

| Token | Family / weight | Size (360 → 1440) | `font-size` | Line height | Tracking | Case / use |
|---|---|---|---|---|---|---|
| `display-xl` | Archivo Expanded 700 | 36 → 56 px (64 at ≥ 1872) | `clamp(2.25rem, 1.833rem + 1.852vw, 4rem)` | 1.0 | 0.005em | Caps. Hero statement only (one per page). |
| `display-l` | Archivo Expanded 600 | 28 → 40 px (44 cap) | `clamp(1.75rem, 1.5rem + 1.111vw, 2.75rem)` | 1.04 | 0.005em | Caps. Section titles on marketing pages; category/system H1 (short, controlled vocabulary). |
| `display-m` | Archivo Expanded 600 | 20 → 26 px | `clamp(1.25rem, 1.125rem + 0.556vw, 1.625rem)` | 1.1 | 0.02em | Caps. Explode stage captions, part-panel title. |
| `numeral-xl` | Archivo Condensed 600 | 40 → 64 px | `clamp(2.5rem, 2rem + 2.222vw, 4rem)` | 0.9 | 0.005em | `tnum`. Admin KPI figures, big step numbers. |
| `numeral-l` | Archivo Condensed 600 | 30 → 40 px | `clamp(1.875rem, 1.667rem + 0.926vw, 2.5rem)` | 1.0 | 0.005em | `tnum`. Product-page price. |
| `numeral-m` | Archivo Condensed 600 | 22 → 26 px | `clamp(1.375rem, 1.292rem + 0.37vw, 1.625rem)` | 1.0 | 0.005em | `tnum`. Card and cart prices. |
| `numeral-s` | Archivo Condensed 600 | 18 → 20 px | `clamp(1.125rem, 1.083rem + 0.185vw, 1.25rem)` | 1.0 | 0.01em | `tnum`. Stage index numbers, stepper numbers. |
| `h1` | Public Sans 650 | 26 → 36 px | `clamp(1.625rem, 1.417rem + 0.926vw, 2.25rem)` | 1.15 | −0.015em | Sentence case. Product names, account and checkout titles. |
| `h2` | Public Sans 650 | 22 → 28 px | `clamp(1.375rem, 1.25rem + 0.556vw, 1.75rem)` | 1.2 | −0.01em | Page sections in Operate surfaces. |
| `h3` | Public Sans 600 | 18 → 20 px | `clamp(1.125rem, 1.083rem + 0.185vw, 1.25rem)` | 1.3 | −0.005em | Groups, card titles in large cards. |
| `h4` | Public Sans 600 | 16 px | `1rem` | 1.35 | 0 | Product card name, table group headers. |
| `lead` | Public Sans 400 | 18 → 20 px | `clamp(1.125rem, 1.083rem + 0.185vw, 1.25rem)` | 1.5 | 0 | `ink-2`. Hero subline, intros. Max 42ch. |
| `body` | Public Sans 400 | 16 px | `1rem` | 1.55 | 0 | Default text. Measure 65–72ch. |
| `body-s` | Public Sans 400 | 14 px | `0.875rem` | 1.5 | 0.003em | Secondary text, admin default. |
| `caption` | Public Sans 500 | 13 px | `0.8125rem` | 1.4 | 0.005em | Meta, helper text, stock line. |
| `caption-s` | Public Sans 500 | 12 px | `0.75rem` | 1.35 | 0.005em | Price notes („sa PDV-om“), quality chips, secondary table lines. Never for sentences. |
| `button` | Public Sans 600 | 15 px (sm 14) | `0.9375rem` | 1 | 0 | Button and nav labels. |
| `label` | Public Sans 600 | 11–12 px | `0.6875rem`–`0.75rem` | 1.2 | 0.06em | Caps. Table headers, badges. **Never above a heading** (no eyebrows). |
| `code-l` | Martian Mono 500 | 16 px | `1rem` | 1.5 | 0.01em | OEM/cross lists on the product page. |
| `code` | Martian Mono 400 | 13 px | `0.8125rem` | 1.5 | 0.01em | Codes in cards, tables, cart. |
| `code-s` | Martian Mono 400 | 11 px | `0.6875rem` | 1.3 | 0.04em | Ornaments: dimensions, coordinates, ruler labels, title-block keys (caps). |

Admin (paper) scale: base `body-s` 14 px; table cells 13.5 px; page title 22 px Public Sans 650; section titles 16 px 600; KPI figures `numeral-xl` capped at 40 px.

### 4.4 Rules
- Hierarchy is built from weight + size + case together (apple-design): expanded caps for brand statements, Public Sans 650 for task headings. Never two display lines of different families side by side.
- Tracking is size-specific: display caps 0.005–0.02em; caps labels 0.06em; body 0; large UI headings negative (−0.015em max; floor −0.04em).
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs; no justified text; hyphenation off (`hyphens: manual`) — Serbian dictionaries are not reliable in browsers.
- Numerals: `font-variant-numeric: tabular-nums` for prices, quantities, table cells, timers and counts; proportional figures in running text. Serbian formats: `12.990 RSD`, `12.990,50 RSD`, `29.09.2026.`, `11:42`, `15 %`, `+381 64 123 4567` (all via `lib/format`).
- Non-breaking spaces: between number and unit (`12.990 RSD`, `4 kom.`, `312 mm`, `15 %`), inside phone groups, after one-letter words at line end in headings (`i`, `u`, `s`, `k`, `o`, `a`) — `lib/format/nbsp.ts` in step 04.
- Quotes and dashes: „…“ (U+201E … U+201C), apostrophe ’, ranges with an en dash and no spaces (`1–2 dana`, `2012–2020`), parenthetical dash as spaced en dash (` – `) in body copy; em dash only in titles/callouts („Kočioni disk — prednji levi“). A dash never starts a line: the space before it is a no-break space (`Cupra&nbsp;— po OEM broju`).
- Measurements on drawings are written without digit grouping, as on engineering drawings (`4280`, `2620`, `Ø 312`); money and quantities are grouped (`12.990 RSD`, `1.250 kom.`).
- Uppercase only through `text-transform` (source copy in sentence case, so screen readers and copy editing stay natural). Caps are allowed for: display tokens, labels, title-block keys. Never for paragraphs or buttons.
- Mono only for code, data and measurement (craft floor): OEM/cross numbers, SKU, EAN, VIN, order/inquiry numbers, dimensions, coordinates, keyboard keys. Never for prose, buttons or headings.
- Minimum sizes: 16 px for body text and all form inputs on mobile (prevents iOS zoom); 13 px for meta; 11 px only for `code-s` ornaments and caps labels.

---

## 5. Layout

### 5.1 Grid and breakpoints

| Breakpoint (min-width) | Name | Columns | Gutter | Outer margin | Typical |
|---|---|---|---|---|---|
| 0 (design at 360 and 390) | base | 4 | 16 px | 16 px | Phones |
| 480 px | `sm` | 4 | 16 px | 20 px | Large phones, landscape |
| 768 px | `md` | 8 | 20 px | 32 px | Tablets |
| 1024 px | `lg` | 12 | 24 px | 40 px | Laptops, the mid 3D tier starts at the high tier here |
| 1280 px | `xl` | 12 | 24 px | 48 px | Desktop (hero title block appears) |
| 1536 px | `2xl` | 12 | 24 px | auto (centred) | Large desktop |
| 1920 px | `3xl` | 12 | 32 px | auto (centred) | Wide screens; hero stage keeps scaling to 2560 |

- Outer margin token: `--margin: clamp(16px, 4vw, 48px)`; gutter token: `--gutter: clamp(16px, 1.7vw, 24px)` (32 px at `3xl`). Content cap: sections use `padding-inline: var(--pad)` with `--pad: max(var(--margin), calc((100% - 1440px) / 2))` — content never grows wider than 1440 px, the side margins grow instead (verified at 2560 px in `/lab/koncept`).
- Containers: `--container-content: 1440px` (inner width for storefront content; margins grow beyond it), `--container-reading: 720px` (legal, FAQ answers, e-mails 600 px), admin fluid up to `1680px`. The hero is full-bleed; its copy aligns to the content grid.
- Tailwind v4 (step 04): `--breakpoint-sm: 30rem; --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem; --breakpoint-2xl: 96rem; --breakpoint-3xl: 120rem`.
- 2560 px: the hero stage and its ruler scale with the viewport; text keeps its 1440 container; product grids go to 5 columns at ≥ 1920 (cards never wider than 360 px).
- Asymmetry rule (design-taste): on Persuade surfaces ≥ 1024 px, copy occupies columns 1–5 and the object columns 6–12 (never a centred hero); below 1024 px every layout collapses to one column in reading order: statement → primary action → object → secondary actions.

### 5.2 Spacing scale (4 px base; Tailwind v4 default `--spacing: 0.25rem`)
`0, 1px, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160` px (Tailwind `0, px, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40`).
- Component internals: 4 / 8 / 12 / 16. Card padding 16 (mobile 12). Drawer padding 24 (mobile 16). Admin cell padding 12 × 0 (row height 44).
- Section rhythm (storefront): `--space-section: clamp(4rem, 2.667rem + 5.926vw, 8rem)` (64 → 128 px) padding-block; heading → content 32 px; content → section CTA 40 px. More space above a heading than below it (craft floor): heading margin-top ≥ 2× margin-bottom.
- Dense rhythm (admin, mechanic portal): 16 / 24 between blocks; tables 44 px rows (36 px compact density toggle).
- Touch: primary touch targets ≥ 44 × 44 px, any target ≥ 24 × 24 px, 8 px minimum between adjacent targets.

### 5.3 Radii
`--radius-xs: 2px` (buttons, inputs, badges, chips, focus-friendly squared look) · `--radius-sm: 4px` (cards, panels, tables, toasts) · `--radius-md: 6px` (admin frame, popovers, dialogs) · `--radius-lg: 10px` (mobile bottom-sheet top corners only) · `--radius-full: 999px` (count badges only). Nothing is pill-shaped except counts — the drawing-sheet world is squared.

### 5.4 Hairlines and borders
1 px everywhere (`line`, `line-strong`, `control`); 2 px only for the focus ring and active indicators (stage bar, tab underline). Never a coloured `border-left`/`border-right` above 1 px (craft floor); the callout's 1 px accent edge is the maximum.

### 5.5 Elevation — commit to one: an edge **or** a soft elevation, never a hairline plus a wide shadow
(The hairline + wide diffuse shadow pair is a generated-UI signature flagged by impeccable's detector in round 1.)

| Level | Night (edges) | Paper (elevation for floating things, edges for resting things) | Use |
|---|---|---|---|
| 0 | flat on `bg` | flat on `bg` | Sections |
| 1 | `surface-1` + 1 px `line` | `#FFF` + 1 px `line`, no shadow | Cards, panels, tables |
| 2 | `surface-1` + 1 px `line-strong` | `#FFF` + 1 px `line-strong` | Hovered card, sticky bars |
| 3 | `surface-3` + 1 px `line-strong`, **no shadow** | `#FFF`, **no border**, `0 1px 2px rgb(18 21 24 / .10), 0 8px 24px -6px rgb(18 21 24 / .18)` | Popovers, combobox lists, callouts, menus |
| 4 | `surface-3` + 1 px `line-strong` on the open edge + scrim `rgb(7 8 10 / .72)` (cart, dialogs) or no scrim (3D part panel) | `#FFF`, no border, `0 24px 64px -16px rgb(18 21 24 / .28)` + scrim `rgb(18 21 24 / .4)` | Drawers, sheets, dialogs |

Header: `bg` at 88 % + `backdrop-filter: blur(12px)` — functional (content, including the 3D stage, scrolls beneath). `prefers-reduced-transparency: reduce` → solid `bg-raised`.

### 5.6 Z-index scale
`--z-base: 0` · `--z-raised: 10` (sticky table headers, hovered card) · `--z-sticky: 20` (sticky filters, quick-order box, checkout summary) · `--z-header: 30` · `--z-dropdown: 40` (combobox, menus, popovers) · `--z-overlay: 50` (scrims) · `--z-drawer: 60` (cart drawer, part panel, sheets) · `--z-dialog: 70` · `--z-toast: 80` · `--z-tooltip: 90` · `--z-skip: 100` (skip link). The hero is its own stacking context (`isolation: isolate`): canvas 0, poster −1 under it, overlays 1–3.

### 5.7 Technical ornaments — catalogue and rules
| Ornament | Spec | Where | Truth source |
|---|---|---|---|
| **Dimension lines** | 1 px `control` line, 45° tick terminators 12 px, dashed 1 px `line-strong` extension lines (3/3), label `code-s` `ink-3` on a `bg` knockout | Hero stage (length, wheelbase, height); product page spec drawing (disc Ø × thickness) | Manifest `bbox`, wheelbase, product specs |
| **Ruler floor** | Ground line `line-strong`; minor ticks every 100 mm (`line`), 500 mm (`line-strong`, longer), 1000 mm longest; **no numbers** on the ruler (the dimension lines carry the values — round 2: ruler labels collided with the wheelbase value) | Hero stage only | Manifest units (metres) |
| **Coordinates** | Plain-language position instead of numbers („prednji levi“, „zadnji desni“) from the node's instance code; numeric pivots (`x 0,74 y 0,32 z 1,31`) only in the test hooks/dev overlay — round 1 showed numeric coordinates read as HUD decoration to users | 3D callouts, parts list | Instance code, manifest |
| **Callout + leader** | Leader 1 px `accent` from the part (anchor dot 4 px `accent` with a 2 px `bg` ring) straight to an annotation lane above the object, then a horizontal shelf; label box on the shelf: `surface-3`, 1 px `line-strong`, radius 2, **no shadow**; title 14/600 (category name), one mechanic note 12.5 px `ink-2` (e.g. „Pre zamene proverite broj na kućištu turbine.“), action 13/600 `ink-1` with a `line-strong` underline that turns `accent` on hover + `ArrowRight` icon („12 artikala za Golf VII“) | 3D hover/selection; product-page spec drawing | `labelAnchor`, taxonomy `calloutNoteSr`, live count for the selected vehicle |
| **Corner ticks** | 14 px L-shapes, 1 px `line-strong`, marking a drawing area | Hero stage frame, OG frame, empty-state drawing frames | — |
| **Title block** | `<dl>` grid of cells with 1 px `line` rules on `bg`; key `code-s` caps `ink-3` (≥ 11 px), value 12 px `ink-2` / mono `ink-1`; content: „Prikaz: Generički kompaktni hečbek, nije konkretan model“ · „Faza 00 / 07“ (live) · „Kategorija 44“ · „Mere mm“; attached to the stage frame's top-right at ≥ 1440 px (at 1280 it crowded the roof and the callout — round 3); below 1440 px it becomes one visible line under the drawing (the honesty note is never hidden from anyone) | Hero, one per page max | Taxonomy counts, explode progress, honesty note |
| **Stage index** | `00–07` as **buttons** (detents: click jumps to the stage end), numbers `numeral-s`, labels 13 px; active: 2 px accent bar + accent number + `aria-current="step"`; mobile: compact „00 / 07 Sklopljeno — skrolujte da rasklopite“ | Explode track only | Manifest `stages` |
| **Part codes** | `code`/`code-l`; OEM label „OEM“ in UI sans before the value | Cards, product, cart, admin, quick order | Product data |

Rules: an ornament must measure or identify something real; maximum four ornament types in one viewport; none in checkout, forms, legal pages, admin (except codes) or e-mails (except the order number); ornaments are `aria-hidden` when they duplicate information available as text.

---

## 6. Iconography and imagery

### 6.1 Icon set
- **Phosphor Icons** (`@phosphor-icons/react` 2.1.10, MIT). Import from `@phosphor-icons/react/dist/ssr` in Server Components; add `experimental.optimizePackageImports: ["@phosphor-icons/react"]` (it is not in Next's default list).
- Weight **regular** (stroke = 1/16 of the size: 1.5 px at 24, 1.25 px at 20, 1 px at 16). `fill` only for on-state (favorite, stock square, active nav); `bold` only ≤ 14 px inside dense admin badges. Never `duotone`/`thin`.
- Sizes: 16 (inline with 13–14 px text), 20 (buttons, inputs, list rows), 24 (header, bottom nav), 32 (empty states). Colour = `currentColor`.
- Decorative icons `aria-hidden="true"`; icon-only buttons have an `aria-label` (never hide the label with `display:none` — use the visually-hidden utility).
- Never size SVGs with a descendant selector inside a component (`.drawing svg {…}` enlarged an icon nested in the callout in round 2); target direct children (`.drawing > svg`) or give icons their own `size`.
- Core map: search `MagnifyingGlass`, cart `ShoppingCartSimple`, account `UserCircle`, menu `List`, close `X`, vehicle `Car`/`CarProfile`, filters `SlidersHorizontal`, parts list `ListBullets`, explode `Cube`, copy `Copy`→`Check`, phone `Phone`, Viber `ChatCircleText` + word „Viber“ (no third-party logo), WhatsApp `WhatsappLogo`, e-mail `Envelope`, address `MapPin`, inquiry `Question`/`ChatCircleText`, delivery `Truck`, pickup `Storefront`, back-in-stock `Bell`, print `Printer`, upload `Upload`, Excel `FileXls`, undo/rollback `ArrowCounterClockwise`, external `ArrowSquareOut`.

### 6.2 Custom part glyphs (plan)
- 10 system glyphs + 44 category glyphs (+ 4 filter subcategories) drawn on Phosphor's grid (256 units, displayed at 24 px), stroke 16 units, round caps/joins, no fills except the `fill` on-state variant, optical centre at 128/132. Drawn from the category silhouettes seen in the X-ray: disc, pad pair, caliper, strut with spring, control arm with bushings, tie rod, rack, bearing/hub, CV shaft, clutch plate, gearbox, turbo snail, intercooler, manifold, injector, belt on pulleys, alternator, starter, plug + coil, sump, EGR valve, engine mount, DPF can, silencer, radiator, thermostat + hose, AC compressor, battery, headlight, tail light, sensor, bonnet, bumper, fender, door, mirror, windscreen, wiper, wheel, oil/air/fuel/cabin filter, oil can.
- Files `components/icons/parts/<slug>.tsx` generated from `3d/`-independent SVG sources in `components/icons/parts/src/*.svg`; step 04 ships the 10 system glyphs, step 12 the 44 category glyphs.
- Used in: category chips and grid captions, part-panel header, parts-list dialog, mobile category navigation, admin category tree and 3D mapping.

### 6.3 Renders (steps 08–09) and product photos
- **Hero posters**: assembled + exploded, desktop 16:9 (2560/1920/1440/1080 widths) and mobile 4:5 (1080/828/640), AVIF + WebP, same camera as `cameras.hero` in the manifest so the poster → 3D crossfade is invisible. Background `#0D0F11` with the ruler-floor decal; no text baked in.
- **Category thumbnails**: 1:1 master 1024 → 640/320 AVIF/WebP; camera three-quarter front-left, 35 mm-equivalent, part at 70 % of the frame, optical centre at 48 % height; key light warm from upper left, cool rim `#9FE9FF` from behind right; background radial `#1A1E23 → #0F1114`; contact shadow only, no reflective floor; the part in its real material (§7.3). Filenames `public/images/parts/<slug>.webp`.
- **Client product photos (later)**: neutral dark-graphite sweep (`#1C2025`–`#2B3138`) or mid-grey `#8A8F94`, three-quarter angle, part fills 70 %, even soft light, no hands/props/packaging unless the box is the product, ≥ 2000 px long edge, JPEG/WebP; the site letterboxes into the same 4:3 card frame. Guide for the owner in `docs/HUMAN-TODO.md`.
- **Never**: stock photos, AI people or AI car photos, VAG logos, badges or brand-coloured cars.
- Alt text: Serbian, specific („Kočioni disk Brembo 09.C404.13, prednji, Ø 312 mm“); decorative renders `alt=""`.

### 6.4 X-ray illustration palette (SVG drawings: hero placeholder, empty states, spec drawings)
Shell and glass: `rim` `#9FE9FF` (1.25 px non-scaling stroke, 4–10 % fill), `rim-soft` `#4DB5D6` (16-unit blur glow at 32 %), `rim-deep` `#123642`. Parts: fill `#262B31` / light `#343B43`, stroke `#8F949A` / light `#B0AAA1`, fins and ticks `#4F565E`, ghosted parts `#22272C` at 70 %. Selected part: fill `#3A2012`, stroke `accent`, highlight `#FFB38A`. Dimension lines `control`, extension lines `line-strong` dashed 3/3, ground `line-strong`. These values are illustration tokens (listed in `DESIGN.md` as `xray-*`); UI never uses them.

### 6.5 Empty states
A drawing frame (corner ticks) holding the relevant part glyph at 32–48 px in `ink-3`, one plain sentence, one action — usually the inquiry. No illustrations of people, no jokes. Examples in §11.3.

---

## 7. 3D art direction (for steps 07–11; contract in `docs/3D-CONTRACT.md`)

### 7.1 Scene
- Background = page `bg #0D0F11` (the canvas is transparent over the section background so the poster underneath and the page share one colour). No fog on desktop; mid tier: none either.
- Floor: a 6.4 m disc decal under the car: radial gradient `#15191D` (centre) → transparent (edge) at 55 % opacity + the **ruler floor** (lines every 0.5 m at 6 % `#9FE9FF`, 1.0 m at 10 %, fading out radially from 2.2 m) + a baked contact-shadow texture (512², soft, 45 % black) — no real-time shadows.
- Tone mapping `THREE.NeutralToneMapping` (Khronos PBR Neutral: keeps product colours honest), exposure 1.0, `outputColorSpace = SRGBColorSpace`.

### 7.2 X-ray glass shader (body shell `mat_body_xray` and windows `mat_glass_xray`, replaced at runtime)
```
N·V fresnel      rim = pow(1.0 − saturate(dot(N, V)), uRimPower)        // uRimPower 2.6 desktop, 2.2 mid tier
colour           col = mix(uTint, uRimColor, rim) ;  uTint #123642 · uRimColor #9FE9FF
alpha            a = mix(uBaseAlpha, 0.92, rim)                            // uBaseAlpha 0.22 at stage 0 → 0.10 after stage 1 (contract F6)
back faces       rendered in a second pass at 0.5 × alpha (far side faintly visible)
env              + envMap reflection × 0.35 (RoomEnvironment) for a glass sheen on the flat panels
glass            same shader, uRimPower 3.2, rim × 0.7, uBaseAlpha 0.06, tint #9FE9FF
selection        when a category is selected: uBaseAlpha → 0.06 over 300 ms (reveal the parts)
```
- Material flags: `transparent: true`, `depthWrite: false`, `side: FrontSide` (+ back pass), `renderOrder` shell 10 / glass 11 (opaque parts render first), `toneMapped: true`.
- **Edge lines** (desktop only): `EdgesGeometry(shellGeometry, 28°)` → `LineSegments`, colour `#9FE9FF`, opacity 0.35 → 0.2 after stage 1; built in an idle slice after first frame. Mid tier: no edge lines (rim only).
- **Subtle detail, never kitsch**: no scan lines, no hologram flicker, no grid texture on the body, no bloom, no chromatic aberration, no animated noise. The premium signal is the clean rim, the sheen and the crisp edges.
- Budget: the X-ray pass ≤ 1.5 ms/frame on the mid tier (measured in step 10).

### 7.3 Part materials (glTF metallic-roughness, linear workflow; base colours given as sRGB hex)
| Slot | Base colour | Metallic | Roughness | Notes / examples |
|---|---|---|---|---|
| `mat_cast_iron` | `#5A5C5E` | 1.0 | 0.72 | Disc hats, block, calipers raw |
| `mat_machined_steel` | `#A9ADB1` | 1.0 | 0.28 | Disc friction faces (+ radial scratch normal), shafts |
| `mat_steel_dark` | `#3A3D40` | 1.0 | 0.55 | Springs (coated), brackets, arms |
| `mat_brushed_alu` | `#C4C7CA` | 1.0 | 0.35 | Intercooler end tanks, pipes |
| `mat_cast_alu` | `#A7A9AB` | 1.0 | 0.55 | Gearbox case, head, alternator housing |
| `mat_painted_black` | `#151617` | 0.0 | 0.45 | Subframe, wheels' inner barrel (clearcoat 0.3 where supported) |
| `mat_plastic_black` | `#121314` | 0.0 | 0.60 | Engine covers, airbox, bumper inner |
| `mat_plastic_grey` | `#3B3E41` | 0.0 | 0.55 | Reservoirs, connectors |
| `mat_rubber` | `#1A1A1B` | 0.0 | 0.85 | Bushings, boots, mounts |
| `mat_tyre` | `#1C1C1D` | 0.0 | 0.90 | + sidewall/tread normal (≤ 1024²) |
| `mat_hose` | `#202122` | 0.0 | 0.75 | Coolant and intake hoses |
| `mat_chrome` | `#E3E5E7` | 1.0 | 0.08 | Exhaust tip only |
| `mat_copper` | `#B87333` | 1.0 | 0.35 | Alternator windings hint, sensor terminals |
| `mat_ceramic` | `#D9D6CF` | 0.0 | 0.40 | Spark-plug insulators |
| `mat_caliper` | `#2E3136` | 0.3 | 0.40 | Graphite; accent only as the runtime *selected* state, never a brand colour |
| `mat_battery` | `#1E2022` | 0.0 | 0.50 | Case; label zone `#2B2E31` |
| `mat_heat_shield` | `#9C9FA2` | 1.0 | 0.45 | + embossed normal |
| `mat_wire` | `#2A2C2E` | 0.0 | 0.60 | Harness bundles |
| `mat_glass_lens` | `#DDE6EA` | 0.0 | 0.05 | Alpha 0.25 (no transmission — cost) |
| `mat_emissive_led` | `#F4F1EA` | 0.0 | 0.30 | Emissive `#F4F1EA` × 1.5 (DRL) |
| `mat_emissive_tail` | `#5A0F12` | 0.0 | 0.35 | Emissive `#B3261E` × 0.8 (functional red, not a brand colour) |

### 7.4 Lighting
- Environment: `RoomEnvironment` PMREM (D8), `environmentIntensity` 0.9 for parts (shell uses 0.35 via its shader).
- Key: directional, azimuth 35° front-left, elevation 40°, colour `#FFF4E8`, intensity 1.6.
- Rim/back: directional, azimuth 200° rear-right, elevation 25°, colour `#CFEFFF`, intensity 1.2 — echoes the X-ray rim on metal edges.
- Fill: hemisphere sky `#1C2530`, ground `#0D0F11`, intensity 0.35.
- Blender renders (posters/thumbnails) match this rig with a Poly Haven CC0 studio HDRI at strength 0.6 + the same key/rim area lights.

### 7.5 States
| State | Parts | Shell | UI |
|---|---|---|---|
| Idle (assembled) | PBR as authored | α 0.22, rim 1.0 | Headline, search, stage 00 |
| Hover (fine pointer) | All nodes of the category: part rim tinted `#FF6B1A` × 0.6 + emissive `#FF6B1A` × 0.12 | unchanged | Callout (category name, plain-language position, mechanic note, live count) with leader, cursor pointer |
| Selected | Category: rim accent × 1.0 + emissive × 0.18; all other parts → 55 % brightness, desaturated 40 % (300 ms) | α → 0.06 | Camera glides to focus (0.9 s `power3.inOut`), part panel opens, `?deo=` set |
| Dimmed (other parts while selected) | 55 % brightness | α 0.06 | — |
| Low tier (no WebGL) | Posters only | — | Same panel, same list, same captions |

### 7.6 Camera framing (manifest `cameras.hero` / `cameras.exploded`, per breakpoint)
| Viewport | FOV | Car placement | Car length on screen |
|---|---|---|---|
| ≥ 1280 px | 28° | centred at 64 % of the width, 52 % of the stage height (right of the copy column) | ≈ 56 % of the viewport width |
| 1024–1279 px | 30° | centred at 62 % | ≈ 60 % |
| 768–1023 px (stacked) | 32° | centred horizontally, below the copy | ≈ 82 % |
| < 768 px (portrait 4:5 stage) | 38° | three-quarter front, centred, 58 % height | ≈ 92 % |
Exploded camera: dolly out + ≈ 12° orbit (mobile 6°) so the whole exploded layout fits with 8 % margin at p = 1 and reads as a clean drawing (no overlaps).

### 7.7 Explode choreography
Stages, windows and grouping exactly as in 3D-CONTRACT §F6. Node motion `pivot + dir × distance × power2.inOut(local)` staggered by `explode.order` (≤ 0.35 of the stage window). Scrub smoothing `scrub: 0.6`. Stage captions (HTML, bottom-left above the stage index): `display-m` system title, `code-s` line „{n} kategorija · {m} delova“, one sentence `body-s` `ink-2`; captions change by hard cut at the stage boundary with the text-reveal replay (words, ≤ 450 ms). The stage index mirrors progress: 2 px accent bar fills the current stage cell; clicking a stage scrolls to that stage's end (ScrollToPlugin, 0.9 s `sk.inOut`). Hold at 0.92–1.00 shows „Kliknite na deo“ (desktop) / „Dodirnite deo“ (mobile).

### 7.8 Poster → 3D
Poster SSR (`preload`, `fetchPriority="high"`) → on intent/idle the canvas mounts behind the poster → first frame ready → **600 ms opacity crossfade `sk.inOut`** poster → canvas (no scale, no blur — the car must not jump); poster stays underneath for context loss. Loading indicator: a 2 px `accent` hairline along the bottom edge of the stage frame (scaleX = real progress, linear), SR text „Učitava se 3D prikaz“ only after intent.

### 7.9 Mobile simplifications (mid tier)
Lite GLB, DPR ≤ 1.5, rim power 2.2, no edge lines, no hover (tap selects), 200 vh track with grouped stages, orbit 6°, only the selected category label, bottom sheet instead of drawer, stage index collapsed to `03 / 07 Kočnice i vešanje` with previous/next buttons (44 px).

### 7.10 Reduced motion
No pin, no scrub: the stage shows the assembled state with „Rasklopi / Sklopi“ (toggle) — state changes are cuts with a 200 ms opacity crossfade of the canvas; camera moves are cuts; the parts list dialog is the primary navigation.

---

## 8. Motion system

### 8.1 Principles (personality: **Instrument**)
1. **Rigid, not elastic** — parts are metal: 0 % overshoot anywhere, decisive deceleration, no bounce/elastic/back eases.
2. **Motion explains assembly and state** — the explode (assembly), panels and sheets (where things come from and go back to), feedback (press, added, copied). Nothing moves for decoration; no looping ambient motion.
3. **Start from what is on screen** — every tween starts from the presentation value (`gsap.to`, never re-`fromTo` on interruption), `overwrite: "auto"`; a user can grab or reverse anything mid-flight.
4. **Same path in and out** — a drawer that enters from the right leaves to the right; a sheet returns to the bottom edge; popovers grow from their trigger.
5. **Content is visible by default** — only the text-reveal system hides copy before it enters; images, cards, prices and controls are never hidden for an entrance.

### 8.2 Duration tokens
| Token | ms | GSAP s | Use |
|---|---|---|---|
| `--dur-instant` | 80 | 0.08 | Hover colour/border, tooltip in |
| `--dur-quick` | 140 | 0.14 | Press, toggle, checkbox, chip select |
| `--dur-base` | 220 | 0.22 | Toast in, menu/popover in, tab indicator, accordion content fade |
| `--dur-panel` | 360 | 0.36 | Drawer/sheet/dialog enter |
| `--dur-panel-exit` | 240 | 0.24 | Drawer/sheet/dialog exit (exits ≈ ⅔ of entries) |
| `--dur-stage` | 600 | 0.60 | Poster → 3D crossfade, part dimming |
| `--dur-camera` | 900 | 0.90 | Camera glide to a part, stage jump |
| `--dur-reveal` | 620 | 0.62 | One word of the text reveal (§8.6) |
Mobile uses the same tokens (they are already short); distance, not duration, is reduced.

### 8.3 Easing tokens (registered once in `lib/gsap/client.ts` with CustomEase; mirrored as CSS variables)
| Token | cubic-bezier | GSAP | Use |
|---|---|---|---|
| `sk.out` (signature, ~80 % of UI) | `0.16, 1, 0.3, 1` | `CustomEase.create("sk.out", "0.16,1,0.3,1")` | Entrances, panels, reveal, toasts |
| `sk.inOut` | `0.65, 0, 0.35, 1` | `"sk.inOut"` | On-screen moves, stage jumps, crossfades, accordions |
| `sk.in` | `0.55, 0, 1, 0.45` | `"sk.in"` | Exits, dismissals |
| `sk.snap` | `0.2, 0, 0, 1` | `"sk.snap"` | Press/release, toggles, tab indicator |
| explode | — | `power2.inOut` (per node, local) | 3D explode (contract) |
| camera | — | `power3.inOut` | Camera glide (contract) |
| scrub | — | `none` on the scrubbed timeline | The scroll is the ease |
Enter distances: UI 8 px (menus, toasts 16 px), panels 24 px + opacity (desktop drawer), sheets from the bottom edge (full travel).

### 8.4 Choreography and ScrollTrigger rules
- Lead with the object; one authored moment per page; ≤ ⅓ of elements in motion at once; lists stagger ≤ 30 ms per item, ≤ 360 ms total; nothing travels more than ⅓ of the viewport without a keyframe (the explode is scroll-driven, so it is exempt).
- **Hero explode**: one pinned section (`pin: true`, `start: "top top"`, `end: "+=320%"` desktop / `"+=200%"` mobile via `gsap.matchMedia`), `scrub: 0.6`, no snap (native scroll feel; the detented control is the stage index and the „Rasklopi“ toggle). The timeline is built from manifest stages with labels `st-0…st-7`; stage captions and the stage index read the timeline's progress (no separate triggers).
- Other sections: **no ScrollTrigger entrances** — copy is handled by the text reveal; sticky bars use CSS `position: sticky`.
- Create triggers top to bottom (hero first); async ones set `refreshPriority`; `ScrollTrigger.refresh()` after `document.fonts.ready`, after the poster → canvas swap, after route changes (`ScrollTriggerRefresher`), and when the reserved track height changes between media queries. No `markers` in production; no ScrollSmoother (D-list).
- Everything inside `useGSAP({ scope })`; handlers via `contextSafe`; breakpoints and reduced motion via `gsap.matchMedia()`; animate only `transform`, `opacity`, `filter` (reveal blur) and CSS variables.

### 8.5 Micro-interactions
| Element | Behaviour |
|---|---|
| Button | Hover: fill/border colour 80 ms linear. Press (pointer-down): `translateY(1px)` + `accent-active` 140 ms `sk.snap`; release returns 140 ms. Loading: label stays, a 16 px inline spinner replaces the leading icon, width locked (no shift), `aria-busy`. |
| Link | Underline colour `line-strong` → `accent` 80 ms; offset 4 px, thickness 1 px. |
| Input | Border colour instant on hover; focus: border `accent` + 1 px inner ring, no animation. Error appears instantly under the field (no shake). |
| Add to cart | Label → „Dodato“ + `Check` icon for 1.6 s (`aria-live="polite"` announces „Dodato u korpu: {naziv}“), header cart count rolls up one digit (8 px vertical tick, 180 ms `sk.out`); no flying thumbnails. Mobile: the same + a toast with „Pogledaj korpu“. |
| Copy OEM | `Copy` → `Check` for 1.2 s + toast „OEM broj kopiran“. |
| Quantity stepper | Value changes instantly; long-press repeats at 120 ms after 400 ms delay. |
| Toast | Enter from 16 px below + opacity 220 ms `sk.out`; exit opacity 160 ms `sk.in`; stack max 3; 5 s auto-dismiss (errors persist), pause on hover/focus. |
| Dialog | Scrim opacity 220 ms; panel 8 px lift + opacity 240 ms `sk.out`; exit 160 ms `sk.in`; focus moves in on open and back to the trigger on close. |
| Drawer (desktop, right) | x 24 px → 0 + opacity, 360 ms `sk.out`; exit 240 ms `sk.in` to the right; scrim for the cart, **no scrim for the 3D part panel** (parallel task: the car stays visible). |
| Bottom sheet (mobile) | GSAP Draggable (type `y`) + InertiaPlugin: 1:1 tracking from the grab offset, snap points `[peek 42 %, full 92 %]` chosen from the **projected** end point, release velocity handed to inertia (`velocity: "auto"`), rubber-band beyond full (`resistance 0.55`), dismiss when the projection is below 25 % or the flick is > 800 px/s down; a visible drag handle (36 × 4 px `line-strong`) plus a close button. |
| Accordion (FAQ, filters) | Height 0 → auto 280 ms `sk.inOut` via GSAP + content opacity 180 ms; caret rotates 180° 220 ms. |
| Tabs | 2 px indicator slides 220 ms `sk.snap`; panels swap instantly. |
| Skeleton | Static `surface-2` blocks with a 1.6 s linear shimmer (`surface-2 → surface-3 → surface-2`, 30 % width); reduced motion: static. |
| Stock/price live updates | Value swaps with a 400 ms background flash from `accent-subtle` to transparent (price) or none (stock); `aria-live` only for the cart total. |

### 8.6 Text reveal (site-wide, mandatory — parameters for `constants/textRevealConfig.ts`)
| Parameter | Value |
|---|---|
| Split | By word (text nodes moved into `span.reveal-word`, never cloned); > `maxWords: 60` → the element fades as one block (opacity + 6 px lift, 500 ms `sk.out`); lines inside flex/grid items fade as a block. |
| Order | Random per element (shuffled word order), not left-to-right. |
| From → to | `opacity 0 → 1`, `filter: blur(8px) → blur(0)`, `translateY(0.35em) → 0`. |
| Duration / ease | 620 ms per word, `sk.out` (CSS `cubic-bezier(0.16, 1, 0.3, 1)`). |
| Stagger | `min(28 ms, 520 ms / wordCount)` between shuffled words → an element never takes longer than ≈ 1.14 s. |
| Trigger | One IntersectionObserver, root margin bottom `-15%` (`enterRatio: 0.15`), each element once; a MutationObserver picks up streamed/route content. |
| Failsafe | `html.tr-js` added by the boot script; `tr-failsafe` after 3 500 ms reveals everything; `<noscript>` + `@media (scripting: none)` never hide. |
| Skip | `[data-reveal="off"]` subtrees, nav, forms, dialogs/sheets, `[aria-live]`, `[role=status]`, live values (Price, StockBadge, counters, toasts), the whole admin shell. |
| Reduced motion | Never hidden, no animation. |
| **LCP-safe variant** (`RevealText`, Server Component, above the fold) | Words split on the server into `span.rw` with `--i` = deterministic shuffled index (seeded by a hash of the text) and `--n` = word count; wrapper `data-reveal="off"`; pure CSS keyframes from first paint: `from { opacity: .35; filter: blur(10px); transform: translateY(.3em) }` → rest, duration 540 ms `sk.out`, delay `calc(var(--i) * 360ms / var(--n))` → the whole block completes ≤ 900 ms; the first painted frame is readable (opacity .35), so LCP is not delayed. |

### 8.7 Reduced motion (`prefers-reduced-motion: reduce`)
| Normal | Reduced |
|---|---|
| Explode scrub, pin, camera glides | Instant states via „Rasklopi / Sklopi“, cuts, 200 ms canvas crossfade |
| Text reveal (both variants) | Text visible immediately |
| Drawer/sheet slide | 160 ms opacity only |
| Dialog lift | Opacity only |
| Toast slide | Opacity only |
| Add-to-cart count roll | Instant number change |
| Skeleton shimmer | Static |
| Hover colour changes, focus ring | Unchanged (not motion) |
`prefers-reduced-transparency: reduce` → header and callouts become solid surfaces. `prefers-contrast: more` → `line` → `line-strong`, `ink-3` → `ink-2`, focus ring 3 px.

---

## 9. Component inventory

Conventions for every component (ARCHITECTURE §G3): forwarded ref, `asChild` where useful, `data-state` hooks, tokens only (no hard-coded colours), all states below, targets ≥ 24 px (≥ 44 px for primary touch), visible focus (2 px `accent` outline, 2 px offset; on accent fills the ring is `ink-1`; inside tables the ring is inset −2 px). "Disabled" is used sparingly — prefer an enabled control that explains why it cannot proceed.

### 9.1 Button
Anatomy: [leading icon 20] label [trailing icon 16] · height sm 36 / md 44 / lg 52 (hero search 56) · padding-inline 12 / 16 / 20 · radius 2 · label Public Sans 600 15 px (sm 14) · gap 8.

| Variant | Default | Hover | Focus-visible | Active (pressed) | Disabled | Loading | Error / danger |
|---|---|---|---|---|---|---|---|
| **Primary** (one per region) | `accent` fill, `on-accent` label | `accent-hover` | ring `ink-1` 2 px offset 2 | `accent-active`, translateY 1 px | `surface-2` fill, `ink-4` label, no pointer | spinner replaces leading icon, `aria-busy`, width locked | — |
| **Secondary** | transparent, 1 px `control`, `ink-1` label | `surface-2` fill, border `ink-3` | ring `accent` | translateY 1 px, `surface-3` | border `line`, label `ink-4` | spinner, label kept | — |
| **Quiet** (toolbar, card secondary) | `surface-2` fill, 1 px `control` | `surface-3`, border `accent` | ring `accent` | translateY 1 px | as secondary | spinner | — |
| **Ghost / link-button** | no border, `ink-2` | `ink-1` + `surface-2` | ring `accent` | translateY 1 px | `ink-4` | — | — |
| **Danger** (admin: otkaži, obriši) | transparent, 1 px `danger`, `danger` label (paper: `danger` on white) | `danger-subtle` fill | ring `accent-text` | translateY 1 px | as secondary | spinner | confirmation dialog for irreversible actions |
| **Icon button** | 44 × 44 (dense 36), icon 20–24, `ink-2` | `ink-1` + `surface-2` | ring `accent` | translateY 1 px | `ink-4` | spinner | needs `aria-label` |
Paper theme: primary keeps the orange fill with `#121518` label; focus rings use `accent-text #B8470A`.

### 9.2 Inputs (text, search, number, textarea)
Anatomy: label (13 px 500 `ink-2`, always visible, above) → field (height 44, hero 56; `surface-2`; 1 px `control`; radius 2; text 16 px `ink-1`; placeholder `ink-3`; optional prefix icon 20 `ink-3` / suffix unit „kom.“, „RSD“) → help or error (13 px, `ink-3` / `danger`, linked with `aria-describedby`).
States: default · hover (border `ink-3`) · focus (border `accent` + 1 px inner ring `accent`, caret `accent`) · filled · disabled (`surface-1`, border `line`, text `ink-4`) · read-only (no border, `surface-1`) · error (border `danger`, message with `WarningCircle` 16 + text, `aria-invalid="true"`) · success only where a check is meaningful (PIB checksum ok: `CheckCircle` `success` + „PIB je ispravan“). Validation on blur, not on every keystroke; the form-level error summary receives focus on submit. `inputmode`/`autocomplete` always set (tel, email, `postal-code`, `organization`, `one-time-code`).
- Quantity stepper: [−] [ 2 ] [+] 44 px buttons, input 56 px wide tabular, min 1, max from stock (or 99 for „po porudžbini“), keyboard ↑/↓.
- Textarea: min 4 rows, character counter `ink-3` when a limit exists („142 / 1.000“).

### 9.3 Select and combobox
- Native `<select>` styled (chevron `CaretDown` 16) for short fixed lists (sort, delivery method in admin).
- ARIA 1.2 **Combobox** (own) for searchable lists: input + listbox popover (level 3 elevation, max-height 360, 40 px options, `aria-activedescendant`, ↑/↓/Enter/Escape/Home/End, type-ahead). Option anatomy: primary text, secondary `ink-3`, trailing meta (count or code in mono). States: open / closed / loading („Tražim…“ row with spinner) / empty („Nema rezultata za „1K0 615“" + link „Pošaljite upit“) / error („Pretraga trenutno ne radi — pokušajte ponovo“).

### 9.4 Vehicle picker
- Hero/catalog trigger is a **field-like control**, not an outline button (round 1: it looked like „Rasklopi“ and lost its priority): label „Vaše vozilo“ above; 52 px `surface-2` field with 1 px `control` border; `Car` icon 20 in `ink-2` (the field itself says it is yours; round 3 counted an orange icon here as decoration); vehicle name 15/600 `ink-1` (ellipsis); „Promeni ▾“ 14/500 `ink-3` (text visually hidden below 1280 px, caret stays); a separate 48 px clear button `X` („Ukloni izabrano vozilo“) behind a 1 px `line` divider. Empty state: „Izaberite vozilo“ + meta `marka, model, motor`.
- Header slot: chip `accent-subtle` bg, 1 px `accent` border, `Car` icon + „Golf VII · 2.0 TDI“ + `X` (44 px hit area).
- Panel: dialog on desktop (560 px, level 4) / bottom sheet on mobile (92 %). Four steps in one column with breadcrumbs of choices: **Marka** (5 text tiles, no logos: Volkswagen, Audi, Škoda, SEAT, Cupra) → **Model** (searchable list, popular first) → **Generacija** (rows „Golf VII · 2012–2020“ with VIN model code in mono `5G`) → **Motor** (rows „2.0 TDI · 110 kW / 150 KS · CRLB“, optional „Ne znam motor“ skips). Footer: „Ne nalazim svoje vozilo“ → `/upit` prefilled; „Sačuvaj vozilo“ (logged in). Keyboard: every list is a listbox; Backspace goes one step back.
- States: loading rows (skeleton 5 × 44), empty (no generations → inquiry), error, saved vehicles section at the top for logged-in users.

### 9.5 OEM search with hints (header + hero)
- Field as §9.2 with `MagnifyingGlass`; placeholder „Broj dela ili naziv“ (mobile) / „npr. 1K0 615 301 AA ili kočione pločice“ (≥ 768 px); submit „Pretraži“ (primary) in the hero, icon submit in the header.
- Suggestions (debounced 150 ms, level-3 popover, grouped with 11 px caps labels): **Tačno poklapanje** (code rows: OEM in `code` + product name + price + stock icon), **Kategorije** (glyph + name + count), **Proizvodi** (thumb 40 + name + maker + price), **Nedavne pretrage** (when empty, local only). Footer row: „Prikaži sve rezultate za „{q}“" (Enter). Normalisation hint under the hero field: „Broj upišite kako god ga imate — razmaci, tačke i crtice ne smetaju.“ Paste of multiple codes (mechanics) → „Prepoznato 3 broja — otvori brzu porudžbinu“.
- Without JS: a plain GET form to `/pretraga`.

### 9.6 Filters
- Desktop: left rail 280 px, sticky under the header, groups as accordions (open by default: Vozilo, Dostupnost, Proizvođač): checkbox rows 36 px with count `ink-3` tabular, „Prikaži još 12“ for long lists, price range as two number inputs (dinars) with a histogram-free slider-less UI. Quality: „Original VAG“, „OEM kvalitet“, „Aftermarket“ with a one-line explanation tooltip.
- Mobile: „Filteri (3)“ secondary button → bottom sheet 92 % with the same groups + sticky footer „Prikaži 48 rezultata“ (primary, live count) and „Poništi“.
- Applied chips row above results: `surface-2` chips 32 px with `X` (44 px hit area via padding), „Poništi sve“ link. Filters update the URL (`router.replace`, no scroll).
- States: counts loading (count → `…`), zero-result options disabled with count 0 and `ink-4`, error toast.

### 9.7 Product card
Anatomy (grid variant): thumbnail 4:3 (render/photo on a graphite radial ground, quality tag top-left 24 px outline chip) → body (padding 16, gap 6): maker (13 `ink-3`; on mobile „Brembo · OEM kvalitet“ because the chip is hidden) → name (`h4`, 2 lines max, the whole card is one link via the name's `::after`; the focus ring is drawn on that overlay so it outlines the **whole card**) → codes („OEM“ + `code` value; cross count „+ 4 zamenska“) → **fitment line** when a vehicle is chosen (`CheckCircle` `success` „Odgovara za Golf VII · 2.0 TDI“ / `Question` `warning` „Proverite oznaku motora“ / nothing when unknown) → stock line (§3.6) → „Zamena na stanju: 2 →“ link when the product is out of stock but cross-referenced products are in stock → footer rule → price block (§9.8, always with „sa PDV-om“) + action (quiet button 44 px: „U korpu“ / „Poruči“ for po porudžbini / „Obavesti me“ for out of stock). The button's accessible name includes the product („U korpu: Kočioni disk prednji, Ø 312 mm“).
List variant (mobile default, mechanic portal, search): 104 px thumbnail column + the same body; footer stacks the price and a **full-width labelled 44 px button** (round 1: icon-only buttons lost their names and made „Poruči“ and „U korpu“ look identical); card border `line-strong` for glare. Mechanic portal list rows add a compact quantity stepper before the button.
States: default · hover (border `line-strong`, render scale 1.03 inside its mask, 600 ms `sk.out`) · focus-visible (ring around the card) · added („Dodato“ 1.6 s) · loading skeleton (thumb block + 5 text bars + price bar, same heights) · out of stock (no dimming of the card — stock line says it; actions „Obavesti me“ + the alternatives link; the product page adds „Pošaljite upit“) · inactive product („Artikal više nije u ponudi“, link to alternatives) · price changed (live overlay flashes `accent-subtle` 400 ms).

### 9.8 Price block
| Variant | Layout |
|---|---|
| Retail (card) | `numeral-m` value + „RSD“ unit (Public Sans 600, 50 %) · „sa PDV-om“ 12 px `ink-3` |
| Mechanic (card) | „MP ~~4.290 RSD~~“ 12 px `ink-3` · „Vaša cena“ 12/600 `accent` · value `numeral-m` `accent` |
| Product page | `numeral-l`; mechanic: retail struck + „Vaša cena · rabat 15 %“ + value; below: stock + lead time, „Cena uključuje PDV 20 %“, delivery hint „Dostava 450 RSD, besplatno iznad 10.000 RSD“ (from settings) |
| Cart line | unit price `ink-3` × qty = line total `numeral-s` tabular right-aligned |
| Totals | rows: Međuzbir, Dostava, **Ukupno** (`numeral-l`), „U cenu je uračunat PDV 20 %: 2.165 RSD“ |
The Price component is a live value: skipped by the text reveal, `aria-live` only in the cart total.

### 9.9 Stock badge
Inline (default) or chip (`*-subtle` bg, 24 px, radius 2) — icon + word + optional quantity/lead time (§3.6). Quantity is shown only when ≤ 10 („Na stanju · 4 kom.“; above: „Na stanju“). Never colour-only; never hidden by the reveal.

### 9.10 Part panel (3D) — drawer / sheet
Desktop: right drawer 440 px (1280+: 480 px), no scrim (the car stays interactive), level 4 shadow, full height under the header. Mobile: bottom sheet (peek 42 % / full 92 %).
Anatomy: header (part glyph 24 + `display-m` category name + count „48 artikala“ + close `X` 44) → vehicle row (selected vehicle chip or „Izaberite vozilo za tačno poklapanje“) → list of compact product rows (thumb 56, maker, name 1 line, OEM `code`, stock icon + word, price, add icon button 44) → footer (sticky): „Svi delovi: Kočioni diskovi (48) →“ (link, full width) + „Pošaljite upit“ (secondary).
States: loading (6 skeleton rows), empty („Za ovu kategoriju trenutno nemamo delove na stanju.“ + inquiry CTA prefilled with the category), error (retry), vehicle mismatch notice (`warning` row „3 artikla ne odgovaraju izabranom vozilu — prikazani su na kraju“). Esc/close returns focus to the part list trigger or the canvas wrapper and the camera returns.

### 9.11 Cart drawer
Right drawer 420 px with scrim (desktop) / full-height sheet (mobile). Header „Korpa (3)“ + close; lines: thumb 64, name (2 lines), OEM `code`, stock notice when changed („Na stanju je još 1 kom.“ `warning`), stepper, line total, remove (`Trash` icon button with label „Ukloni {naziv}“); summary: Međuzbir, delivery hint „Još 2.110 RSD do besplatne dostave“ (plain text, no progress bar), primary „Nastavi na porudžbinu“, secondary „Nastavi kupovinu“. Empty: drawing-frame glyph + „Korpa je prazna.“ + „Pretražite po broju dela“ (focuses search).

### 9.12 Checkout stepper
Four steps: **1 Kontakt → 2 Dostava → 3 Plaćanje → 4 Pregled**. Desktop: horizontal list at the top of the form column (numbers `numeral-s`, labels 14 px), completed steps show `Check` and are links („Izmeni“), current step has the 2 px accent underline and `aria-current="step"`; right column (sticky) = order summary. Mobile: „Korak 2 od 4 · Dostava“ + thin 4-segment bar (current segment accent), summary collapsible at the top („Ukupno 18.470 RSD ▾“). Each step validates on „Dalje“; errors summarised at the top of the step with focus. Final button „Pošalji porudžbinu“ (primary, lg), with the payment reminder above it („Plaćate pouzećem kuriru pri preuzimanju.“).

### 9.13 Toasts
Bottom-centre on mobile (above the home indicator), bottom-right on desktop; 360 px, `surface-3`, 1 px `line-strong`, radius 4, icon (status colour) + text 14 px + optional action link + close. Types: success, info, warning, error (errors stay until closed). `role="status"` (polite) or `role="alert"` for errors. Max 3 stacked.

### 9.14 Dialogs
Radix Dialog: 480/640 px, `surface-3`, radius 6, level 4; title `h2` (20 px), body 16, footer right-aligned (secondary left, primary right; destructive = danger button with an explicit verb „Otkaži porudžbinu“). Typed confirmation for irreversible owner actions („OBRIŠI DEMO“). Esc and scrim close unless a destructive action is in progress. Focus trap, return focus. Mobile: dialogs become bottom sheets except confirmations (centred, 92 % width).

### 9.15 Admin data table (paper)
Toolbar: segmented status filter (tabs with counts, `nowrap`, horizontally scrollable on narrow widths), search (260 px, `/` shortcut), filter popover, column visibility, density toggle, export („Izvoz za Excel“ — CSV with BOM and `;`). Table: header 36 px `surface-2` caps labels 11 px, sticky; rows 48 px (compact 36), 1 px `line-faint` dividers, no zebra; hover `surface-2`; selected = neutral `selected #EEF1F4` + checked checkbox (never the accent tint, which marks „Nova“); numbers right-aligned tabular; order numbers `code` 12.5 px **400** with the prefix `SK-2026-` in `ink-3` and the sequence in `ink-1` (round 1: the number outweighed the customer); dates compact „29.09. 11:42“ (year shown when it is not the current year); „Plaćanje · dostava“ as one two-line column; status chips (§3.6) with icon and compact labels („Za preuzimanje“); a 32 px row-actions button (`DotsThree`, „Radnje za SK-2026-000187“: Štampaj predračun, Otpremnica, Otvori); first column (checkbox + number) sticky when scrolling horizontally. Cells use 8 px side padding; „Izvor“ shows at ≥ 1440 px (the order detail always shows attribution); the row-actions column is sticky on the right; between 1024 and 1365 px the sidebar collapses to a 64 px icon rail (labels visually hidden, counts as small badges). With these rules the orders list fits 1280, 1366 and 1440 px without horizontal scrolling (measured: 0 px overflow in `/lab/koncept`, round 4); below 1024 the table scrolls inside its wrapper and the workspace column is `minmax(0, 1fr)` so nothing is clipped. Dark sidebar keeps the night focus ring (`accent`, 6.74:1); the paper workspace uses `accent-text`. Keyboard: ↑/↓ move row focus, Enter opens, Space selects, Shift+click range. Bulk bar replaces the toolbar when rows are selected („3 izabrane · Potvrdi · Štampaj otpremnice · Poništi izbor“). Footer: „1–25 od 187“ + pagination. States: loading (skeleton rows keep column widths), empty per filter („Nema novih porudžbina.“), error banner with retry, stale data notice when a live update arrives while editing.

### 9.16 Tabs
Underline tabs (storefront product page: Opis, Kompatibilnost, Brojevi, Isporuka): 44 px, 15 px 500 `ink-2`, active `ink-1` + 2 px accent underline; overflow scrolls horizontally with edge fade. Segmented tabs (admin filters) as §9.15. Radix Tabs, arrow-key navigation, `aria-controls`.

### 9.17 Pagination
Storefront: „Prethodna“ / „Sledeća“ buttons + page numbers (1 … 4 5 **6** 7 … 12), current page `accent` underline, 44 px targets; `?strana=n` links (crawlable). Mobile: prev/next + „Strana 6 od 12“. Admin: compact with page size select (25/50/100).

### 9.18 Breadcrumbs
`Početna / Delovi / Kočnice / Kočioni diskovi` — 13 px `ink-3`, separators `/` in `ink-4`, current page `ink-1` not linked, `aria-label="Putanja"`; mobile shows the parent only („← Kočnice“). JSON-LD BreadcrumbList mirrors it.

### 9.19 Empty states
Drawing frame (corner ticks, 240 × 160 max), part glyph 32–48 `ink-3`, one sentence `ink-2`, one action. Zero search results: echo the normalised query in mono, „Tražili smo {q} u OEM, zamenskim i kataloškim brojevima.“ + „Pošaljite upit — javljamo se u toku radnog dana.“ (primary) + „Pozovite nas“ when the phone exists in settings.

### 9.20 Skeletons
Same geometry as the final layout (no CLS), `surface-2` blocks radius 2, text bars at 60–90 % widths, shimmer per §8.5, `aria-busy="true"` on the region + visually-hidden „Učitava se…“.

### 9.21 Notification bell (admin, mechanic/account)
Icon button `Bell` 44 with count badge (accent, `radius-full`, tabular, „9+“ above 9); popover 380 px level 3: header „Obaveštenja“ + „Označi sve kao pročitano“; rows 56 px: type glyph, title („Nova porudžbina SK-2026-000187“), meta („pre 3 min · Nikola Stanković“), unread dot `accent` 8 px; realtime insert animates with the list stagger (≤ 220 ms); empty „Nema novih obaveštenja.“; link „Sva obaveštenja“. `aria-live="polite"` announces new items once.

### 9.22 Also specified (built in step 04)
Checkbox 20 px (hit area 44 via label), radio 20 px, switch 44 × 24 (on = accent track, `on-accent` knob), badge/chip, tooltip (surface-3, 12 px, 400 ms delay, never the only way to learn something), copy button (`Copy` → `Check`), `Kbd` (mono 12 px, 1 px `control`), spinner (16/20 px, 2 px stroke `ink-2`, 800 ms linear rotation — the only loop), skip link („Preskoči na sadržaj“, appears top-left on focus, z 100).

---

## 10. Page blueprints (annotated wireframes; desktop 1440 unless noted)

Legend: `[ ]` control · `( )` chip · `▣` render/image · `≡` list · `—` hairline · `[mark]` brand mark · `→` link. Mobile notes follow each blueprint.

### 10.1 Home `/`
```
┌─ header 64 ─ [mark] SKLOP  Delovi  Vozila  Za majstore  Upit po broju šasije     Pozovite  Viber  [nalog] [korpa 2] ┐
│ HERO (pinned, 320 vh track)                                                                                        │
│ RASKLOPI                      ← display-xl caps, 3 lines          ┌ callout (on hover/selection) ┐                    │
│ AUTO.                                                              │ Turbina (turbopunjač)        │   ┌ title block ──┐ │
│ NAĐI DEO.                                                          │ Pre zamene proverite broj…   │   │ Prikaz: gener.│ │
│ Delovi za VW, Audi, Škoda, SEAT i Cupra — po OEM broju, vozilu…    │ 12 artikala za Golf VII →    │   │ Faza 00 / 07  │ │
│ Broj dela ili naziv                                                └──────────────┬───────────────┘   │ Kat. 44 · mm  │ │
│ [search: npr. 1K0 615 301 AA              ][ Pretraži ]                           │ leader            └───────────────┘ │
│ Broj upišite kako god ga imate — razmaci, tačke i crtice ne smetaju.   ▣ X-ray car (poster → 3D), cols 6–12,          │
│ Vaše vozilo                                                             bottom-aligned; ruler floor; 4280 / 2620 / 1450 │
│ [car VW Golf VII 2.0 TDI (CRLB)          Promeni v | x ]                                                               │
│ Nemate broj? Pošaljite broj šasije                                                                                     │
│ ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
│ 00 Sklopljeno │ 01 Karoserija i svetla │ 02 Točkovi │ 03 Kočnice i vešanje │ … │ 07 Izduvni   [Rasklopi] [Lista delova] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Grid areas (proven in `/lab/koncept`, rounds 3–4): ≥ 1024 px `copy` (statement + search) and `aside` (vehicle + VIN link) on columns 1–5, `stage` on columns 6–12 spanning both rows, bottom-aligned, with a callout lane above the object and the title block on the stage frame's top-right (≥ 1440 px); `strip` (stage index + Rasklopi/Lista delova) full width. Content capped at 1440 px (`--pad`), the 3D canvas itself stays full-bleed behind.
Header contact: „Pozovite“ / „Viber“ as text links ≥ 1440 px, 44 px icon buttons with aria-labels below, Viber moves into the menu (and the bottom contact bar) below 640 px; the phone icon stays. The hero is `min(100dvh − header, 960px)` tall in static layouts (the 3D canvas itself stays full-bleed).
Mobile (< 1024 px): header 56 ([mark] SKLOP · phone · account · cart · menu); order **copy → aside → stage → strip** (round 3: „fits my car?“ must stay above the fold): statement 3 lines (36 px) → search full width (52 px) → vehicle field → VIN link → poster 4:5 with ruler and the honesty line (nothing selected at rest on phones — no callout lane; a tap selects) → compact stage row `00 / 07 Sklopljeno` + [Rasklopi] [Lista delova] → sections stacked; category grid 2 columns; sticky bottom contact bar on scroll-up only (Pozovite · Viber · Upit), 56 px.

### 10.2 Category `/delovi/[kategorija]`
```
 Početna / Delovi / Kočnice / Kočioni diskovi
 KOČIONI DISKOVI  (display-l caps)                                   (VW Golf VII 2.0 TDI ×) [Promeni vozilo]
 SEO intro 2 lines (lead, max 72ch) … „Više“ expands
 ┌ filters 280 ─────────┐  ┌ 48 artikala · sort [Popularno ▾] · (Na stanju ×) (Brembo ×) Poništi sve ───────────┐
 │ Vozilo  (set)         │  │ ▣card ▣card ▣card ▣card                                                              │
 │ Dostupnost [ ] na st.  │  │ ▣card ▣card ▣card ▣card        4 cols ≥ 1280, 3 at 1024, 2 at 768, list on mobile    │
 │ Proizvođač [ ] Brembo 12│  │ …                                                                                    │
 │ Kvalitet [ ] OEM …      │  │ [Prethodna] 1 … 4 5 [6] 7 … 12 [Sledeća]                                            │
 │ Cena  [ od ] [ do ]   │  └──────────────────────────────────────────────────────────────────────────────────────┘
 └───────────────────────┘  Related: „Povezano: Kočione pločice · Kočione čeljusti · ABS senzori“
```
System hub (`kind: system`): the system glyph + categories as a list with renders and counts. Mobile: title, vehicle chip, [Filteri (2)] [Sortiraj] row sticky under the header, list cards.

### 10.3 Product `/deo/[slug]`
```
 Početna / Delovi / Kočnice / Kočioni diskovi
 ┌ gallery 7 cols ─────────────────────┐ ┌ buy box 5 cols (sticky) ────────────────────────────────┐
 │ ▣ main (render/photo), thumbs below │ │ Brembo · OEM kvalitet                                     │
 │ spec drawing: Ø 312 × 25 mm with    │ │ Kočioni disk prednji, Ø 312 mm, ventilirani   (h1)        │
 │ dimension lines (ornament, real)    │ │ OEM 5Q0 615 301 F [⧉]  · Šifra DEMO-10231                  │
 └─────────────────────────────────────┘ │ (ok) Odgovara za Golf VII 2.0 TDI (CRLB)                     │
                                         │ 6.990 RSD  sa PDV-om  (mechanic: MP ~~ ~~ Vaša cena …)    │
                                         │ ■ Na stanju · 4 kom. · isporuka 1–2 radna dana            │
                                         │ [− 1 +] [ Dodaj u korpu ]                                  │
                                         │ [Pošaljite upit]  Pozovite · Viber · WhatsApp              │
                                         │ Dostava 450 RSD, besplatno iznad 10.000 RSD · Pouzeće …    │
                                         └───────────────────────────────────────────────────────────┘
 Tabs: Kompatibilnost (table: marka, model, generacija, motor, godine) · Brojevi (OEM + zamenski, copy all) ·
       Specifikacije (key/value, mono for measurements) · Isporuka i povrat
 Povezani delovi (row of 4 cards) · „Isti deo, drugi proizvođači“ (list with price/stock)
```
Mobile: gallery full width 4:3 → name → codes → fitment → price + stock → sticky bottom buy bar (qty + „Dodaj u korpu“, 64 px, appears after the inline button scrolls out) → tabs as accordions.

### 10.4 Search `/pretraga?q=`
```
 [search: 1K0615301AA                              ][Pretraži]   Tražili smo: 1K0 615 301 AA (normalizovano)
 TAČNO POKLAPANJE (code rows first): OEM 1K0 615 301 AA → 3 proizvoda (list rows with price/stock)
 ZAMENSKI BROJEVI → rows · KATEGORIJE → chips · PROIZVODI → cards grid
 Zero results: drawing-frame empty state + [Pošaljite upit] prefilled with q + vehicle
```

### 10.5 Cart `/korpa` and checkout `/porudzbina`
```
 KORPA: lines table (thumb, name + OEM, stock notice, stepper, line total, remove) │ summary (sticky): Međuzbir,
        Dostava (od 0 RSD), Ukupno, [Nastavi na porudžbinu], payment note „Bez plaćanja karticom na sajtu.“
 CHECKOUT: stepper 1–4 on top of the form column (8 cols) │ order summary (4 cols, sticky, collapsible on mobile)
   1 Kontakt: ime i prezime, telefon, e-mail, [ ] Kupujem kao firma → naziv, PIB (checksum), MB, adresa
   2 Dostava: (•) Lično preuzimanje — adresa + radno vreme │ ( ) Kurir pouzećem 450 RSD — adresa, grad, poštanski br.
   3 Plaćanje: (•) Pouzeće ( ) Gotovina/kartica pri preuzimanju ( ) Virman uz predračun (firme) ( ) Odloženo (majstori)
   4 Pregled: lines, delivery, payment, VIN (optional), napomena, [ ] Prihvatam uslove → [Pošalji porudžbinu]
```

### 10.6 Order status `/porudzbina/[token]`
```
 PORUDŽBINA SK-2026-000187  (code-l)           status chip „Potvrđena“
 Timeline (vertical, left rail 1 px line; nodes 12 px; done = success, current = accent ring, future = line):
   ● Primljena 29.09.2026. 11:42 → ● Potvrđena 11:58 → ◎ Poslata (čeka) → ○ Isporučena
 Blocks: Stavke · Dostava (tracking link when set) · Plaćanje (predračun link for virman) · Kontakt (Pozovite, Viber)
```

### 10.7 VIN inquiry `/upit`
```
 NE NALAZITE DEO?  (display-l)   lead: „Pošaljite broj šasije i šta vam treba — javljamo se sa ponudom.“
 Form (8 cols):  VIN [ WVWZZZAUZHW000000 ] (mono input, 17 chars counter, live decode: „Volkswagen · model 2017?“)
                 Marka / model / godina (prefilled, editable) · Šta vam treba? (textarea + category chips)
                 Fotografije (do 5) drop zone with thumbnails · Kontakt · Kako da vam odgovorimo? (•) Telefon ( ) Viber …
                 [Pošalji upit]
 Aside (4 cols): „Gde je broj šasije?“ — drawing of the windscreen corner + registration document field E, no photos
```

### 10.8 `/za-majstore`
```
 Hero split: ZA MAJSTORE (display-xl) + lead + [Registrujte servis] │ price comparison card: MP vs „Vaša cena“ per tier
 Nivoi rabata: table (Majstor 10 %, Majstor Plus 15 %, Partner 20 % — from settings) · Brza porudžbina demo ·
 Kako funkcioniše odobrenje (3 real steps) · FAQ · Contact strip
```

### 10.9 Mechanic dashboard `/majstor`
```
 Status banner (pending: warning chip „Nalog čeka odobrenje — obično u toku radnog dana“)
 BRZA PORUDŽBINA (sticky box): textarea „Nalepite brojeve, jedan po redu: 1K0615301AA 2“
   → parsed rows: [tačno] name, stock, price, qty │ [više opcija] choose maker/quality │ [nije pronađeno] → „Pošalji upit (3)“
   [Dodaj sve u korpu]
 Tiles as links (not metric cards): Porudžbine (last 5 rows) · Omiljeno · Vozila mušterija (VIN, tablice) · Cenovnik (XLSX)
```

### 10.10 Admin shell and dashboard `/admin`
```
┌ sidebar 232 (night) ┐┌ top bar 56 (paper): breadcrumb · ⌘K search · [bell 3] · user ────────────────────────────┐
│ [mark] SKLOP ADMIN   ││ PREGLED — danas 29.09.2026.                                                             │
│ Pregled              ││ KPI row (links, not boxes): Porudžbine danas 7 · Vrednost 86.420 RSD · Upiti bez odgovora│
│ Porudžbine       4   ││   2 (najstariji 2 h 14 min, SLA) · Majstori na čekanju 1 · Malo na stanju 12            │
│ Upiti            2   ││ ┌ Porudžbine po danima (30 d, bars, today accent) ┐ ┌ Traženo, a nemamo (top 10 queries) ┐│
│ Proizvodi            ││ └─────────────────────────────────────────────────┘ └────────────────────────────────────┘│
│ Uvoz iz Excela       ││ ┌ Red čekanja (SLA): upiti i porudžbine bez odgovora ┐ ┌ Aktivnost (audit, last 20) ────────┐│
│ Kategorije · Vozila  ││ └───────────────────────────────────────────────────┘ └────────────────────────────────────┘│
│ Lager · Kupci        │└───────────────────────────────────────────────────────────────────────────────────────┘
│ Majstori · Podešav.  │  KPI figures: numeral-xl (40 px) + 13 px label, separated by 1 px rules (no cards)
└──────────────────────┘
```

### 10.11 Admin orders `/admin/porudzbine` and detail
List per §9.15 (proven in `/lab/koncept`). Detail: header (number mono, status chip, primary transition button „Potvrdi“ + menu of allowed transitions, „Štampaj predračun/otpremnicu“) → two columns: left (Stavke table editable while `nova`, Napomene, Istorija/timeline, E-mail log), right (Kupac, Firma, Dostava + tracking, Plaćanje + „Označi kao plaćeno“, Izvor: utm/gclid/fbclid/landing, Interne beleške).

### 10.12 Admin products `/admin/proizvodi` and editor
List: DataTable with thumbnail 40, name, SKU, OEM, category, maker, stock (inline editable number), price, status, updated; bulk actions. Editor (two columns, sticky save bar „Sačuvaj“ / „Odbaci izmene“ when dirty): Osnovno · Cene (MP, nabavna — staff only, marža preview) · Stanje (qty, prag, rok) · Brojevi (OEM/zamenski with live normalisation preview in mono) · Kompatibilnost (fitment editor rows) · Slike (drag-drop, reorder) · SEO (title/description with snippet preview) · Istorija.

### 10.13 Admin import `/admin/uvoz`
```
 Stepper: 1 Fajl → 2 Mapiranje kolona → 3 Provera → 4 Uvoz
 1 Drop zone (xlsx, xls, csv; Windows-1250 ok) + [Preuzmi šablon] · mode (•) Sve kolone ( ) Samo stanje i cene
 2 Two-column mapping: source column (sample values in mono) → target field select; auto-mapped rows marked „auto“;
   [Sačuvaj kao šablon mapiranja]
 3 Summary chips: 412 novo · 1.230 izmena · 18 preskočeno · 7 grešaka (danger) · 22 upozorenja (warning);
   table filtered by type with per-row messages; [Preuzmi izveštaj o greškama]
 4 Progress (determinate bar, row counts, can leave the page) → result + [Poništi ovaj uvoz] (rollback, confirmation)
```

---

## 11. Voice and microcopy (Serbian, Latin, ekavian)

### 11.1 Guidelines
- Voice: an experienced mechanic talking to a colleague — calm, precise, short sentences, no fluff. Address with „vi“ in lowercase („pošaljite“, „izaberite“). No exclamation marks, no emojis, no „Super!“, „Wow“, „Hej“.
- Say what happens and what to do next. Name the object („Pošalji porudžbinu“, not „Pošalji“; „Dodaj u korpu“, not „Kupi odmah“).
- Mechanic vocabulary, not translated e-commerce: „deo/delovi“, „OEM broj“, „zamenski broj“, „na stanju“, „po porudžbini“, „pouzeće“, „lično preuzimanje“, „predračun“, „rabat“, „majstor“, „servis“, „broj šasije (VIN)“. Brand names as written by the brands (Škoda, SEAT, Cupra).
- Numbers do the talking: „Na stanju · 4 kom.“, „Isporuka 1–2 radna dana“, „Dostava 450 RSD, besplatno iznad 10.000 RSD“ — never „brza dostava“, „najbolje cene“.
- Errors: what went wrong + how to fix it + an escape hatch (call/Viber/inquiry). Never blame („Pogrešno ste uneli“).
- Ekavian always: deo, delovi, cena, uslovi, rešenje, vreme, mesto, primer, pretraga, uvek, dete — not dio, cijena, uvjeti.
- Correct diacritics always (č ć ž š đ); in URLs and codes ASCII slugs (`kocioni-diskovi`).
- Titles in sentence case; caps only via CSS.
- Never invent facts (years in business, reviews, „hiljade zadovoljnih kupaca“); company data only from settings, hidden when empty.

### 11.2 CTAs
| Context | Primary | Secondary |
|---|---|---|
| Hero search | Pretraži | Nemate broj? Pošaljite broj šasije |
| Vehicle | Izaberite vozilo | Ne nalazim svoje vozilo |
| 3D | Rasklopi / Sklopi | Lista delova |
| Card | U korpu | Poruči (po porudžbini) · Obavesti me (nema na stanju) · Zamena na stanju: 2 |
| Product | Dodaj u korpu | Pošaljite upit · Pozovite · Viber · WhatsApp |
| Cart | Nastavi na porudžbinu | Nastavi kupovinu |
| Checkout | Dalje · Nazad · Pošalji porudžbinu | Izmeni |
| Inquiry | Pošalji upit | Dodaj fotografiju |
| Quote | Prihvati ponudu | Odbij ponudu · Zatraži novu ponudu |
| Mechanics | Registrujte servis | Prijavite se |
| Quick order | Dodaj sve u korpu | Pošalji upit za nepronađene (3) |
| Admin | Potvrdi · Označi kao poslato · Sačuvaj · Pošalji ponudu | Odbaci izmene · Otkaži porudžbinu |

### 11.3 Empty states
| Where | Copy |
|---|---|
| Search, no results | „Za „{q}“ nemamo artikal u katalogu. Pošaljite upit — proverićemo kod dobavljača i javiti vam se u toku radnog dana." [Pošaljite upit] |
| Category with vehicle filter | „Za {vozilo} trenutno nemamo {kategorija} na stanju.“ [Pošaljite upit] · [Prikaži za sva vozila] |
| Part panel | „U ovoj kategoriji trenutno nema delova na stanju.“ [Pošaljite upit] |
| Cart | „Korpa je prazna.“ [Pretražite po broju dela] |
| Account orders | „Još nemate porudžbina.“ [Pretražite delove] |
| Favorites | „Ovde čuvate delove koje često poručujete.“ |
| Admin orders filter | „Nema porudžbina sa ovim statusom.“ |
| Admin „Traženo, a nemamo“ | „Nema neuspešnih pretraga u poslednjih 7 dana.“ |
| Notifications | „Nema novih obaveštenja.“ |

### 11.4 Errors and validation
| Case | Copy |
|---|---|
| Required field | „Upišite {ime i prezime / broj telefona / e-mail}.“ |
| Phone | „Broj telefona nije ispravan. Primer: 064 123 4567.“ |
| E-mail | „E-mail adresa nije ispravna. Primer: ime@primer.rs.“ |
| PIB | „PIB ima 9 cifara i kontrolni broj ne odgovara. Proverite broj sa rešenja.“ |
| MB | „Matični broj ima 8 cifara.“ |
| VIN | „Broj šasije ima 17 znakova (bez slova I, O i Q).“ |
| Postal code | „Poštanski broj ima 5 cifara.“ |
| Stock changed | „Na stanju je još {n} kom. Količina je smanjena.“ |
| Price changed | „Cena je promenjena u međuvremenu. Proverite stavke pre slanja.“ |
| Rate limit | „Previše pokušaja. Pokušajte ponovo za nekoliko minuta ili nas pozovite.“ |
| Network | „Nema veze — pokušavamo ponovo.“ |
| Server | „Nešto nije u redu na našoj strani. Pokušajte ponovo; porudžbina nije poslata.“ |
| Upload | „Fotografija je prevelika ili nije JPG, PNG ili WebP. Najviše 8 MB po fotografiji.“ |
| Quote expired | „Ponuda je istekla {datum}.“ [Zatraži novu ponudu] |
| Admin concurrency | „Porudžbina je u međuvremenu izmenjena. Osvežite prikaz.“ |

### 11.5 Confirmations
| Event | Copy |
|---|---|
| Added to cart | „Dodato u korpu: {naziv}.“ [Pogledaj korpu] |
| OEM copied | „OEM broj kopiran.“ |
| Order sent (page H1 + lead) | „Porudžbina je primljena.“ / „Broj porudžbine je SK-2026-000187. Poslali smo potvrdu na {e-mail}; javićemo se kad je potvrdimo.“ |
| Inquiry sent | „Upit je primljen.“ / „Broj upita je UP-2026-000045. Odgovaramo u toku radnog dana.“ |
| Back in stock subscribed | „Javićemo vam na {e-mail} kad stigne.“ |
| Mechanic registration | „Registracija je primljena. Nalog odobravamo u toku radnog dana; stići će vam e-mail.“ |
| Saved (admin) | „Sačuvano.“ |
| Order transition (admin) | „Porudžbina SK-2026-000187 je potvrđena. Kupcu je poslat e-mail.“ |

### 11.6 E-mail subject lines (customer · staff)
| Event | Subject |
|---|---|
| order.created | „Porudžbina SK-2026-000187 je primljena“ · staff: „Nova porudžbina SK-2026-000187 — 18.470 RSD“ |
| order.confirmed | „Porudžbina SK-2026-000187 je potvrđena“ |
| ready for pickup | „Porudžbina SK-2026-000187 je spremna za preuzimanje“ |
| shipped | „Porudžbina SK-2026-000187 je poslata“ |
| delivered / picked up | „Porudžbina SK-2026-000187 je isporučena“ / „…je preuzeta“ |
| cancelled | „Porudžbina SK-2026-000187 je otkazana“ |
| inquiry received | „Upit UP-2026-000045 je primljen“ · staff: „Novi upit UP-2026-000045 — Golf VII, turbina“ |
| quote ready | „Ponuda za upit UP-2026-000045 je spremna“ |
| back in stock | „Stiglo je: {naziv}“ |
| mechanic received / approved / rejected | „Registracija servisa je primljena“ / „Nalog je odobren — Majstor Plus (15 %)“ / „Registracija nije odobrena“ |
| password reset | „Kod za novu lozinku“ |
| daily digest (staff) | „Pregled za 29.09.2026. — 7 porudžbina, 2 upita bez odgovora“ |
| low stock (staff) | „Malo na stanju: 12 artikala“ |

---

## 12. Accessibility rules and pre-merge design checklist

### 12.1 Rules (WCAG 2.2 AA + project specifics)
1. Contrast per §3.4 (text ≥ 4.5:1, large text/UI/focus ≥ 3:1); new colour pairs are added to `tokens.json` and pass `node scripts/design/contrast.mjs --check`.
2. Focus visible on everything interactive: 2 px ring, 2 px offset, never removed; focus not obscured by the sticky header (`scroll-padding-top: 80px`) or sheets (2.4.11).
3. Targets ≥ 24 × 24 px everywhere, ≥ 44 × 44 px for primary touch actions and all mobile controls, including inline links that act as actions (VIN link, „Zamena na stanju“) (2.5.8).
4. No information by colour alone (status icon + word; required fields marked with „(obavezno)“ text, not only an asterisk colour).
5. Keyboard: full use without a mouse; logical order; Esc closes overlays; focus returns to the trigger; no keyboard traps; drag interactions (sheet, image reorder) have button alternatives (2.5.7).
6. The 3D car has an equivalent: „Lista delova“ dialog + the SSR „Delovi po sistemima“ list; the canvas is `role="img"` with a Serbian label and is not a tab stop.
7. Forms: visible labels, `autocomplete`, inline errors linked with `aria-describedby`, an error summary that receives focus; no placeholder-only labels; accessible authentication (paste allowed, no cognitive tests — 3.3.8).
8. Language `lang="sr-Latn-RS"`; foreign brand names are fine; abbreviations expanded once (PIB — poreski identifikacioni broj).
9. Live regions only for meaningful updates (cart total, add-to-cart confirmation, toasts, new notifications) — never for prices on every tick.
10. Motion per §8.7; nothing flashes more than 3 times per second; no auto-playing loops except spinners.
11. Reflow at 320 CSS px without horizontal scroll (except data tables, which scroll inside their container with a sticky first column); text spacing overrides don't clip (1.4.12); zoom to 200 % keeps the layout usable.
12. Images: meaningful alt in Serbian; decorative `alt=""`; ornaments that duplicate text are `aria-hidden`.
13. Consistent help (3.2.6): the contact entry (Pozovite · Viber · Upit) is in the same place on every page (footer contact strip + mobile bottom bar).
14. Session and timing: no time limits on checkout; admin sessions warn before expiry.

### 12.2 Pre-merge design checklist (copy into PR descriptions)
- [ ] Uses tokens only (colours, type, spacing, radii, shadows, z-index, durations, eases) — no raw hex or ad-hoc px in components.
- [ ] Orange appears only for yours/next (primary action, selection, focus, active state, your price/vehicle); max one primary button per view region.
- [ ] Every status has icon + word; stock and fitment lines follow §3.6.
- [ ] Type roles from §4.3; display caps only for statements/short titles; mono only for codes and measurements; tabular figures on prices, quantities, tables.
- [ ] Serbian copy from §11 or `lib/i18n/sr`; ekavian; diacritics; formats `12.990 RSD`, `29.09.2026.`, `+381 64 123 4567`; no exclamation marks, emojis, invented facts or visible TODO.
- [ ] All states designed and built: default, hover, focus-visible, active, disabled, loading (skeleton matches layout), empty (with next action), error (with recovery).
- [ ] Screenshots at 390 and 1440 (plus 1024 for admin) reviewed; no horizontal overflow at 360; nothing clipped at 2560.
- [ ] Keyboard pass: tab order, visible focus everywhere, Esc/return focus for overlays.
- [ ] Contrast check for any new pair (`scripts/design/contrast.mjs`), axe scan: zero serious/critical.
- [ ] Motion: GSAP only via `useGSAP`; reduced motion path verified; no text entrance other than the site-wide reveal; above-the-fold copy uses `RevealText`.
- [ ] Performance: images through `next/image` with `sizes`; no new font files; no layout shift (CLS ≤ 0.05); 3D/heavy code lazy.
- [ ] Ornaments measure something real; ≤ 4 ornament types per viewport; none in forms, checkout, legal, e-mail.
- [ ] Browser surfaces themed (selection, caret, scrollbar, `color-scheme`).
- [ ] impeccable detector run on changed UI (`node .claude/skills/impeccable/scripts/detect.mjs --json <files>`) and findings addressed or justified.
