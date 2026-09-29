import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build on port 3100 (`next build && next start -p 3100`), built
 * with NEXT_PUBLIC_TEST_HOOKS=1 for the 3D hero hooks. Set E2E_BASE_URL to reuse an already
 * running server (e.g. `next dev` on 3000) instead.
 */
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["line"]],
  outputDir: "test-results",
  use: {
    baseURL,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    trace: "retain-on-failure",
    // Headless Chromium renders WebGL through SwiftShader (the 3D hero, step 10).
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build && npm run start -- -p 3100",
        // window.__sklop3d test hooks (never set for a real production build).
        env: { NEXT_PUBLIC_TEST_HOOKS: "1" },
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 900_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
