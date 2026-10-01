/**
 * Step 22 fix-up (MOT-01): runs the proposed update of tests/e2e/hero-3d.spec.ts (a copy under
 * scripts/qa/fix/hero-3d-assets-e2e/, because tests/e2e belongs to the gates phase) against a
 * running server with the project's Playwright settings.
 *
 *   E2E_BASE_URL=http://localhost:3001 npx playwright test -c scripts/qa/fix/hero-3d-assets-e2e.config.ts
 */
import path from "node:path";

import base from "../../../playwright.config";

const root = process.cwd();

const config: typeof base = {
  ...base,
  testDir: path.join(root, "scripts/qa/fix/hero-3d-assets-e2e"),
  globalSetup: path.join(root, "tests/e2e/global-setup.ts"),
  outputDir: path.join(root, "test-results/hero-3d-assets-fixup"),
};

export default config;
