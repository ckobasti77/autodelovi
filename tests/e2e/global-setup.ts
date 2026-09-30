/**
 * Playwright global setup (step 19): every spec starts as a visitor who already answered the
 * cookie banner with „Odbij sve“, so the bottom sheet never covers the flows under test.
 * `tests/e2e/seo.spec.ts` opts out (`test.use({ storageState: EMPTY_STATE })`) to test it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { FullConfig } from "@playwright/test";

export const CONSENT_STATE_PATH = path.resolve(".playwright/consent-state.json");

export default function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  const { hostname } = new URL(baseURL);
  const value = encodeURIComponent(
    JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "e2e-rejected-0001" }),
  );
  mkdirSync(path.dirname(CONSENT_STATE_PATH), { recursive: true });
  writeFileSync(
    CONSENT_STATE_PATH,
    JSON.stringify({
      cookies: [
        {
          name: "sk_consent",
          value,
          domain: hostname,
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 86_400,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
