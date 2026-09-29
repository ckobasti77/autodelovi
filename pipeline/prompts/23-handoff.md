<!-- META | Korak 23 | Opus 5.5 | effort: high | sesija: NOVA | mode: auto -->
# Step 23 — Handoff

Package the project so the developer can demo it tonight and hand it to the client next week.

## Read first
docs/ (all) · pipeline/logs/*-result.md (every step report) · docs/HUMAN-TODO.md · package.json.

## Skills to invoke (by name)
humanizer (for natural owner-facing text) · impeccable (for the showcase page).

## Deliver
1. **README.md** (English, for developers): what it is, stack and versions, setup from zero, env vars, scripts, architecture map, data-model summary, the 3D pipeline (rebuild, swap a part, add a category), testing, troubleshooting.
2. **docs/PREDAJA.md** (Serbian, for the developer and the client): šta je napravljeno po modulima; kako se koristi admin, korak po korak, sa screenshotovima; Excel uvoz; tok porudžbine i upita; obaveštenja; majstori i rabat; šta je privremeno (demo podaci, placeholderi) i kako se brišu demo podaci.
3. **docs/GO-LIVE.md** (Serbian checklist): domen i DNS; Vercel projekat i env varijable; Convex produkcija (`npx convex deploy`) i env varijable; Resend domen (SPF / DKIM / DMARC), ključ i prebacivanje u live mod; admin nalog; podaci firme u podešavanjima; pravna provera tekstova; GA4 / Google Ads / Meta ID-jevi i CAPI token; Merchant Center i Meta katalog feed URL-ovi; Google Business Profile; Search Console + sitemap; probne porudžbine; raspored backupa. Merge docs/HUMAN-TODO.md into it (deduplicated, prioritized).
4. **docs/showcase/** — fresh screenshots (desktop + mobile) of home (3D assembled and exploded), category, product, checkout, VIN inquiry, mechanic dashboard, admin dashboard, orders, import wizard, an e-mail sample; plus docs/showcase/index.html — one self-contained page presenting them beautifully for the client demo.
5. **pipeline/REPORT.md** — per step: status, what was built, verification results, open issues (read the step reports).
6. **Final checks** — `npm run build`, typecheck, lint, all tests; verify the `npm run dev` instructions work. Final commit `chore: handoff`.

## Definition of done
All documents exist, are accurate, and a newcomer could run, demo and go live from them · Step report.
