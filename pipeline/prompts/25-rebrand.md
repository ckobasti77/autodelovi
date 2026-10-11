<!-- META | Korak 25 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 25 — Rebrand the site to Euromotors Plus by OEM Parts

The client's company is **Euromotors Plus**, and people know the shop as **OEM Parts**. Step 24 designed the new logo system. This step puts it on the site and removes the placeholder name "SKLOP" from everything a user, a search engine or a mail client can see.

## Read first
- `docs/brand/LOGO.md`, `docs/brand/BRAND-BRIEF.md` and `pipeline/logs/24-result.md`
- the latest entries in `docs/DECISIONS.md`
- `docs/design/DESIGN-SYSTEM.md` §2 (Brand)
- `docs/HUMAN-TODO.md`, `docs/PREDAJA.md` and `docs/GO-LIVE.md`

## Work
1. **Inventory.**
   - List every user-facing trace of the old brand in `docs/progress/25.md`: the "SKLOP" text, the old mark, old favicons, OG and e-mail assets, metadata, feed and structured-data fields.
   - Internal identifiers stay unless they leak into the UI, metadata, e-mails, feeds, structured data or downloads: package name, Convex tables, env var names, test IDs, `pipeline/` files.
2. **Naming rules.** Record them in `docs/DECISIONS.md`:
   - The brand name is "Euromotors Plus".
   - The lockup carries the endorsement "by OEM Parts".
   - "OEM Parts" is the `alternateName` in JSON-LD and appears in SEO titles where it helps people who search for the shop by its known name. For example, the title template is "%s | Euromotors Plus · OEM Parts". Keep titles within length.
   - The company name, legal data and contact details still come from settings. Update the defaults and seed, and the settings page labels if needed. Never hard-code company facts.
3. **Replace the logo and the name everywhere:**
   - **Header and footer:** an inline SVG component with an accessible name, correct on night and paper. Use the compact mark where the full lockup does not fit.
   - **Admin:** the shell and the login screen.
   - **Pages:** auth pages, 404/500 and offline.
   - **E-mail templates:** the header PNG on white, alt text, and the from-name.
   - **Print views:** order, offer and inquiry documents.
   - **OG image frame:** update the frame from DESIGN-SYSTEM §2.3 to the new logo, and re-render and look at it.
   - **Icons:** favicons, app icons and the web manifest (name, short_name, theme and background colours).
   - **JSON-LD** Organization/Store: name, alternateName and logo URL.
   - **Product feeds:** a part's brand stays its maker. Our name only appears where a seller or store field exists.
4. **Design system docs.** Update `docs/design/DESIGN-SYSTEM.md` §2 to the new logo system, and keep the old mark documented as retired.
5. **Tests.**
   - Update unit and e2e tests that assert brand text.
   - Add an e2e test that crawls the main routes of the production build and checks:
     - no user-visible text or metadata contains "SKLOP";
     - og:site_name is correct;
     - the new favicon is linked.
6. **Domain and sender.** These stay placeholders from settings and env. If an old placeholder contains "sklop" (for example sklop.rs or @sklop.rs), switch it to a neutral placeholder. Add a Serbian entry to `docs/HUMAN-TODO.md` asking for the real domain and sender address. Also add one asking the client to approve the logo.

## Verify
- Run `npx tsc --noEmit`, `npm run lint`, the unit and convex-test suites, `npm run build`, and the full Playwright e2e suite.
- Take screenshots of:
  - the header and footer on night;
  - the admin on paper;
  - an e-mail render;
  - the OG image;
  - the favicon in a browser tab.

  Look at each one and fix what looks wrong.

Commit. Step report.
