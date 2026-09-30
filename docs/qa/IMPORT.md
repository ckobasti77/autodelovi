# Excel import and exports QA (step 16)

> Every import screen at 1440 and 1024 px, captured by driving the real flow with the 500-row fixture on `next dev` with the seeded owner: `node scripts/qa/import-flow.mjs <base> <width>` → `docs/qa/screens/step-16/` (start, file preview, columns, check, dry run, committed, rolled back, history, batch record, exports; the four exports are downloaded in the same run). Reviewed against DESIGN-SYSTEM §9.15/§10.10–10.12, the impeccable craft floor (Operate mode) and the step brief.

Severity: **P0** blocks the flow · **P1** visible defect or wrong information · **P2** polish · **P3** nice to have.

## Automated checks

- impeccable detector on `components/admin/import`, `components/admin/export`, `app/admin/(panel)/uvoz`, `app/admin/(panel)/izvoz`: 1 finding (IM-01), fixed → 0.
- Console errors: 0 on every screen at both widths after the fixes (the first 1440 run logged duplicate React keys — IM-02).
- `tests/e2e/import.spec.ts` 2/2 on `next dev` (template; 500 rows → mapping → seeded errors → dry run 490/10 → commit → rollback), then in the full production-build run (see docs/PROGRESS.md).

## Findings (one review round, all fixed)

| ID    | Sev | Screen         | Finding                                                                                                    | Fix                                                                  |
| ----- | --- | -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| IM-01 | P2  | Count tiles    | Raw 2 rem numeral outside the type ramp                                                                    | `type-numeral-l`                                                     |
| IM-02 | P1  | Provera        | Category mapping select repeated suggested categories (duplicate option keys, console error)               | Suggestions listed once, removed from the full list                  |
| IM-03 | P1  | Breadcrumb     | New routes showed raw segments („uvoz“, „istorija“, „izvoz“)                                               | Labels „Uvoz iz Excela“, „Istorija“, „Izvoz“                         |
| IM-04 | P2  | Provera, zapis | Every message repeated its field („Kategorija: Kategorija … ne postoji“) and long error lines were all red | Messages stand alone; red icon, ink text (status never colour-only)  |
| IM-05 | P2  | Datoteka       | Sheet, header-row and encoding selects had only placeholder-style labels, truncated at 1440                | Visible field labels; options „Red 4 — Šifra artikla, Naziv artikla“ |
| IM-06 | P2  | Zapis uvoza    | Rows of a rolled-back batch still said „upisano“                                                           | „upisano, pa poništeno“                                              |
| IM-07 | P2  | Start          | Empty right column at ≥ 1280 before the first import; later the recent list truncated file names to „p…“   | „Kako teče uvoz“ (five steps) above „Poslednji uvozi“; two-line rows |
| IM-08 | P3  | Probni uvoz    | „Novi“ samples showed only „—“ in the last column                                                          | Category · price · stock of the new product                          |

## Notes

- Deactivate-missing preview showed „0 artikala“ on the dev deployment because every non-demo product there is inactive (demo products are never deactivated) — correct.
- Date inputs on Izvoz show the browser's placeholder (`mm/dd/yyyy` in the English headless Chromium; a Serbian browser shows `dd.mm.gggg.`), as in ADMIN.md.
