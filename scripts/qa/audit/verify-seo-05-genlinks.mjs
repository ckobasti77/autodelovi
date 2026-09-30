// Verifier (seo-05): collect /delovi links from every generation page in vozila.xml, check which
// are vehicle-filtered parameter URLs, whether an indexable landing twin exists, and whether
// the same generation page also links that landing (LandingLinks section).
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "http://localhost:3100";
const rows = readFileSync("docs/qa/audit/verify/seo/sitemap-crawl.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const gens = rows.filter((r) => r.sitemap === "vozila.xml" && new URL(r.url).pathname.split("/").filter(Boolean).length === 4).map((r) => r.url);
const landings = new Set(rows.filter((r) => r.sitemap === "landing.xml").map((r) => new URL(r.url).pathname));
const paramUrls = new Set(); let withTwin = new Set(); let twinLinkedOnSamePage = 0, twinNotLinked = [];
const perPage = [];
for (const g of gens) {
  const html = await (await fetch(g)).text();
  const links = [...html.matchAll(/href="(\/delovi\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const set = new Set(links);
  let n = 0;
  for (const l of set) {
    const u = new URL(l, BASE);
    if (!u.searchParams.get("generacija")) continue;
    n++; paramUrls.add(l);
    const [, , cat] = u.pathname.split("/");
    const twin = `/delovi/${cat}/${u.searchParams.get("marka")}/${u.searchParams.get("model")}`;
    if (landings.has(twin)) { withTwin.add(l); if (set.has(twin)) twinLinkedOnSamePage++; else twinNotLinked.push([new URL(g).pathname, twin]); }
  }
  perPage.push({ page: new URL(g).pathname, generationFilteredLinks: n, landingLinks: [...set].filter((l) => landings.has(l)).length });
}
const sample = [...paramUrls].slice(0, 400);
let idx = 0, noidx = 0, canonBase = 0;
for (const l of sample) {
  const h = await (await fetch(BASE + l)).text();
  const robots = h.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "";
  const canon = h.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? "";
  robots.startsWith("index") ? idx++ : noidx++;
  if (new URL(canon).pathname === new URL(l, BASE).pathname && !new URL(canon).search) canonBase++;
}
const summary = { generationPages: gens.length, uniqueGenerationFilteredLinks: paramUrls.size, withIndexableLandingTwin: withTwin.size, twinAlsoLinkedOnSamePage: twinLinkedOnSamePage, twinNotLinkedOnSamePage: twinNotLinked.length, twinNotLinkedExamples: twinNotLinked.slice(0, 10), sampledForRobots: sample.length, sampledIndex: idx, sampledNoindex: noidx, sampledCanonicalToBaseCategory: canonBase, pagesWithoutLandingLinks: perPage.filter((p) => p.landingLinks === 0).length };
console.log(JSON.stringify(summary, null, 1));
writeFileSync("docs/qa/audit/verify/seo/seo-05-reproduce.json", JSON.stringify({ summary, perPage }, null, 1));
