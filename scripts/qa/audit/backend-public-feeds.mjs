/** Step 21 audit (backend): anonymous payload scan of the paginated public feeds + route handlers. */
import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference as ref } from "convex/server";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const c = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
const keys = (v, t = "", out = new Set()) => { if (v && typeof v === "object") { if (Array.isArray(v)) v.slice(0, 20).forEach((x) => keys(x, t + "[]", out)); else for (const [k, x] of Object.entries(v)) { out.add(`${t}.${k}`); keys(x, `${t}.${k}`, out); } } return out; };
const res = {};
for (const n of ["seo:feedProducts", "seo:sitemapProducts"]) {
  const r = await c.query(ref(n), { paginationOpts: { numItems: 50, cursor: null } });
  res[n] = [...keys(r)].filter((k) => /cost|margin|private|stockQty|email|phone|token/i.test(k));
  res[n + " allKeys"] = [...keys(r.page?.[0] ?? {})];
}
const routes = ["/feeds/google-merchant.xml", "/feeds/meta-catalog.csv", "/sitemap.xml", "/majstor/cenovnik/preuzmi", "/api/revalidate", "/admin/porudzbine/SK-2026-000092/predracun", "/admin/izvoz/porudzbine", "/admin/izvoz/kupci", "/admin/uvoz/sablon"];
for (const r of routes) {
  const resp = await fetch("http://localhost:3100" + r, { redirect: "manual" });
  const body = resp.status === 200 ? await resp.text() : "";
  res[r] = { status: resp.status, location: resp.headers.get("location"), leak: /costNet|marginBp|1146700/.test(body) };
}
writeFileSync("docs/qa/audit/backend/public-feeds-scan.json", JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
