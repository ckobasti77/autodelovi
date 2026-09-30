// verify track (perf-bundle-06/09): loads templates at 390 in Chromium, records every JS chunk the
// browser fetches during first load and attributes them to client-reference-manifest entries.
//   node scripts/qa/audit/verify-perf-bundle-chunks.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { launch, newContext, BASE } from "./kit.mjs";

const routes = {
  landing: ["/ponuda/kocione-plocice-golf", ".next/server/app/(landing)/ponuda/[slug]/page_client-reference-manifest.js"],
  home: ["/", ".next/server/app/(shop)/page_client-reference-manifest.js"],
  category: ["/delovi/kocioni-diskovi", ".next/server/app/(shop)/delovi/[kategorija]/page_client-reference-manifest.js"],
  product: ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", ".next/server/app/(shop)/deo/[slug]/page_client-reference-manifest.js"],
};
const gz = (f) => gzipSync(readFileSync(`.next/${f}`)).length;
const browser = await launch();
const out = [];
for (const [name, [path, manifestPath]] of Object.entries(routes)) {
  globalThis.__RSC_MANIFEST = {};
  // eslint-disable-next-line no-eval
  eval(readFileSync(manifestPath, "utf8"));
  const m = Object.values(globalThis.__RSC_MANIFEST)[0];
  const entries = m.entryJSFiles;
  const others = Object.entries(entries).filter(([k]) => k !== "[project]/app/not-found");
  const otherSet = new Set(others.flatMap(([, v]) => v));
  const nfOnly = (entries["[project]/app/not-found"] ?? []).filter((c) => !otherSet.has(c));
  const errOnly = (entries["[project]/app/error"] ?? []).filter(
    (c) => !new Set(Object.entries(entries).filter(([k]) => k !== "[project]/app/error").flatMap(([, v]) => v)).has(c),
  );

  const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-pb" });
  const page = await ctx.newPage();
  const fetched = new Map();
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/_next/static/chunks/") && u.pathname.endsWith(".js")) {
      fetched.set(u.pathname.replace("/_next/", ""), r.status());
    }
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const allGz = [...fetched.keys()].reduce((a, c) => a + gz(c), 0);
  const nfFetched = nfOnly.filter((c) => fetched.has(c));
  const nfGz = nfFetched.reduce((a, c) => a + gz(c), 0);
  const errFetched = errOnly.filter((c) => fetched.has(c));
  out.push(
    `== ${name} ${path} @390: ${fetched.size} JS chunks fetched by load+1.5 s, ${(allGz / 1024).toFixed(1)} KB gz`,
    `   chunks only in [project]/app/not-found (not in any other entry of this page): ${nfOnly.map((c) => `${c.split("/").pop()}(${(gz(c) / 1024).toFixed(1)})`).join(" ") || "-"}`,
    `   of those fetched: ${nfFetched.length}/${nfOnly.length} = ${(nfGz / 1024).toFixed(1)} KB gz`,
    `   chunks only in [project]/app/error: ${errOnly.map((c) => `${c.split("/").pop()}(${(gz(c) / 1024).toFixed(1)})`).join(" ") || "-"}; fetched ${errFetched.length}`,
  );
  await ctx.close();
}
await browser.close();
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-06-reproduce.txt", out.join("\n") + "\n");
