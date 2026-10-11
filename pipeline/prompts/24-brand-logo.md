<!-- META | Korak 24 | Opus 5.5 | effort: max | sesija: NOVA | mode: auto -->
# Step 24 — New logo: Euromotors Plus by OEM Parts

## Context
The client's real company name is **Euromotors Plus**. Car owners and mechanics know the shop as **OEM Parts**. The client wants the new identity to carry both names, read as "Euromotors Plus by OEM Parts" (or a close variant you can justify). "SKLOP" was only a placeholder name from the brief. Step 25 will replace it across the site with the identity you create here.

Their two current logos are in `docs/brand/source/`. Open both with the Read tool:
- **`euromotors-plus-current.jpg`** is the logo they want to evolve.
  - It has a navy serif wordmark EUROMOTORS, "PLUS" between two rules, "OEM PARTS" in small caps, and a partial ring of hand-drawn stars on the left.
  - It looks dated: generic serif, uneven stars, lots of empty canvas, and no version that works at small sizes.
- **`oem-parts-current.webp`** is the mark people recognise: white bold italic "OEM" above a thin rule, with an outlined italic "Parts" below it, on black.

The owner's request:
- Make the first logo much better and ultra-modern.
- Work the second logo into it, especially its "Parts".
- Make it fit our site.

Our design system is "Rendgen" (`docs/design/DESIGN-SYSTEM.md`):
- Dark graphite night field `#0D0F11`.
- Warm off-white ink `#F1ECE3`.
- One signal accent, safety orange `#FF6B1A`.
- A light "paper" theme for admin and e-mail.
- Type: Archivo (display), Public Sans (body), Martian Mono (mono).

The logo must look at home on the dark storefront and also on white (admin, e-mail, documents, print).

## Skills (invoke each by name with the Skill tool before the related work)
- **The logo design skill.** The owner asked for it by name. Look through your available skills for one about logos or brand marks (names containing "logo", "brand" or "identity") and follow it. If none exists, say so in the report and follow established logo-design practice.
- design-dna, impeccable (critique), design-taste-frontend, ui-ux-pro-max (brand, colour and typography searches).

## Work
1. **Brief.** Write `docs/brand/BRAND-BRIEF.md` covering:
   - **Who they are:** genuine and OEM-quality parts for the VW Group (VW, Audi, Škoda, SEAT, Cupra), selling to car owners and mechanics in Serbia.
   - **The two names** and how they relate: the company, and the shop name people know.
   - **What the mark must say:** genuine quality, European, precise, trustworthy, modern.
   - **Where it lives:** 28–40 px header on dark, 16 px favicon, app icon, e-mail header on white, one-colour documents and print, shop sign, van, social avatar.
   - **What to avoid:**
     - Shapes and colours of the VAG brands (the VW roundel and blue, the Audi rings, the Škoda arrow, the SEAT S).
     - Anything that suggests an official dealer.
     - Clip-art stars, and effects that break in one colour.
     - A reproduction of the EU emblem (twelve gold stars in a circle on blue). It is a protected emblem and trademark offices refuse marks that contain it. An abstract nod to "Euro" is fine.
2. **Explore.** Make at least 6 genuinely different concept directions as SVG in `docs/brand/concepts/`. Examples:
   - a reworked star motif that also reads as motion, a gear or the "+" of Plus;
   - an EM or EMP monogram;
   - a wordmark-led lockup with "by OEM Parts" as an endorsement;
   - a part-silhouette mark in the spirit of the current "izvučen deo" mark;
   - an "OEM Parts" seal.

   Each concept needs a primary lockup and a compact mark. Render every concept to PNG on night and on paper, and at 16, 32, 64 and 256 px (Playwright, sharp or resvg). Look at every render with the Read tool.
3. **Select.**
   - Score the concepts against the brief: legibility at 16 px, one-colour reproduction, distinctiveness from competitors and the VAG brands, fit with Rendgen, memorability, and how clearly it carries both names.
   - Run an impeccable critique on the best 2–3.
   - Pick one and record the reasons in `docs/DECISIONS.md`.
   - Keep the runners-up in `docs/brand/concepts/` so the owner can show alternatives.
4. **Refine** the chosen concept into a finished logo:
   - **Construction:** build it geometrically, with a grid, consistent stroke and corner logic, and optical corrections (overshoot, balanced spacing, kerned wordmark).
   - **Lettering:** an OFL font is fine as a starting point (for example Archivo at an expanded width). Outline it with opentype.js or fontkit and customise it. The final SVGs contain no live text. Record the font and its licence.
   - **"Parts":** keep the character of the known OEM Parts logo (italic, outlined, same rhythm), redrawn cleanly, so people who know the shop recognise it.
   - **Colour and size:** it must work in full colour on night and on paper, in one colour (ink, white, black), and at 16 px.
5. **Logo system and exports.** Put web assets in `public/brand/` and the owner's kit in `docs/brand/export/`:
   - Lockups: horizontal, stacked, compact mark/icon, wordmark only.
   - Colour variants: night (for dark backgrounds), paper (for white), mono black, mono white, plus orange-on-dark if it suits the mark.
   - Formats:
     - optimised SVG (SVGO, correct viewBox, no raster, no fonts);
     - PNG at 1×, 2× and 4×;
     - a vector PDF for print (print the SVG to PDF with headless Chrome).
   - Icons and images:
     - favicon set: favicon.ico with 16/32/48, icon.svg, apple-touch-icon 180, PWA icons 192 and 512 plus maskable;
     - the e-mail header logo as a 2× PNG on white;
     - a 1000×1000 social avatar.
6. **Brand board.** Write `docs/brand/BRAND-BOARD.html` as a self-contained file (inline SVG and CSS, no external requests). Render it to `docs/brand/BRAND-BOARD.png` at 1600 px wide. It shows:
   - the logo system on night and on paper;
   - clear space and minimum size;
   - colours with hex codes, and typography;
   - correct and incorrect use;
   - mockups: site header, favicon in a browser tab, app icon, e-mail header, shop sign, van side, business card.

   The owner will show this to the client, so it must look premium.
7. **Docs.** Write `docs/brand/LOGO.md` for the owner, in Serbian: the concept in plain words, every file and what it is for, the usage rules, and a short note on the alternatives.

Do not change the site in this step; step 25 integrates the logo and renames the brand. Commit.

Step report: include the paths of `BRAND-BOARD.png` and of the PNG renders of the chosen logo and the 2 best alternatives.
