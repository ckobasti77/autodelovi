// verify track (perf-bundle-07): repeat visit to / in one Chromium context; records via CDP whether
// the poster / 3D assets are served from the browser cache or revalidated (304) on the second visit.
//   node scripts/qa/audit/verify-perf-bundle-cache.mjs
import { writeFileSync } from "node:fs";
import { launch, newContext, BASE } from "./kit.mjs";

const browser = await launch();
const out = [];
for (const vp of [
  { width: 1440, height: 900, tag: "1440" },
  { width: 390, height: 844, tag: "390" },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-pb07-${vp.tag}` });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  let visit = 0;
  const rows = [];
  const reqs = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    const u = new URL(e.request.url);
    if (/^\/(images|models|_next\/static\/chunks)\//.test(u.pathname) && !u.pathname.endsWith(".css"))
      reqs.set(e.requestId, { visit, path: u.pathname });
  });
  cdp.on("Network.requestWillBeSentExtraInfo", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.cond = Boolean(e.headers["if-none-match"] || e.headers["If-None-Match"] || e.headers["if-modified-since"]);
  });
  cdp.on("Network.responseReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.disk = e.response.fromDiskCache;
    r.mem = false;
    r.cc = e.response.headers["Cache-Control"] ?? e.response.headers["cache-control"];
    r.hdrStatus = e.response.headers["status"];
    rows.push(r);
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.bytes = e.encodedDataLength;
  });
  cdp.on("Network.requestServedFromCache", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.mem = true;
  });
  visit = 1;
  await page.goto(BASE + "/", { waitUntil: "load" });
  // Poke the page so the 3D chunk + GLB start (first user intent), then wait.
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(9000);
  await page.goto(BASE + "/delovi", { waitUntil: "load" });
  visit = 2;
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(9000);
  out.push(`== ${vp.tag}px: / -> /delovi -> / (same context, HTTP cache warm)`);
  for (const r of rows.filter((r) => /^\/(images|models)\//.test(r.path)))
    out.push(`   visit ${r.visit} ${r.path} status=${r.status} conditional=${r.cond ?? "?"} fromDiskCache=${r.disk} memCache=${r.mem} wireBytes=${r.bytes ?? "?"} cc=${r.cc}`);
  const js2 = rows.filter((r) => r.visit === 2 && r.path.startsWith("/_next/static/chunks/"));
  out.push(`   (control) visit 2 JS chunks: ${js2.length} requests, ${js2.filter((r) => r.status === 304 || r.cond).length} revalidated, ${js2.filter((r) => r.disk).length} from disk cache`);
  await ctx.close();
}
await browser.close();
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-07-reproduce-browser.txt", out.join("\n") + "\n");
