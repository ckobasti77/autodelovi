import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Step 21 audit — scratch config for scripts/qa/audit/verify-backend-06.test.ts (same settings as
// the `convex` project in vitest.config.ts, but only this file).
const root = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    include: ["scripts/qa/audit/verify-backend-0*.test.ts"],
    environment: "edge-runtime",
    env: { E2E_TEST_HELPERS: "1" },
    testTimeout: 60_000,
    server: {
      deps: {
        inline: ["convex-test", "@convex-dev/rate-limiter", "@convex-dev/resend", "@convex-dev/batch-worker"],
      },
    },
  },
});
