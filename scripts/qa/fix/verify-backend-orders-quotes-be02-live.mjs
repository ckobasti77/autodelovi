/**
 * Step 22 verify (BE-02, live, low impact): is the per-visitor rate-limit key the IP alone?
 *
 * Instead of draining the machine's shared uploadUrl bucket (which would lock other agents out
 * of photo uploads), this consumes only 4 tokens and reads the rate-limiter component's rows
 * before and after:
 *   - 3 HTTP calls to inquiries:generateUploadUrl, each with a different User-Agent
 *   - 1 WebSocket call (ConvexClient) with Node's default UA
 * Before the fix (key = salt|ip|UA) this creates 4 new uploadUrl rows (one per UA, value 19 each).
 * After the fix (key = salt|ipSubject) all 4 calls hit one row (value ≈ capacity 30 − 4).
 * Output: docs/qa/fix/backend-orders-quotes/verify/be02-live-key-probe.json
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;

function uploadRows() {
  const raw = execFileSync(
    process.execPath,
    [
      "node_modules/convex/bin/main.js",
      "data",
      "rateLimits",
      "--component",
      "rateLimiter",
      "--limit",
      "5000",
      "--format",
      "jsonl",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return raw
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((r) => r.name === "uploadUrl");
}

const httpClient = (ua) =>
  new ConvexHttpClient(URL_, {
    fetch: (input, init = {}) => {
      const h = new Headers(init.headers ?? {});
      h.set("User-Agent", ua);
      return fetch(input, { ...init, headers: h });
    },
  });

async function call(fn) {
  try {
    await fn();
    return "ok";
  } catch (e) {
    return e?.data?.code ?? `error:${String(e?.message ?? e).slice(0, 120)}`;
  }
}

const run = Date.now();
const before = uploadRows();
const byId = new Map(before.map((r) => [r._id, r]));
const calls = [];
for (let i = 0; i < 3; i++) {
  const ua = `Mozilla/5.0 (SKLOP-verify-BE02 ${run}-ua${i})`;
  calls.push({
    transport: "http",
    ua,
    result: await call(() => httpClient(ua).mutation(ref("inquiries:generateUploadUrl"), {})),
  });
}
const ws = new ConvexClient(URL_);
try {
  calls.push({
    transport: "websocket",
    ua: "(node default)",
    result: await call(() => ws.mutation(ref("inquiries:generateUploadUrl"), {})),
  });
} finally {
  await ws.close();
}
const after = uploadRows();
const created = after.filter((r) => !byId.has(r._id));
const changed = after
  .filter((r) => byId.has(r._id) && byId.get(r._id).ts !== r.ts)
  .map((r) => ({ _id: r._id, key: r.key, before: byId.get(r._id).value, after: r.value }));

const result = {
  at: new Date().toISOString(),
  convexUrl: URL_,
  uploadUrlRowsBefore: before.length,
  uploadUrlRowsAfter: after.length,
  calls,
  createdRows: created.map((r) => ({ _id: r._id, key: r.key, value: r.value, ts: r.ts })),
  changedRows: changed,
  verdict:
    created.length + changed.length === 1 && calls.every((c) => c.result === "ok")
      ? "PASS: 4 calls with 4 different User-Agents (HTTP + WebSocket) consumed one IP-keyed bucket"
      : "FAIL: the calls did not land in exactly one bucket",
};
writeFileSync(
  "docs/qa/fix/backend-orders-quotes/verify/be02-live-key-probe.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
process.exit(0);
