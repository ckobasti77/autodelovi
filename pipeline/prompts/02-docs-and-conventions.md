<!-- META | Korak 02 | Opus 5.5 | effort: high | sesija: NASTAVAK koraka 01 | mode: auto -->
# Step 02 — Write the plan into the repo and set the project conventions

The master plan you produced in the previous turn is **approved as-is** (the orchestrator also saved a copy to docs/plans/01-master-plan.md). Now, in auto mode, turn it into the project's living documentation and conventions. Do not build features yet.

## Do
1. Create the docs, split by topic, cross-linked, nothing from the plan lost:
   docs/ARCHITECTURE.md · docs/DATA-MODEL.md · docs/ROUTES.md · docs/3D-CONTRACT.md · docs/DESIGN-BRIEF.md · docs/NOTIFICATIONS.md · docs/SEO-ADS.md · docs/IMPORT.md · docs/SECURITY.md · docs/TESTING.md · docs/ROADMAP.md (steps 03–23 with acceptance criteria) · docs/DECISIONS.md (seed it with the plan's decisions) · docs/PROGRESS.md (log) · docs/HUMAN-TODO.md (in Serbian: what only the owner/client can provide, with "potvrditi sa klijentom" items from BRIEF §6) · docs/README.md (index of all docs).
2. Append a **"Project conventions"** section to CLAUDE.md, keeping the existing Next.js/Convex blocks untouched: stack and versions, folder structure, npm scripts, "read docs/ before working", copy rules (Serbian Latin, diacritics, voice), text-reveal and GSAP rules, pointer to the 3D contract, Convex rules (read the guidelines, authorize in every function, push with `npx convex dev --once`), test commands, Definition of Done for any change. Keep it tight — it loads on every turn.
3. Update .gitignore: pipeline/logs/, pipeline/state.json, pipeline/env/, pipeline/STATUS.md, test-results/, playwright-report/, blob-report/, .lighthouse/, 3d/renders/, *.blend1, coverage/. Decide whether 3d/build/*.blend gets committed (yes if under 50 MB, otherwise ignore it and rely on the build scripts) and log the decision.
4. Add only lightweight baseline tooling now if the plan calls for it (prettier config, npm scripts `typecheck`, `test`, `e2e`) — no feature code.
5. Commit: `git add -A` then `git commit -m "docs: master plan and conventions"`.

## Definition of done
All docs exist and faithfully match the plan · CLAUDE.md has the conventions section · .gitignore updated · `npx tsc --noEmit` still passes · committed · Step report.
