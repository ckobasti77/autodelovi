import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Step 21 audit verifier config: runs only scripts/qa/audit/verify-backend-01.test.ts with the
// same convex-test environment as the repo's `convex` project (vitest.config.mts).
const root = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    include: ["scripts/qa/audit/verify-backend-01.test.ts"],
    environment: "edge-runtime",
    env: { E2E_TEST_HELPERS: "1" },
    testTimeout: 120_000,
    server: {
      deps: {
        inline: [
          "convex-test",
          "@convex-dev/rate-limiter",
          "@convex-dev/resend",
          "@convex-dev/batch-worker",
        ],
      },
    },
  },
});
