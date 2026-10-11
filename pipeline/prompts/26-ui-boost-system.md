<!-- META | Korak 26 | Opus 5.5 | effort: max | sesija: NOVA | mode: auto -->
# Step 26 — UI/UX ultra boost, part 1: the system

The owner wants the whole site to feel much more modern, polished and premium. In Serbian he called it "brutalno", which is slang for outstanding; it does not mean the brutalist style.
- **Part 1 (this step):** the design system, the shared components, the shell and the site-wide reveal animation system.
- **Part 2 (step 27):** apply them to every page.

## Read first
- `pipeline/BRIEF.md` §8–9
- `docs/design/DESIGN-SYSTEM.md`
- `docs/brand/LOGO.md`
- `docs/qa/AUDIT.md` (scorecards and items still open)
- `constants/motion.ts` and `constants/textRevealConfig.ts`
- `components/TextRevealGlobal.tsx` and `components/text-reveal/RevealText.tsx`
- `lib/gsap/*` and `components/ui/*`
- in `docs/DECISIONS.md`: D121 (content-visibility) and the performance decisions (PERF-0x)

## Skills (invoke by name)
impeccable (critique first, then polish), design-taste-frontend, ui-ux-pro-max, design-dna, motion-design, text-reveal, gsap-scrolltrigger, gsap-react, gsap-performance, apple-design (for craft details only, not its visual style).

## The owner's requirements (non-negotiable)

### 1. Soft corners everywhere: small, not big
No visible box anywhere may have sharp 90° corners. This covers the storefront, the mechanics portal, the admin, the e-mails and the 3D explorer UI, including:
- cards, buttons, inputs, selects, comboboxes, chips and badges;
- tables and their containers;
- images and thumbnails;
- dialogs, sheets, menus, tooltips and toasts;
- the 3D stage frame, skeletons, banners and alerts;
- focus rings, which follow the shape.

Use a small radius scale. A suggested starting point:

| Use | Radius |
|---|---|
| chips, badges, inner elements | 4 px |
| buttons, inputs | 6 px |
| cards, media | 8–10 px |
| large panels, sheets, dialogs only | 12–14 px |

- Nested corners are concentric: inner radius = outer radius − padding.
- Allowed exceptions: edges that meet the viewport (full-bleed sections) and hairline rules.
- Use a pill shape only for something that is semantically a pill.
- Finalise the scale with impeccable and document it. Today `--radius-xs/sm/md/lg` are 2/4/6/10 px, and the bare `rounded` class is used in about 275 places. Make sure every one of them maps to the new scale.

### 2. Staggered reveal animations across the whole site
These elements appear with a short, fast entrance when they come into view while scrolling down:
- every section and heading block;
- every card grid: products, categories, car models, brands;
- list rows, images, CTA blocks, form groups, footer columns;
- admin cards and tables, in a lighter version.

**Trigger rule (from the owner).**
- An element reveals when its **vertical centre** crosses the line **15 % of the viewport height above the bottom edge**. That is ScrollTrigger `start: "center 85%"`, or an equivalent IntersectionObserver construction.
- Elements taller than about 60 % of the viewport use their top instead (for example `top 80%`), so a tall block never sits hidden while it is on screen.
- Today the text reveal fires when the element's **top** passes the 15 % line (`enterRatio` 0.15, threshold 0). Move it to the same centre-based rule, so text and blocks feel like one system.
- Check the feel in a real browser at 390×844 and at 1440×900. The owner explicitly allowed moving the line higher, for example to 20–25 %, if at 15 % the animation happens too low on the screen to be noticed. Pick the value by looking, write down why, and use one constant everywhere.

**Stagger ("stepenasto").**
- Items that enter together appear one after another, quickly. For example: 450–600 ms each, 50–80 ms apart, capped so a whole batch finishes within about 700 ms.
- Items in the same grid batch together (ScrollTrigger.batch or an equivalent), so scrolling down a product grid reveals it row by row, card by card.

**Motion.**
- Animate transform and opacity only. A small blur is allowed on large screens, as the text reveal already does.
- Use the decisive eases from `constants/motion.ts` and the `--ease-sk-*` variables.
- Each element animates once. Nothing reverses when the user scrolls back up.

**One shared primitive.**
- Build a single component and attribute API, for example `<Reveal>` / `<RevealGroup>`, or `data-reveal` plus `data-reveal-group`.
- Build it on the existing text-reveal infrastructure (boot class, failsafe, pending state), not as a second competing system.

**Robustness. Nothing may ever stay hidden:**
- Server HTML is visible without JS. The hidden state only applies under the boot class.
- The failsafe reveals everything if the observer never starts.
- Elements that are already above the line show immediately. This covers page load, back/forward navigation, a deep link (#anchor) and a fast jump.
- Client-side route changes and newly added items (filters, pagination, load more, search results) are picked up.
- `content-visibility: auto` sections (D121) still reveal correctly.

**Above the fold.** Elements animate on load without hurting LCP: the LCP element is never at opacity 0. Reuse the LCP-safe idea from RevealText.

**Reduced motion.** With `prefers-reduced-motion` there is no movement and content is visible immediately, with at most a ≤150 ms opacity fade.

**Performance.**
- Animate transform and opacity only, with no layout reads in loops.
- Set `will-change` only while an element is animating.
- Use one observer per page.
- Keep the TBT and Lighthouse budgets.

### 3. Ultra-modern look and UX

**Critique and plan.** Run an impeccable critique of the current site on screenshots at 390 and 1440 px of:
- home, category, product and search;
- cart, checkout and VIN inquiry;
- the mechanics portal and the account pages;
- the admin dashboard, a list and a detail page.

Then write `docs/design/UI-BOOST.md`: the problems, the target (described in words, not copied from other sites), and the concrete changes per component and per template, ordered by impact.

**Implement the system part in this step:**
- **Tokens:**
  - the radius scale;
  - a refined spacing rhythm and type scale (keep Archivo / Public Sans / Martian Mono unless the critique proves a change);
  - elevation tuned for the dark field: subtle borders, inner highlights, soft shadows;
  - surface layering;
  - motion tokens for the reveal.
- **Shared components** (`components/ui` and the shell):
  - buttons: hover, press, loading;
  - inputs, selects and comboboxes: focus, error, filled;
  - cards: hover lift, image zoom, quick actions;
  - chips and badges, tabs, dialogs and sheets, menus, tooltips, toasts;
  - skeletons, pagination, breadcrumbs, the price component, empty states.
- **Shell:**
  - header: sticky, condenses on scroll, translucent with a light blur, the new logo, the vehicle chip, search as the primary action;
  - mobile navigation, and a mobile bottom action bar (search, vehicle, cart, contact);
  - footer;
  - subtle page transitions: the View Transitions API where supported, no layout shift.

**Identity.** Keep the Rendgen identity: the night field, the warm ink, one orange signal, and its contrast rules. Modern does not mean generic: no template look, no purple gradients, no glassmorphism on everything.

### 4. Accessibility
WCAG 2.2 AA still holds: contrast, a visible focus that follows the new shapes, 44 px targets, keyboard order, and reduced motion.

## Verify
- Run `npx tsc --noEmit`, `npm run lint`, the unit tests and `npm run build`.
- Take Playwright screenshots at 390 and 1440 px of the shell and of pages that use each component. Scroll each page all the way through first, so the reveals have run. Look at every screenshot.
- Add a Playwright test of the reveal rule that checks:
  - an element below the line is hidden;
  - scrolling its centre past the line reveals it;
  - a grid reveals in order;
  - with reduced motion everything is visible at once;
  - no element stays hidden after scrolling to the bottom.

Commit.

Step report: include notes for part 2.
