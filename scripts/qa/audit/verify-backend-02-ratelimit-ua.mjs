/**
 * Step 21 audit — independent verification of backend-02 (per-client rate-limit key includes the
 * caller-controlled User-Agent). Uses only `inquiries:generateUploadUrl` (limit `uploadUrl`,
 * token bucket 20/h per ctx.client.key; the mutation writes no business row, the URL is discarded).
 *
 * Phases:
 *   A. HTTP, one fixed UA, 21 calls                      → expect 20 ok + 1 RATE_LIMITED
 *   B. HTTP, same IP, 21 calls each with a fresh UA        → count ok
 *   C. HTTP, exhausted UA from A + spoofed IP headers      → is the IP part client-controllable too?
 *   D. WebSocket (ConvexClient, the browser transport): one fixed UA x21, then 5 fresh UAs
 *   E. Real Chromium: context with UA X x21 (fetch from about:blank), then a new context with UA Y x1
 * Output: docs/qa/audit/verify/backend/backend-02-reproduce.json (URLs not stored).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient, ConvexClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
import WebSocket from "ws";
import { chromium } from "@playwright/test";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const URL_ = env.NEXT_PUBLIC_CONVEX_URL;
const fn = ref("inquiries:generateUploadUrl");
const run = Date.now();
const code = (e) => e?.data?.code ?? String(e?.message ?? e).slice(0, 80);
const tally = (arr) => ({
  ok: arr.filter((x) => x === "ok").length,
  limited: arr.filter((x) => x === "RATE_LIMITED").length,
  other: arr.filter((x) => x !== "ok" && x !== "RATE_LIMITED"),
  sequence: arr.join(","),
});

const http = (headers) =>
  new ConvexHttpClient(URL_, {
    fetch: (input, init = {}) => {
      const h = new Headers(init.headers ?? {});
      for (const [k, v] of Object.entries(headers)) h.set(k, v);
      return fetch(input, { ...init, headers: h });
    },
  });
async function call(client) {
  try {
    await client.mutation(fn, {});
    return "ok";
  } catch (e) {
    return code(e);
  }
}

const out = { run, limit: "uploadUrl: token bucket 20/h (capacity 20) per ctx.client.key" };

// A
const uaA = `VerifyBackend02-A/${run}`;
const a = [];
const cA = http({ "User-Agent": uaA });
for (let i = 0; i < 21; i++) a.push(await call(cA));
out.A_http_fixedUa = tally(a);

// B
const b = [];
for (let i = 0; i < 21; i++) b.push(await call(http({ "User-Agent": `VerifyBackend02-B/${run}-${i}` })));
out.B_http_rotatingUa = tally(b);

// C — same exhausted UA, spoofed client-IP headers (one variant per call)
const spoof = [
  { "X-Forwarded-For": "203.0.113.10" },
  { "X-Forwarded-For": "203.0.113.11, 198.51.100.7" },
  { "X-Real-IP": "203.0.113.12" },
  { "CF-Connecting-IP": "203.0.113.13" },
  { "True-Client-IP": "203.0.113.14" },
  { Forwarded: "for=203.0.113.15" },
];
out.C_http_exhaustedUa_spoofedIpHeaders = [];
for (const s of spoof) {
  out.C_http_exhaustedUa_spoofedIpHeaders.push({
    header: Object.keys(s)[0],
    result: await call(http({ "User-Agent": uaA, ...s })),
  });
}

// D — WebSocket transport (what the storefront uses)
function wsClient(ua) {
  class UaWS extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { "User-Agent": ua } });
    }
  }
  return new ConvexClient(URL_, { webSocketConstructor: UaWS, unsavedChangesWarning: false });
}
const uaD = `VerifyBackend02-D/${run}`;
const d1 = [];
const cD = wsClient(uaD);
for (let i = 0; i < 21; i++) d1.push(await call(cD));
await cD.close();
const d2 = [];
for (let i = 0; i < 5; i++) {
  const c = wsClient(`VerifyBackend02-D2/${run}-${i}`);
  d2.push(await call(c));
  await c.close();
}
out.D_ws_fixedUa = tally(d1);
out.D_ws_rotatingUa = tally(d2);

// E — real Chromium contexts (as a browser visitor), fetch to the Convex HTTP API
const browser = await chromium.launch();
async function browserCalls(ua, n) {
  const ctx = await browser.newContext({ userAgent: ua });
  const page = await ctx.newPage();
  const res = await page.evaluate(
    async ({ url, n }) => {
      const r = [];
      for (let i = 0; i < n; i++) {
        const resp = await fetch(`${url}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "inquiries:generateUploadUrl", args: {}, format: "json" }),
        });
        const j = await resp.json();
        r.push(j.status === "success" ? "ok" : (j.errorData?.code ?? j.errorMessage ?? "error"));
      }
      return { r, ua: navigator.userAgent };
    },
    { url: URL_, n },
  );
  await ctx.close();
  return res;
}
const e1 = await browserCalls(`Mozilla/5.0 VerifyBackend02-E/${run}-x`, 21);
const e2 = await browserCalls(`Mozilla/5.0 VerifyBackend02-E/${run}-y`, 1);
await browser.close();
out.E_chromium_contextX = { ua: e1.ua, ...tally(e1.r) };
out.E_chromium_contextY_newUa = { ua: e2.ua, ...tally(e2.r) };

mkdirSync("docs/qa/audit/verify/backend", { recursive: true });
writeFileSync("docs/qa/audit/verify/backend/backend-02-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
