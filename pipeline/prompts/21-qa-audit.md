<!-- META | Korak 21 | Opus 5.5 | effort: ultracode | sesija: NOVA | mode: auto -->
# Step 21 — Full QA audit (use a workflow)

Run a rigorous, adversarial, multi-agent quality audit of the whole product, as if a demanding client, a design-award jury, an accessibility auditor, a performance engineer and an SEO lead were all reviewing it tomorrow. **Use a dynamic workflow**: fan out specialized reviewers in parallel, then have independent agents verify every finding (reproduce it) before it is recorded. This step audits — it does not fix, except trivial blockers that prevent auditing.

## Read first
pipeline/BRIEF.md §9 (quality bars) · docs/ROADMAP.md (acceptance criteria) · docs/design/DESIGN-SYSTEM.md · docs/qa/*.md · docs/3d/QA.md · docs/3d/WEB-QA.md · docs/PROGRESS.md · the "Open issues" section of every pipeline/logs/NN-result.md.

## Known open items (verify each, then record it as a finding)
- **Mobile hero framing (treat as P1):** at 360–430 px the 3D stage shows a large empty band above the car; the car fills well under half of the stage. Most ad traffic will be mobile, so this is the first impression. Fix direction: a tighter mobile camera in the manifest cameras, then new mobile posters via `npm run 3d` so poster and canvas still match.
- **Performance:** the shared site shell ships about 303 KB gzip of first-load JS. Lighthouse default simulated throttling reports mobile LCP of about 4.2 s on home (D112 chose applied throttling). Measure both methods, and treat shell JS weight, font preloads and globally registered GSAP plugins as performance findings. Category TBT on phones is about 397 ms.
- Search is not narrowed by the selected vehicle. The mobile filter row is not sticky, and the mobile sticky contact bar is not built.
- Mechanics quick order at 1440: the results list clips the last visible row behind the summary bar. Check that it reads as intentional scrolling and that every row is reachable.
- **Full e2e suite:** step 19 ran the full Playwright suite on a production build (85 passed, 23 skipped as desktop-only on the mobile project), but step 20 changed security headers and the CSP after that. Run the full suite again during setup and record every failure as a finding. Phone TBT on home, category and product was about 355 ms against the 300 ms budget in step 19.
- **Screenshot gotcha, not a defect:** below-the-fold home sections use `content-visibility: auto` (D121). Scroll the page through before taking full-page screenshots, otherwise those sections render blank.

## Skills reviewers must use (invoke by name)
impeccable (audit / critique) · design-taste-frontend · ui-ux-pro-max · seo-audit · seo-technical · text-reveal · gsap-performance · threejs-interaction · convex-reviewer.

## Setup
Run `npm run build`, start the production server on port 3100 in the background, make sure demo data is seeded and the Playwright browsers (chromium, firefox, webkit) are installed.

## Review tracks (in parallel)
1. Visual design and consistency per page versus the design system — screenshots at 360, 390, 768, 1024, 1280, 1440, 1920, 2560.
2. Interaction and motion — text reveal everywhere and never stuck, GSAP smoothness, the 3D explorer (hover, click, keyboard, deep links, mobile), reduced motion.
3. Accessibility — axe on every template, keyboard-only walkthroughs, focus order, labels, contrast, screen-reader names.
4. Cross-browser — Chromium, Firefox, WebKit on the core flows.
5. Performance — Lighthouse mobile and desktop per template, bundle analysis, 3D frame time on a throttled profile.
6. SEO — seo-audit on the local production build (crawl), metadata, JSON-LD, sitemaps, canonicals, thin pages.
7. Copy — Serbian grammar, diacritics, ekavian consistency, tone, no English leftovers, number / currency / date formats.
8. Flows and edge cases — ordering (every delivery × payment combination), inquiries, mechanics, admin, import, notifications, empty / error / offline states, validation messages.
9. Backend — authorization spot checks, data integrity, errors logged during the audit.

## Deliver docs/qa/AUDIT.md
Findings with ID, severity (P0 blocker · P1 major · P2 minor · P3 polish), area, route, reproduction steps, evidence (screenshot / log path) and a suggested fix; a scorecard per track; the top 10 quick wins. Screenshots under docs/qa/audit/. Commit. Step report.
