/**
 * Step 21 audit — independent verification of backend-07 (global sign-up bucket).
 * 1. Calls the public `auth:signIn` action DIRECTLY on the Convex cloud URL (bypassing the Next
 *    /api/auth proxy) with flow "signUp" and a deliberately weak password. The Password provider
 *    validates the password before creating an account, so no user is created and no sign-up
 *    token is consumed — the WEAK_PASSWORD answer only proves the sign-up flow is reachable
 *    without the proxy.
 * 2. Reads (read-only query) the current value of the `signUpGlobal` / "global" bucket.
 * Output: docs/qa/audit/verify/backend/backend-07-reproduce.json
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ConvexHttpClient } from "convex/browser";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const url = env.NEXT_PUBLIC_CONVEX_URL;
const out = { at: new Date().toISOString(), convexHost: new URL(url).host.replace(/^[^.]+/, "<deployment>") };

const client = new ConvexHttpClient(url);
try {
  const r = await client.action("auth:signIn", {
    provider: "password",
    params: { flow: "signUp", email: `verify-backend-07-${Date.now()}@primer.rs`, password: "short" },
  });
  out.directSignUp = { ok: true, result: r };
} catch (e) {
  out.directSignUp = { ok: false, errorData: e?.data ?? null, message: String(e?.message ?? e).slice(0, 300) };
}

const run = (args) =>
  execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", "--component", "rateLimiter", "lib:getValue", JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
try {
  out.signUpGlobalBucket = JSON.parse(
    run({
      name: "signUpGlobal",
      key: "global",
      config: { kind: "token bucket", rate: 60, period: 3_600_000, capacity: 30 },
    }),
  );
} catch (e) {
  out.signUpGlobalBucket = { error: String(e?.stderr ?? e).slice(0, 400) };
}
mkdirSync("docs/qa/audit/verify/backend", { recursive: true });
writeFileSync("docs/qa/audit/verify/backend/backend-07-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
