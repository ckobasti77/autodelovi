// Verifier (skeptic) for perf-bundle-01: main-thread cost attributable to the zod/RHF chunk
// (1uyyf-z7kpx1w.js) on /porudzbina and /upit, Chromium 390x844, 4x CPU throttling, 3 runs each.
// Uses a trace (compile + evaluate events whose url is the chunk) and a CPU profile (self time of
// functions defined in the chunk), plus the encoded transfer size of every script.
//   node scripts/qa/audit/verify-perf-bundle-01-skeptic-cost.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext } from "./kit.mjs";

const CHUNK = "1uyyf-z7kpx1w.js";
const routes = ["/porudzbina", "/upit", "/za-majstore/registracija", "/korpa"];
const browser = await launch("chromium");
const rows = [];
for (let run = 1; run <= 3; run++) {
  for (const route of routes) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: `pb01-skeptic-${run}` });
    const page = await ctx.newPage();
    await page.goto(BASE + "/robots.txt");
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    const scripts = new Map();
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script") scripts.set(e.requestId, { url: e.response.url, enc: 0 });
    });
    cdp.on("Network.loadingFinished", (e) => {
      const s = scripts.get(e.requestId);
      if (s) s.enc = e.encodedDataLength;
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
    await cdp.send("Profiler.start");
    await browser.startTracing(page, {
      categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "disabled-by-default-v8.compile"],
    });
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const traceBuf = await browser.stopTracing();
    const { profile } = await cdp.send("Profiler.stop");

    // CPU profile: self time of nodes whose function lives in the chunk.
    const dt = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
      const id = profile.samples[i];
      dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0));
    }
    let selfUs = 0;
    let totalUs = 0;
    for (const n of profile.nodes) {
      const t = dt.get(n.id) ?? 0;
      totalUs += t;
      if ((n.callFrame.url ?? "").includes(CHUNK)) selfUs += t;
    }
    // Trace: compile / evaluate events tagged with the chunk url.
    const events = JSON.parse(traceBuf.toString()).traceEvents ?? [];
    const mains = new Set(events.filter((e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain").map((e) => e.pid + ":" + e.tid));
    let compileMainUs = 0;
    let compileUs = 0;
    let evalUs = 0;
    let longTasks = 0;
    let longTaskBlockUs = 0;
    for (const e of events) {
      const url = e.args?.data?.url ?? e.args?.fileName ?? e.args?.data?.fileName ?? "";
      if (e.ph === "X" && url.includes(CHUNK)) {
        if (/compile|parse/i.test(e.name)) { compileUs += e.dur ?? 0; if (mains.has(e.pid + ":" + e.tid)) compileMainUs += e.dur ?? 0; }
        if (e.name === "EvaluateScript") evalUs += e.dur ?? 0;
      }
      if (e.ph === "X" && e.name === "RunTask" && (e.dur ?? 0) > 50000 && mains.has(e.pid + ":" + e.tid)) {
        longTasks++;
        longTaskBlockUs += e.dur - 50000;
      }
    }
    const list = [...scripts.values()];
    const chunk = list.find((s) => s.url.includes(CHUNK));
    const totalEnc = list.filter((s) => s.url.includes("/_next/static/")).reduce((a, s) => a + s.enc, 0);
    rows.push({
      run,
      route,
      chunkLoaded: Boolean(chunk),
      chunkTransferKB: chunk ? +(chunk.enc / 1024).toFixed(1) : 0,
      nextStaticTransferKB: +(totalEnc / 1024).toFixed(1),
      chunkSelfMs: +(selfUs / 1000).toFixed(1),
      chunkCompileMs: +(compileUs / 1000).toFixed(1),
      chunkCompileMainMs: +(compileMainUs / 1000).toFixed(1),
      chunkEvalMs: +(evalUs / 1000).toFixed(1),
      profiledMs: Math.round(totalUs / 1000),
      longTasks,
      blockingMsAll: Math.round(longTaskBlockUs / 1000),
    });
    console.log(JSON.stringify(rows.at(-1)));
    await ctx.close();
  }
}
await browser.close();
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-skeptic-cost.json", JSON.stringify(rows, null, 2));
