---
target: home 3D hero
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-13T00-34-18Z
slug: components-three-herosection-tsx
---
# Critique — home 3D hero (step 30)

Method: dual-agent (design review + detector/browser evidence) plus measurements. Full document: docs/3d/HERO-V2.md. Nielsen 27/40.

## 1. Critique of the current hero

Method: this repo's dev build on port 3210, Chromium with the real GPU (ANGLE D3D11), 1440×900 at DPR 1 (high tier) and 390×844 at DPR 2 (mid tier). Every stage was reached by real scrolling and by the `window.__sklop3d` hook, and captured. Numbers below are measured in the page or computed from the manifest cameras; nothing is estimated. Two independent passes ran beside it, as the impeccable critique playbook asks: a design review (Nielsen score **27 / 40**) and the detector (0 findings in `components/three`; the one in-page hit inside the hero is on the closed search dropdown, a false positive). axe reports 0 violations in the hero.

| | Desktop 1440×900 | Phone 390×844 |
|---|---|---|
| Sticky frame | 1440 × 824 px | 390 × 720 px (stage box 390 × 488) |
| Scroll distance of the explode | 2880 px (320vh) | 1688 px (200vh) |
| Largest instance of a category on screen, end state — median | 91 px | 45 px |
| Categories under 44 px | 6 of 42 | 19 of 42 |
| Smallest | 25 px (kočione pločice) | 12 px (kočione pločice) |
| Tab stops in the hero | 14 | 16 |
| Categories in the accessibility tree | 0 of 44 | 0 of 44 |
| Stage changes announced | 0 | 0 |

![End of the explode at 1440](../../docs/3d/hero-v2/current/desktop-9-end.webp)

### 1.1 Visibility of the parts

- **The end state is a dark cluster, not an exploded view.** At 1440 px 14 of 42 categories are under 64 px; on a phone 19 are under the 44 px touch minimum and 8 are under 24 px (brake pads 12, EGR valve 13, wheel bearing 16, ABS sensors 18). [`desktop-9-end`](../../docs/3d/hero-v2/current/desktop-9-end.webp), [`mobile-9-end`](../../docs/3d/hero-v2/current/mobile-9-end.webp).
- **Dark parts on a dark field.** Engine, radiator, battery and tyres render near black on `#0D0F11`. The ghost shell stays in front of them for the whole scroll.
- **Body panels are the weakest parts.** Hood, doors, bumpers, fenders and glass are ghost glass at 10–22 % alpha; once they move off the car they are an outline at best.
- **The camera pulls back as the car comes apart**, so parts shrink exactly when they become separate: the median size drops from 132 px (assembled) to 91 px (exploded) on desktop, and from 78 px to 45 px on a phone.
- **Parts have no names until hover or tap**, and only one name shows at a time.
- **What works:** a selected part. The focus glide isolates it at a readable size with its name and the panel beside it ([`mobile-selected`](../../docs/3d/hero-v2/current/mobile-selected.webp)). v2 keeps this.

### 1.2 Legibility

- Contrast is not the problem: every text in the hero measures 6.6:1 or better.
- The smallest text is 11 px mono caps (stage counts „03 · 9 KATEGORIJA · 31 DEO“, title-block keys).
- Below 1280 px, on phones and with the drawer open, the stage index is bare numerals 00–07.
- The hover callout covers the title block ([`desktop-hover`](../../docs/3d/hero-v2/current/desktop-hover.webp)).
- On phones the stage caption sits over the moving car.
- Counts disagree: the caption says „42 kategorije“, the title block „44“, the callout counts „artikla“ and the caption counts „delova“ (meshes).

### 1.3 Focus and keyboard

- Focus is visible on every stop and returns correctly from the dialog and the panel.
- **No part can be reached from the keyboard.** The only path is „Lista delova“, the 14th tab stop of the hero, behind eight stage buttons; the dialog then has 44 more stops and no filter.
- A click that misses a part clears the selection (`components/three/canvas/usePointerPicking.ts:79`).

### 1.4 Screen reader

- The stage is one `role="img"` with one sentence. Its 44 categories exist only inside the dialog.
- The live region says „Učitava se 3D prikaz“ and nothing after: not when the model is ready, not when a stage changes (log of the whole walk: empty).
- Stage buttons have an `aria-label` that differs from the visible label (`StageStrip.tsx:110` and `:134`, WCAG 2.5.3).
- No skip link past the hero.
- Under reduced motion the phone caption still says „Skrolujte…“ although there is no track.

### 1.5 Scroll length

- The hero is 3704 px of a 11 987 px page on desktop: 31 % of the home page before the first section heading.
- Scroll is not spent where the content is. In 100 px wheel notches: stage 3 (31 parts, 9 categories) gets 4 notches, stage 7 with its hold (4 parts) gets 7. The last 8 % is a hold.
- On a phone, 300 px swipes cross the track in 10 swipes, and **stages 2 and 6 are never the current stage at any stop** — the grouped mobile windows pass inside one swipe.
- Desktop never says that scrolling takes the car apart; „Kliknite na deo“ appears only at 92 %.

### 1.6 Mobile

- First screen: the copy comes first, so 344 of the stage's 488 px are visible; on a first visit the cookie banner covers that part too ([`mobile-0-first-visit`](../../docs/3d/hero-v2/current/mobile-0-first-visit.webp)).
- Picking is an exact raycast on parts that are 12–45 px; there is no touch preview.
- Two indices for the same thing: eight numerals (45 × 44 px each) and a previous/next stepper, 12 controls in the frame above the four-item bottom bar.
- Low tier and loading: the exploded poster still says „Kliknite na deo“ over a picture that cannot be clicked ([`desktop-low-end`](../../docs/3d/hero-v2/current/desktop-low-end.webp)).

### 1.7 Found outside the hero (not fixed here)

Dismissing the cookie banner with „Odbij sve“ scrolls the page to the very bottom (desktop: scrollY 0 → 11 087, the maximum; phone the same), with focus on `<main>`. Reproduced with a raw pointer click and a raw touch on the dev build; not checked on a production build. `ConsentBanner.tsx:138` already passes `preventScroll: true`, so the cause is elsewhere. A first-time visitor who declines cookies lands on the footer.
