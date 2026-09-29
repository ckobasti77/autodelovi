# SKLOP — Testing strategy

> Part of the SKLOP docs — index: [README](README.md) · source: [master plan](plans/01-master-plan.md). Business intent: `pipeline/BRIEF.md`.

Related: [ROADMAP](ROADMAP.md) (per-step acceptance) · [SEO-ADS §J11](SEO-ADS.md) (Lighthouse budgets) · [3D-CONTRACT](3D-CONTRACT.md) (validator).

## M. Testing strategy

### M1. Vitest (two projects in `vitest.config.ts`)
- **unit** (`jsdom` for DOM code, `node` otherwise): `lib/domain` (pricing — 100 % branches; order/inquiry state machines — every pair of states; `normalizeCode`, `foldForSearch` incl. Cyrillic; quick-order parser; VIN/WMI/model year; PIB/MB with known valid/invalid vectors; phone; Belgrade time across both DST switches; money/VAT), `lib/format`, validation parity fixtures, `lib/excel` (synonyms, number formats, 1250 bytes, delimiters), `lib/seo` (title/description lengths, JSON-LD shapes), feeds (XML/CSV validity, escaping), analytics (event mapping, consent gating, CAPI payload builder with mocked fetch), text reveal (split/restore keeps node identity), `lib/three` (manifest schema vs. taxonomy, tier rules, explode math).
- **convex** (`environment: "edge-runtime"`, `server.deps.inline: ["convex-test"]`, tests in `convex/**/*.test.ts`, `convexTest(schema, import.meta.glob("./**/*.ts"))`, components registered with their test helpers or wrapped behind mockable modules): authz negatives for every function family × role; price-visibility matrix; order submit (re-pricing, stock rules, numbering, invalid payloads, rate limits); state machines through Convex; inquiry → quote → accept → order incl. expiry; carts + merge; quick-order matching; import stage/commit/idempotency/rollback; dispatcher idempotency + retries with fake timers and `t.finishAllScheduledFunctions`; cron local-time logic; seed idempotency; demo removal. ≥ 40 tests by step 06, ~150 by step 17. **As built (step 05):** `convex/{priceVisibility,orders,inquiries,authz,catalog,seed}.test.ts` (65 tests) with the world fixture in `convex/test.setup.ts` (roles: anonymous, 2 customers, blocked, pending/approved A (Majstor 10 %)/approved B (Partner 20 % + 25 % on discs)/suspended mechanics, staff, owner; 5 products covering in stock / low / out / on order / margin guard); pure domain tests in `tests/unit/domain/{pricing,stateMachines,commerce}.test.ts` (pricing + state machines at 100 % statements and branches); `npm run test:convex` runs only the Convex project.

### M2. Playwright
`playwright.config.ts`: `webServer` = build + `next start -p 3100` with `NEXT_PUBLIC_TEST_HOOKS=1`; `baseURL` `http://localhost:3100`; projects `desktop-chromium` (1440×900), `mobile-chromium` (390×844, touch), `reduced-motion`, plus `firefox`/`webkit` for the audit; `reporter: "line"`; traces on retry; screenshots on failure. Data: seeded dev deployment; tests create their own records with e-mails `e2e+<run>-<n>@sklop.test` (flagged `isTest` by `testing.*` helpers, which exist only when `E2E_HELPERS=1` and require `E2E_SECRET`); `testing.cleanup` removes them; admin logs in with `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. Flow list per step in §N.

### M3. Accessibility, visuals, performance
- axe: `new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])` on every template → zero serious/critical; keyboard walkthroughs (order, visible focus, dialog trap/return).
- Screenshots: `tests/e2e/screens.spec.ts` at 360/390/768/1024/1280/1440/1920/2560 → `docs/qa/screens/<step>/`; steps open and critique them (docs/qa/*.md).
- Lighthouse: `tests/lighthouse/run.mjs` (lighthouse 13 CLI, `--chrome-path="$CHROME_PATH"`, JSON output, mobile default + `--preset=desktop`, 3 runs → median) against §J11 budgets; results in `.lighthouse/` + summary table; non-zero exit on budget failure.
- Text-reveal check snippet after a full scroll on home, category, product.
- 3D: `3d/scripts/validate.mjs` (size, triangles, draw calls, names vs. manifest vs. taxonomy, coverage, materials, bbox 4.2–4.4 m) + render QA (docs/3d/QA.md) + web QA (docs/3d/WEB-QA.md, frame times under 4× CPU throttle).

### M4. Definition of Done (every change)
`npx tsc --noEmit` · `npm run lint` · relevant unit + Convex tests · e2e for touched flows · screenshots reviewed for UI changes · no console errors · docs/PROGRESS.md entry · commit.
