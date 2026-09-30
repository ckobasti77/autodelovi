# perf-bundle — static bundle and asset analysis (step 21 audit)

Build `9b4K278NWK6BGwhVv5UCP` (`.next`, 2026-09-30 15:30, NEXT_PUBLIC_TEST_HOOKS=1), served by `next start` on :3100.
Nothing was rebuilt. HTML was fetched one request at a time; sizes come from `.next/static` (gzip level 6 = what
`next start` sends, brotli q11 for reference). Scripts: `scripts/qa/audit/perf-bundle-*.mjs`. Raw data: the
`*.json` / `*.txt` files in this folder.

## 1. First load per template (before any interaction)

Module scripts only. The 38.7 KB gz `noModule` polyfill chunk (`0cz1d0mv5g_q7.js`) is listed in every page but
modern browsers never download it. `41cvzcmlkfz4o.js` (2 KB) is also preloaded with `fetchpriority=low`.

| Template | Route | HTML wire (gzip) / raw | inline RSC | Module JS scripts | JS gzip | JS brotli | JS raw | CSS gzip | Font preloads |
|---|---|---|---|---|---|---|---|---|---|
| home | `/` | 33.3 / 243.6 KB | 136.9 KB | 24 | 329.1 KB | 287.4 KB | 1013.3 KB | 18.5 KB | 4 = 75.8 KB |
| delovi | `/delovi` | 26.0 / 259.5 KB | 137.0 KB | 23 | 313.3 KB | 273.6 KB | 962.5 KB | 18.5 KB | 4 = 75.8 KB |
| category | `/delovi/kocioni-diskovi` | 25.1 / 234.5 KB | 127.6 KB | 24 | 330.9 KB | 289.0 KB | 1014.9 KB | 18.5 KB | 4 = 75.8 KB |
| product | `/deo/kocioni-disk-prednji-276-24-mm-demo-0004` | 29.2 / 217.6 KB | 135.1 KB | 24 | 333.6 KB | 291.1 KB | 1024.0 KB | 18.5 KB | 4 = 75.8 KB |
| search | `/pretraga?q=disk` | 26.6 / 188.6 KB | 108.4 KB | 24 | 324.7 KB | 283.5 KB | 994.7 KB | 18.5 KB | 4 = 75.8 KB |
| generation | `/vozila/volkswagen/golf/golf-7` | 28.9 / 322.3 KB | 167.3 KB | 24 | 324.7 KB | 283.5 KB | 994.4 KB | 18.5 KB | 4 = 75.8 KB |
| landing (ads) | `/ponuda/kocione-plocice-golf` | 20.1 / 163.4 KB | 105.0 KB | 24 | **340.2 KB** | 296.7 KB | 1046.4 KB | 18.5 KB | 4 = 75.8 KB |
| za-majstore | `/za-majstore` | 21.2 / 133.8 KB | 89.5 KB | 23 | 316.3 KB | 276.4 KB | 970.4 KB | 18.5 KB | 4 = 75.8 KB |
| upit | `/upit` | 24.6 / 144.4 KB | 94.5 KB | 24 | **428.7 KB** | 368.7 KB | 1427.4 KB | 18.5 KB | 4 = 75.8 KB |
| korpa | `/korpa` | 13.3 / 88.4 KB | 62.8 KB | 24 | 321.3 KB | 280.8 KB | 986.0 KB | 18.5 KB | 4 = 75.8 KB |
| porudzbina | `/porudzbina` | 13.9 / 90.0 KB | 64.6 KB | 24 | **429.9 KB** | 369.8 KB | 1433.3 KB | 18.5 KB | 4 = 75.8 KB |
| prijava | `/prijava` | 14.0 / 92.6 KB | 65.2 KB | 23 | 308.7 KB | 269.5 KB | 949.9 KB | 18.5 KB | 4 = 75.8 KB |

- 18 scripts are shared by all 12 templates: **261.3 KB gz** of module JS (300.0 KB incl. the nomodule polyfill).
- Render-blocking: only `1ims1_lcdan5r.css` (98.8 KB raw, 18.5 KB gz). CSS coverage on home after a full scroll:
  83.9 of 96.5 KB used (87 %) at 390 and 1440 — the stylesheet is lean; no finding.
- JS coverage on home at 390 after load + 10 s idle: 566.6 of 1021.8 KB raw executed-so-far script bytes unused (55 %).
- After load, without interaction: phones fetch one lazy chunk (vehicle picker, 3 KB gz) and RSC prefetches
  (7 on home, 13 on category, ≈ 8–15 KB); desktop (fine pointer) starts the 3D 4 s after `load` by design (D105).
- HTML: gzip on the fly, `Cache-Control: private, no-cache, no-store` (every page is dynamic — expected, see
  CLAUDE.md). The inline RSC payload is 56–63 % of every document (Tailwind class strings repeated in HTML and RSC).

## 2. What is in the shared shell (home, KB gzip, measured per module)

| Group | Chunk(s) | gzip | Needed at first paint? |
|---|---|---|---|
| react-dom + Next runtime/polyfill module | `0qy3sss5e6eww` 71.6, `11we8zj_qz5aa` 8.4, `2h84ksv1mg5s9` 7.9, turbopack 4.2, `3fntmmi971322` 3.6 | ≈ 96 | yes |
| Next app router | `0qimmyhv2_bjj` | 34.0 | yes |
| GSAP core + ScrollTrigger + ScrollToPlugin + CustomEase + motion constants | `1tr6a7zmh41cy` | 48.4 | core yes (text reveal); plugins only home (**perf-bundle-03**) |
| Convex client (+ auth provider 2.7) | `2jrozipxybei4` 22.1 + part of `0rklqt_vfe3_n` | ≈ 25 | cart badge / viewer; kept (architecture) |
| radix Tooltip + Popper/floating-ui (root `Providers`) | `14y-81z8a-w-u` 10.2 + part of `25dplrt_qw3he` | 13.2 | no — storefront renders no tooltip (**perf-bundle-02**) |
| Sheet/Dialog stack (RemoveScroll, FocusScope, DismissableLayer, Presence, Portal, aria-hidden) | `1t0q0ok8maumv`, `2vm060vmiv-df` | 13.4 | no — on intent (**perf-bundle-04**) |
| radix Toast (Toaster) | `0rklqt_vfe3_n` | 5.5 | no — first toast (**perf-bundle-04**) |
| Consent banner + Switch (also when the cookie exists) | `0sgvhbpe5nb6s`, `120epkn8j_rkq` | 5.3 | only on first visit (**perf-bundle-04**) |
| MobileNav / HeaderSearch / SearchBox / Combobox | `2g3bv_p29okud` | 6.1 | trigger buttons yes, sheets no |
| Phosphor icons in client components (23 icons, 6 weights each) | spread | 56.5 KB raw ≈ 15–20 gz | 1 weight of each (**perf-bundle-05**) |
| Analytics manager + attribution | `0sgvhbpe5nb6s` | 4.2 | attribution capture yes; adapters after consent |
| Text reveal | `25dplrt_qw3he` | ≈ 3.4 | yes |
| Root error / global-error boundaries (+ 14 duplicated modules) | `1adhcvv0smcza` 8.6, `2f8qbt33jjpy3` 2.7 | 11.3 | Next loads them eagerly (**perf-bundle-09**) |
| Home only: HeroStage orchestrator, tier probe, taxonomy, next/image | `0wnn3uk7fx3z2` | 21.0 | yes (no three.js inside) |

Library signatures (`signatures.txt`): **nothing from three / @react-three / meshopt / three-mesh-bvh is in any
first-load chunk** ✓; **Draggable + InertiaPlugin are behind `e.A()` dynamic imports** (D113) ✓; zod +
react-hook-form only on `/upit`, `/porudzbina`, `/za-majstore/registracija`; zustand 5 small; TanStack Table and
SheetJS only in admin chunks; no public source maps (one 53-byte stub).

Deferrable in the shell, sum of distinct root causes: Tooltip/Popper 13.2 + GSAP plugins ≈ 22 + overlays/toast/
consent ≈ 24 + icon weights ≈ 12–16 + duplicated modules ≈ 8–12 → **≈ 80–85 KB gz of the 309–334 KB** module JS on
catalog-type pages, before touching React/Next/Convex.

## 3. 3D (lazy, D105)

| Asset | Size | Budget | |
|---|---|---|---|
| Canvas chunk `0i-5efvfrwjiv` (three core, all exports kept) + `3loc6izf4ows2` (WebGLRenderer, shaders, R3F, meshopt, manifest 10 KB gz) | 98.8 + 183.0 = **281.8 KB gz** | ≤ 350 KB gz | ✓ |
| three-mesh-bvh (fine pointer only) | 27.1 KB gz | lazy | ✓ |
| PartPanel / PartsList / HeroCallout chunks | 10.9 + 1.5 + 3.0 KB gz | lazy | ✓ |
| `car.glb` | 3553 KB raw, 2052 KB gzip on the wire; 290 k tris, 194 prims, 23 materials, 5 WebP textures (671 KB) | ≤ 6.5 MB target, 8 MB hard | ✓ |
| `car-lite.glb` | 2567 KB raw, 1648 KB gzip; 198 k tris, 135 prims, 21 materials, 5 textures (430 KB) | ≤ 3 MB | ✓ |
| `env/studio-512.hdr` | 401 KB, sent **uncompressed** (octet-stream) — 303 KB gzip possible | — | **perf-bundle-11** |
| Extensions | EXT_meshopt_compression, KHR_mesh_quantization, EXT_texture_webp (required), clearcoat, emissive_strength | meshopt | ✓ |

All normal maps are lossless WebP (VP8L): `tex_cast_n` 356 KB at 512² in both GLBs, `tex_tyre_n` 299 KB at 1024²
(**perf-bundle-10**).

## 4. Images and fonts

- Hero poster: `<picture>` with AVIF/WebP, 4:5 640/828/1080 below 768 px and 16:9 1080/1440/1920/2560 above;
  `<img width=2560 height=1440>`; `preload` + `fetchpriority=high` only at ≥ 48 rem (D98) ✓. 390 → 640 AVIF 11 KB,
  1440 → 1440 AVIF 16 KB.
- Part thumbnails (768² WebP masters, 48 files, 1.7 MB) go through `next/image` (AVIF, `max-age=14400`), `fill`
  inside aspect boxes, lazy except the first two cards, first card preloaded with matching `imageSizes` ✓.
  List-layout cards on phones declare `sizes … 50vw` but render 104 px (**perf-bundle-12**).
- Fonts: 4 preloads in the `Link` header (condensed 600 16.3 KB, Archivo Expanded 700 16.4 KB, Public Sans
  latin 26.6 KB + latin-ext 18.4 KB) = 75.8 KB, within D29's 150 KB. First-viewport usage at 390 (`css-fonts.txt`):
  condensed 600 is painted only for prices on category/product, while the non-preloaded Archivo Expanded 600
  paints the H1 of category and the ads landing (**perf-bundle-08**). Martian Mono (preload off, D127) paints
  codes in the first viewport of home/category/product — accepted by D127.

## 5. Caching and compression (`headers-static.txt`, `headers-image.txt`)

| Resource | Cache-Control | Encoding |
|---|---|---|
| `/_next/static/**` (JS, CSS, fonts) | `public, max-age=31536000, immutable` ✓ | gzip ✓ |
| `/_next/image` | `public, max-age=14400, must-revalidate` ✓ | AVIF |
| HTML | `private, no-cache, no-store, max-age=0, must-revalidate` (dynamic) | gzip ✓ |
| `/images/**`, `/models/**` (posters, GLB 3.5 MB + 2.6 MB, HDR, manifest, shadows) | **`public, max-age=0`** | GLB/JSON gzip, HDR none (**perf-bundle-07**, **-11**) |
| `/icon.svg`, `/favicon.ico`, `/manifest.webmanifest`, `/robots.txt` | `public, max-age=0, must-revalidate` | — |
| `/sitemap.xml` | `s-maxage=3600, stale-while-revalidate=86400` ✓ | — |

## 6. GSAP performance checklist (gsap-performance skill, audit mode)

- Only transforms, opacity and filter are tweened (grep for width/height/top/left/margin/padding in tweens: none) ✓.
- `will-change` is set only by `TextRevealGlobal` on word spans while they animate and removed by `restoreWords` ✓;
  note that word mode animates `filter: blur()` on up to 60 promoted spans per element — a paint/memory cost to
  watch on low-end phones (runtime tracks own the measurement).
- Stagger is used instead of per-word tweens ✓; ScrollTrigger refresh is coalesced (`requestScrollTriggerRefresh`) ✓.
- Bundle side: ScrollTrigger/ScrollToPlugin/CustomEase registered for every page (**perf-bundle-03**).

## 7. Findings

| Key | Sev | Title |
|---|---|---|
| perf-bundle-01 | P1 | `import { z } from "zod"` ships all of zod 4 (40+ locales, JSON Schema): +101 KB gz / 394 KB raw on checkout, VIN inquiry and mechanic registration |
| perf-bundle-02 | P2 | Root `Providers` mounts radix `Tooltip.Provider`: Tooltip + Popper/floating-ui (13.2 KB gz) on every storefront page that never shows a tooltip |
| perf-bundle-03 | P2 | ScrollTrigger + ScrollToPlugin + CustomEase registered globally: ≈ 22 KB gz on every page, used only by the home hero |
| perf-bundle-04 | P2 | Overlay code eager in the shell: Sheet/Dialog stack, Toaster, consent banner (also after consent), header sheets ≈ 24–30 KB gz |
| perf-bundle-05 | P2 | Phosphor icons in client components ship all six weights (23 icons, 56.5 KB raw on home) — D30 intends regular only |
| perf-bundle-06 | P2 | Root `app/not-found.tsx` renders the full SiteShell: +32 KB gz shop-header JS on the ads landing and a second serialized header/footer in every page's RSC |
| perf-bundle-07 | P2 | `public/` assets (hero posters, GLBs 6 MB, HDR, manifest) served with `max-age=0` |
| perf-bundle-08 | P2 | Font preloads do not match first-viewport use: condensed preloaded everywhere, Archivo Expanded 600 (category and ads-landing H1) not preloaded |
| perf-bundle-09 | P3 | 14 modules shipped twice in every page's first load via the root error boundary chunk (25.7–27.2 KB raw) |
| perf-bundle-10 | P3 | Lossless WebP normal maps: 356 KB `tex_cast_n` in the phone GLB (22 % of its gzip size) |
| perf-bundle-11 | P3 | `studio-512.hdr` (401 KB) sent without compression |
| perf-bundle-12 | P3 | Product-card `sizes` claims 50vw on phones while the list image is 104 px: DPR 3 phones fetch w=640 instead of w=384 |

Details, reproduction and fixes: see the structured result of this track.
