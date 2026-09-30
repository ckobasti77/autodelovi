// Verifier (seo-05): find every generation page linked from model pages (not only the sitemap).
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "http://localhost:3100";
const rows = readFileSync("docs/qa/audit/verify/seo/sitemap-crawl.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const models = rows.filter((r) => r.sitemap === "vozila.xml" && new URL(r.url).pathname.split("/").filter(Boolean).length === 3).map((r) => r.url);
const brands = rows.filter((r) => r.sitemap === "vozila.xml" && new URL(r.url).pathname.split("/").filter(Boolean).length === 2).map((r) => r.url);
const gens = new Set();
for (const m of [...brands, ...models]) {
  const h = await (await fetch(m)).text();
  for (const x of h.matchAll(/href="(\/vozila\/[^"/?#]+\/[^"/?#]+\/[^"/?#]+)"/g)) gens.add(x[1]);
}
const landings = new Set(rows.filter((r) => r.sitemap === "landing.xml").map((r) => new URL(r.url).pathname));
const inSitemap = new Set(rows.map((r) => new URL(r.url).pathname));
const param = new Set(); const twins = new Set(); let twinsLinked = 0; const noSitemap = [];
for (const g of gens) {
  const r = await fetch(BASE + g); const h = await r.text();
  const robots = h.match(/<meta name="robots" content="([^"]*)"/)?.[1];
  if (!inSitemap.has(g)) noSitemap.push({ g, status: r.status, robots });
  const set = new Set([...h.matchAll(/href="(\/delovi\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&")));
  for (const l of set) {
    const u = new URL(l, BASE); if (!u.searchParams.get("generacija")) continue; param.add(l);
    const twin = `/delovi/${u.pathname.split("/")[2]}/${u.searchParams.get("marka")}/${u.searchParams.get("model")}`;
    if (landings.has(twin)) { twins.add(l); if (set.has(twin)) twinsLinked++; }
  }
}
const s = { generationPagesLinked: gens.size, notInSitemap: noSitemap.length, notInSitemapSample: noSitemap.slice(0, 5), uniqueGenerationFilteredLinks: param.size, withIndexableLandingTwin: twins.size, twinAlsoLinkedOnSamePage: twinsLinked };
console.log(JSON.stringify(s, null, 1));
writeFileSync("docs/qa/audit/verify/seo/seo-05-reproduce-allgens.json", JSON.stringify(s, null, 1));
