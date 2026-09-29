<!-- META | Korak 20 | Opus 5.5 | effort: xhigh | sesija: NOVA | mode: auto -->
# Step 20 — Security, privacy and backend audit

Act as an application-security engineer and Convex expert doing a pre-launch review. Find real problems and fix them.

## Read first
docs/SECURITY.md · docs/DATA-MODEL.md · docs/ARCHITECTURE.md · convex/ (all of it) · app/ (route handlers, server actions, proxy) · next.config.ts.

## Skills to invoke (by name)
convex-authz · convex-reviewer · convex-launch-readiness · convex-optimize · convex-advisor · convex-backup · convex-test.

## Do
1. Run the Convex audits (authz, reviewer, launch-readiness — on the dev deployment only, never prod) and fix every P0/P1: identity taken from arguments, missing ownership checks, public queries leaking data by client-supplied ids, unbounded queries, missing indexes, OCC hot spots.
2. **Price and PII leakage review** — inspect the payload of every public query for cost prices, other roles' prices and other customers' data.
3. **Abuse protection** — rate limits and anti-spam on every public write (order, inquiry, registration, auth, search logging, back-in-stock); upload validation (type sniffing, size, count); orphan cleanup.
4. **HTTP security headers** in next.config — a CSP allowing only what is needed (self, Convex, Google tag / Analytics / Ads, Meta), frame-ancestors none, HSTS for production, Referrer-Policy, Permissions-Policy, X-Content-Type-Options. Verify nothing breaks (3D, fonts, images, analytics after consent).
5. **Secrets** — nothing in client bundles (scan the build output); env vars documented in docs/GO-LIVE-ENV.md; admin routes protected server-side (proxy + server checks), not only in the UI.
6. **Privacy (ZZPL)** — data inventory, retention rules implemented where planned, a documented process for access / deletion requests, consent logging.
7. **Dependencies** — `npm audit --omit=dev`: fix or justify.
8. **Backups** — document Convex export/import and a restore drill (convex-backup skill) plus a schedule recommendation.

## Deliver
docs/SECURITY-AUDIT.md (findings with severity, fix and evidence) · a test for every authorization bug fixed · tsc, lint, build and tests pass · commit · Step report.
