// Verifier-only config (step 22 shell-perf round 2): renders the real Header markup with phone +
// Viber so the browser check injects exactly what Header.tsx emits.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../../../../../", import.meta.url));

export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    include: ["docs/qa/fix/shell-perf/verify/r2/*.render.test.tsx"],
    environment: "node",
  },
});
