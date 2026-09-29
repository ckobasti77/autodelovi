<!-- META | Korak 21 | Opus 5.5 | effort: ultracode | sesija: NOVA | mode: auto -->
# Step 21 — Full QA audit (use a workflow)

Run a rigorous, adversarial, multi-agent quality audit of the whole product, as if a demanding client, a design-award jury, an accessibility auditor, a performance engineer and an SEO lead were all reviewing it tomorrow. **Use a dynamic workflow**: fan out specialized reviewers in parallel, then have independent agents verify every finding (reproduce it) before it is recorded. This step audits — it does not fix, except trivial blockers that prevent auditing.

## Read first
pipeline/BRIEF.md §9 (quality bars) · docs/ROADMAP.md (acceptance criteria) · docs/design/DESIGN-SYSTEM.md · docs/qa/*.md · docs/PROGRESS.md.

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
