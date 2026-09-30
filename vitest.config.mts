import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Vitest 5 — one config, several projects (docs/TESTING.md §M1).
 *
 * - `unit`: pure logic (`lib/domain`, `lib/format`, `config`, …). Runs in `node` by default;
 *   a test file that needs the DOM opts in with a `// @vitest-environment jsdom` docblock.
 * - `convex`: convex-test against the real schema/functions (`environment: "edge-runtime"`,
 *   component packages inlined so their `import.meta.glob` test helpers resolve). Test files
 *   are `convex/**\/*.test.ts`; shared setup is `convex/test.setup.ts` (the Convex bundler
 *   skips file names with several dots, so neither is ever deployed).
 *
 * `npm test` runs every project with `--passWithNoTests`; `npm run test:unit` runs only `unit`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          // convex/testing.ts helpers refuse to run unless the deployment opted in.
          env: { E2E_TEST_HELPERS: "1" },
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
      },
    ],
  },
});
