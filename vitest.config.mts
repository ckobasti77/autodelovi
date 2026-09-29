import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Vitest 5 — one config, several projects (docs/TESTING.md §M1).
 *
 * - `unit`: pure logic (`lib/domain`, `lib/format`, `config`, …). Runs in `node` by default;
 *   a test file that needs the DOM opts in with a `// @vitest-environment jsdom` docblock.
 * - `convex` (step 05): `environment: "edge-runtime"`, `server.deps.inline: ["convex-test"]`,
 *   include `convex/**\/*.test.ts`. Add it to `projects` below.
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
      // { extends: true, test: { name: "convex", environment: "edge-runtime", … } } — step 05
    ],
  },
});
