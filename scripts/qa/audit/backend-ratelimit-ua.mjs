/**
 * Step 21 audit (backend): per-client rate-limit keys include the caller-controlled User-Agent
 * (convex/lib/functions.ts getClientInfo: SHA-256(salt|ip|UA)). Demonstrated with the harmless
 * `inquiries:generateUploadUrl` (limit `uploadUrl` 20/h per client; issuing an upload URL writes
 * no business record):
 *   1. 21 calls with one fixed UA → the 21st must be RATE_LIMITED.
 *   2. 21 more calls from the same machine/IP, each with a different UA → count how many pass.
 * Output: docs/qa/audit/backend/ratelimit-ua.json (URLs are not stored).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const withUa = (ua) =>
  new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL, {
    fetch: (input, init = {}) => {
      const headers = new Headers(init.headers ?? {});
      headers.set("User-Agent", ua);
      return fetch(input, { ...init, headers });
    },
  });

const run = Date.now();
const fixed = withUa(`SklopAudit-backend-fixed/${run}`);
const sameUa = [];
for (let i = 1; i <= 21; i++) {
  try {
    await fixed.mutation(ref("inquiries:generateUploadUrl"), {});
    sameUa.push("ok");
  } catch (e) {
    sameUa.push(e?.data?.code ?? "error");
  }
}
const rotating = [];
for (let i = 1; i <= 21; i++) {
  const c = withUa(`SklopAudit-backend-rotating/${run}-${i}`);
  try {
    await c.mutation(ref("inquiries:generateUploadUrl"), {});
    rotating.push("ok");
  } catch (e) {
    rotating.push(e?.data?.code ?? "error");
  }
}
const result = {
  limit: "uploadUrl: token bucket 20/h per client key",
  sameUa: { ok: sameUa.filter((x) => x === "ok").length, limited: sameUa.filter((x) => x === "RATE_LIMITED").length, sequence: sameUa.join(",") },
  rotatingUa: { ok: rotating.filter((x) => x === "ok").length, limited: rotating.filter((x) => x === "RATE_LIMITED").length },
};
writeFileSync("docs/qa/audit/backend/ratelimit-ua.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
