<!-- META | Korak 27 | Opus 5.5 | effort: max | sesija: nastavak #26 | mode: auto -->
# Step 27 — UI/UX ultra boost, part 2: every page

Continue from step 26 and follow the plan in `docs/design/UI-BOOST.md`. Apply the new system (small radii, the reveal system, the upgraded components and shell) to every template, and make each page clearly better.

## Skills (invoke each by name again before you start)
Invoke these even though step 26 already did; earlier skill guidance may have been compacted out of this session:
- impeccable (critique and polish)
- design-taste-frontend
- ui-ux-pro-max
- design-dna
- motion-design
- text-reveal
- gsap-scrolltrigger, gsap-react, gsap-performance
- threejs-interaction (for the 3D explorer UI)

## Work
Work page by page. After each one, take screenshots at 390 and 1440 px (scroll through first so the reveals have run), look at them, and run a quick impeccable critique. Fix what it finds before moving on.

1. **Home:**
   - hero with the 3D car (keep the mobile framing fix, and keep the poster and canvas matching);
   - vehicle picker, categories and featured parts;
   - the mechanics band, the trust and process sections, and the footer.
2. **Catalog and category pages:**
   - filters: sticky, with chips and a clear-all;
   - sorting;
   - the product grid with the staggered reveal;
   - empty and no-fitment states.
3. **Product page:**
   - gallery and the fitment check for the chosen vehicle;
   - sticky buy box on desktop, buy bar on mobile;
   - OEM numbers and cross-references;
   - related parts.
4. **Search:** instant results, aware of the chosen vehicle, keyboard friendly. When nothing is found, help the user, for example by pointing to the VIN inquiry.
5. **Cart and checkout:** every delivery × payment combination, the order confirmation and order tracking.
6. **VIN inquiry flow.**
7. **Mechanics portal:** login, quick order, price view and order history.
8. **Account and other pages:** account, auth, the content pages (about, contact, delivery, legal), 404/500 and offline.
9. **Admin:**
   - apply the radii, the lighter reveal, and the shell and component upgrades;
   - pages: dashboard, lists, detail pages, import and settings;
   - keep the density high.
10. **E-mails:** the new header logo, small radii where mail clients support them, consistent with the brand.
11. **3D explorer UI:** labels, the part panel and the stage controls get the same shapes and motion as the new system.

Keep all behaviour, the copy rules (Serbian Latin, ekavian, correct diacritics) and the tests intact. Update e2e selectors only where the markup really changed.

## Verify
Run `npx tsc --noEmit`, `npm run lint`, the unit and convex-test suites, `npm run build` and the full Playwright e2e suite.

Commit; you may commit per template.

Step report.
