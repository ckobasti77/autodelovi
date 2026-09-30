import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Project guards (docs/ARCHITECTURE.md §G5, .claude/rules/architecture.md).
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["components/ui/RouteLink.tsx", "lib/gsap/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Use RouteLink from @/components/ui/RouteLink (prefetches only live routes).",
            },
            {
              name: "gsap",
              message:
                "Import gsap from @/lib/gsap/client (plugins and eases are registered there).",
            },
            { name: "@gsap/react", message: "Import useGSAP from @/lib/gsap/client." },
          ],
          patterns: [{ group: ["gsap/*"], message: "Import GSAP plugins from @/lib/gsap/client." }],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored agent tooling and generated code (not project source).
    ".claude/**",
    ".agents/**",
    "pipeline/**",
    "convex/_generated/**",
    "test-results/**",
    "playwright-report/**",
    // Step 21 audit reproduction scripts (evidence for docs/qa/AUDIT.md, not project source).
    "scripts/qa/audit/**",
  ]),
]);

export default eslintConfig;
