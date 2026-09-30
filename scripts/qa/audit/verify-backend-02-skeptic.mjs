/**
 * Step 21 verify (backend-02, skeptic): does the per-client rate-limit key change with the
 * User-Agent alone? Uses the harmless inquiries:generateUploadUrl (uploadUrl 20/h per client key;
 * no record is written, URLs are not stored).
 *  A. 21 calls, fixed UA (fresh ConvexHttpClient per call to rule out per-connection keys).
 *  B. 10 calls, each with a new UA.
 *  C. Control: 2 more calls with the fixed UA from A — must still be RATE_LIMITED (proves IP did
 *     not change between A and B, so B passing is due to the UA alone).
 *  D. 3 calls, UA = fixed UA + one trailing space (minimal header mutation).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const client = (ua) => new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL, {
  fetch: (input, init = {}) => {
    const h = new Headers(init.headers ?? {});
    h.set("User-Agent", ua);
    return fetch(input, { ...init, headers: h });
  },
});
async function call(ua) {
  try { await client(ua).mutation(ref("inquiries:generateUploadUrl"), {}); return "ok"; }
  catch (e) { return e?.data?.code ?? `error:${String(e?.message ?? e).slice(0, 80)}`; }
}
const run = Date.now();
const fixedUa = `Mozilla/5.0 (Verify-skeptic-backend02 ${run})`;
const out = { run, fixedUa, A: [], B: [], C: [], D: [] };
for (let i = 0; i < 21; i++) out.A.push(await call(fixedUa));
for (let i = 0; i < 10; i++) out.B.push(await call(`Mozilla/5.0 (Verify-skeptic-backend02 ${run}-r${i})`));
for (let i = 0; i < 2; i++) out.C.push(await call(fixedUa));
for (let i = 0; i < 3; i++) out.D.push(await call(fixedUa + " "));
const sum = (a) => ({ ok: a.filter((x) => x === "ok").length, limited: a.filter((x) => x === "RATE_LIMITED").length, seq: a.join(",") });
const result = {
  limit: "uploadUrl token bucket 20/h, key = SHA-256(salt|ip|UA) (convex/lib/functions.ts:31)",
  A_fixedUa_21_calls: sum(out.A),
  B_newUaEachCall_10_calls: sum(out.B),
  C_control_fixedUaAgain: sum(out.C),
  D_fixedUaPlusTrailingSpace: sum(out.D),
  at: new Date().toISOString(),
};
writeFileSync("docs/qa/audit/verify/backend/backend-02-skeptic.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
