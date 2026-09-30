// verify track (perf-bundle-06/09): loads templates at 390, collects every JS chunk the browser
// fetched, splits each Turbopack chunk into its module factories (vm, no execution of factories)
// and lists module ids that were downloaded in more than one chunk.
//   node scripts/qa/audit/verify-perf-bundle-dupes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { launch, newContext, BASE } from "./kit.mjs";

function modules(file) {
  const sandbox = { TURBOPACK: [], document: undefined };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(readFileSync(`.next/${file}`, "utf8"), sandbox, { timeout: 2000 });
  } catch {
    return new Map();
  }
  const map = new Map();
  for (const push of sandbox.TURBOPACK) {
    if (!Array.isArray(push)) continue;
    for (let i = 1; i < push.length; i++) {
      if (typeof push[i] === "number" && typeof push[i + 1] === "function") {
        map.set(push[i], push[i + 1].toString());
        i++;
      } else if (typeof push[i] === "number") {
        // id followed by another id (aliases) — skip
      }
    }
  }
  return map;
}

const routes = {
  home: "/",
  category: "/delovi/kocioni-diskovi",
  product: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  landing: "/ponuda/kocione-plocice-golf",
  korpa: "/korpa",
};
const browser = await launch();
const out = [];
for (const [name, path] of Object.entries(routes)) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-pb09" });
  const page = await ctx.newPage();
  const fetched = new Set();
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/_next/static/chunks/") && u.pathname.endsWith(".js")) fetched.add(u.pathname.replace("/_next/", ""));
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await ctx.close();
  const where = new Map();
  for (const c of fetched) for (const [id, src] of modules(c)) {
    if (!where.has(id)) where.set(id, { src, chunks: [] });
    where.get(id).chunks.push(c.split("/").pop());
  }
  const dupes = [...where.entries()].filter(([, v]) => v.chunks.length > 1).sort((a, b) => b[1].src.length - a[1].src.length);
  const redundant = dupes.reduce((a, [, v]) => a + v.src.length * (v.chunks.length - 1), 0);
  const redundantGz = gzipSync(dupes.map(([, v]) => v.src).join("\n")).length;
  const viaErr = dupes.filter(([, v]) => v.chunks.includes("1adhcvv0smcza.js"));
  const viaErrBytes = viaErr.reduce((a, [, v]) => a + v.src.length, 0);
  out.push(`== ${name} ${path} @390: ${fetched.size} chunks fetched, ${where.size} modules, ${dupes.length} downloaded more than once, redundant ${(redundant / 1024).toFixed(1)} KB raw (~${(redundantGz / 1024).toFixed(1)} KB gz standalone); ${viaErr.length} of them involve 1adhcvv0smcza.js (app/error) = ${(viaErrBytes / 1024).toFixed(1)} KB raw`);
  for (const [id, v] of dupes.slice(0, 50)) {
    const hint = (v.src.match(/"([A-Za-z][A-Za-z0-9 ._/-]{3,30})"/) ?? [])[1] ?? "";
    out.push(`   #${id} ${(v.src.length / 1024).toFixed(1)} KB x${v.chunks.length} [${hint}] ${v.chunks.join(" ")}`);
  }
}
await browser.close();
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-09-reproduce.txt", out.join("\n") + "\n");
