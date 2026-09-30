// verify track (perf-bundle-01): real-browser check of the zod/react-hook-form chunk.
//  A) first load at 390 px (isMobile), 4x CPU throttle, 3 runs each: /porudzbina, /upit,
//     /za-majstore/registracija vs /korpa and /prijava. Per page: JS bytes on the wire (CDP encodedDataLength),
//     whether 1uyyf-z7kpx1w.js was requested, and its main-thread compile + evaluate time from a trace;
//     sum of long-task blocking (>50 ms) after load start as a TBT proxy.
//  B) flow: product page -> add to cart -> /korpa -> click the checkout link; when is the chunk fetched?
//   node scripts/qa/audit/verify-perf-bundle-01-browser.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const CHUNK = "1uyyf-z7kpx1w";
const browser = await launch("chromium");
const routes = [
  ["korpa", "/korpa"],
  ["prijava", "/prijava"],
  ["porudzbina", "/porudzbina"],
  ["upit", "/upit"],
  ["registracija", "/za-majstore/registracija"],
];
const rows = [];

async function traceLoad(name, route, run) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-pb01-${name}-${run}` });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  const reqs = new Map();
  let jsBytes = 0;
  let chunkBytes = 0;
  let chunkRequested = false;
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    if (r.type === "Script" || /\.js(\?|$)/.test(r.url)) {
      jsBytes += e.encodedDataLength;
      if (r.url.includes(CHUNK)) {
        chunkRequested = true;
        chunkBytes = e.encodedDataLength;
      }
    }
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const events = [];
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const done = new Promise((res) => cdp.once("Tracing.tracingComplete", res));
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,v8,disabled-by-default-devtools.timeline",
    transferMode: "ReportEvents",
  });
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await cdp.send("Tracing.end");
  await done;
  // Main-thread cost attributable to the chunk: EvaluateScript + v8.compile/compileModule with its URL.
  let chunkEvalMs = 0;
  let chunkCompileMs = 0;
  const main = events.find((e) => e.name === "TracingStartedInBrowser");
  for (const e of events) {
    const url = e.args?.data?.url ?? e.args?.fileName ?? "";
    if (!url.includes(CHUNK) || e.ph !== "X") continue;
    if (e.name === "EvaluateScript") chunkEvalMs += e.dur / 1000;
    if (/^v8\.compile/.test(e.name)) chunkCompileMs += e.dur / 1000;
  }
  // TBT proxy: top-level RunTask > 50 ms on the renderer main thread (the one that ran EvaluateScript).
  const evalEv = events.find((e) => e.name === "EvaluateScript");
  const tid = evalEv?.tid;
  const pid = evalEv?.pid;
  let blocking = 0;
  let longest = 0;
  for (const e of events) {
    if (e.name !== "RunTask" || e.ph !== "X" || e.tid !== tid || e.pid !== pid) continue;
    const ms = e.dur / 1000;
    if (ms > 50) blocking += ms - 50;
    if (ms > longest) longest = ms;
  }
  void main;
  rows.push({
    run,
    name,
    route,
    jsKiBwire: +(jsBytes / 1024).toFixed(1),
    chunkRequested,
    chunkKiBwire: +(chunkBytes / 1024).toFixed(1),
    chunkCompileMs: Math.round(chunkCompileMs),
    chunkEvalMs: Math.round(chunkEvalMs),
    blockingMs: Math.round(blocking),
    longestTaskMs: Math.round(longest),
  });
  await ctx.close();
}

for (let run = 1; run <= 3; run++) for (const [n, r] of routes) await traceLoad(n, r, run);

const lines = [];
lines.push("verify perf-bundle-01 - Chromium headless, 390x844 isMobile, 4x CPU throttle, :3100, 2026-09-30");
lines.push("run name          jsKiB(wire) chunk? chunkKiB compileMs evalMs blocking>50ms longestTask");
for (const r of rows)
  lines.push(
    `${r.run}   ${r.name.padEnd(13)} ${String(r.jsKiBwire).padStart(8)}  ${String(r.chunkRequested).padEnd(6)} ${String(r.chunkKiBwire).padStart(7)} ${String(r.chunkCompileMs).padStart(8)} ${String(r.chunkEvalMs).padStart(6)} ${String(r.blockingMs).padStart(8)} ${String(r.longestTaskMs).padStart(10)}`,
  );
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
lines.push("\nmedians:");
for (const [n] of routes) {
  const rs = rows.filter((r) => r.name === n);
  lines.push(
    `  ${n.padEnd(13)} js ${med(rs.map((r) => r.jsKiBwire))} KiB wire, chunk compile ${med(rs.map((r) => r.chunkCompileMs))} ms + eval ${med(rs.map((r) => r.chunkEvalMs))} ms, blocking ${med(rs.map((r) => r.blockingMs))} ms, longest ${med(rs.map((r) => r.longestTaskMs))} ms`,
  );
}

// B) cart -> checkout flow: is the chunk fetched on /korpa (prefetch) or only on navigation?
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-pb01-flow" });
  const page = await ctx.newPage();
  const seen = [];
  page.on("request", (r) => {
    if (r.url().includes(CHUNK)) seen.push({ at: page.url(), t: Date.now() });
  });
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  const add = page.getByRole("button", { name: /dodaj u korpu/i }).first();
  let added = false;
  if (await add.count()) {
    await add.click();
    await page.waitForTimeout(1500);
    added = true;
  }
  await page.goto(BASE + "/korpa", { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const onKorpa = seen.length;
  const links = await page.locator('a[href="/porudzbina"]').count();
  let navigated = false;
  if (links) {
    const link = page.locator('a[href="/porudzbina"]').filter({ visible: true }).first();
    await link.click();
    await page.waitForURL("**/porudzbina", { timeout: 15000 });
    await page.waitForTimeout(2500);
    navigated = true;
    await shot(page, "verify/perf-bundle/perf-bundle-01-reproduce-checkout-390");
  }
  lines.push(
    `\nflow (390): added to cart=${added}; checkout links on /korpa=${links}; chunk requests while on /korpa (4 s, no click)=${onKorpa}; after clicking to /porudzbina total chunk requests=${seen.length}; navigated=${navigated}`,
  );
  await ctx.close();
}
await browser.close();
const out = lines.join("\n");
console.log(out);
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-browser.txt", out + "\n");
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-browser.json", JSON.stringify(rows, null, 2));
