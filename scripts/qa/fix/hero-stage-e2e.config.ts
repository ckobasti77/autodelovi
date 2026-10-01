/**
 * Step 22 (hero-stage): runs tests/e2e/hero-3d.spec.ts against an already running server with
 * the project's Playwright settings (no build, no web server).
 *
 *   E2E_BASE_URL=http://localhost:3001 npx playwright test -c scripts/qa/fix/hero-stage-e2e.config.ts
 */
import path from "node:path";

import base from "../../../playwright.config";

const root = process.cwd();

const config: typeof base = {
  ...base,
  testDir: path.join(root, "tests/e2e"),
  testMatch: "hero-3d.spec.ts",
  workers: 1,
  globalSetup: path.join(root, "tests/e2e/global-setup.ts"),
  outputDir: path.join(root, "test-results/hero-stage"),
};

export default config;
