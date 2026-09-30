/**
 * Step 21 QA audit — independent verification of seo-06 (thin hubs) and seo-07 (/kontakt orphan).
 * Crawls every URL of every sitemap (mapping :3000 -> BASE) plus non-sitemap public pages, parses the
 * server HTML (no JS) and records: status, robots meta, canonical, <main> word count (with and without
 * the breadcrumb), number of links inside <main>, and every href on the page (for inlinks).
 *   node scripts/qa/audit/verify-seo-06-07.mjs -> docs/qa/audit/verify/seo/seo-06-reproduce.json,
 *                                                docs/qa/audit/verify/seo/seo-07-reproduce.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/verify/seo");
mkdirSync(OUT, { recursive: true });

const toPath = (u) => u.replace(/^https?:\/\/[^/]+/, "") || "/";
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const index = await (await fetch(`${BASE}/sitemap.xml`)).text();
const sitemapUrls = [];
const bySitemap = {};
for (const sm of locs(index)) {
  const p = toPath(sm);
  const urls = locs(await (await fetch(BASE + p)).text()).map(toPath);
  bySitemap[p] = urls.length;
  for (const u of urls) sitemapUrls.push({ url: u, sitemap: p });
}

// Non-sitemap public pages (other layouts and states) for the inlink check.
const extra = [
  "/korpa",
  "/porudzbina",
  "/prijava",
  "/registracija",
  "/zaboravljena-lozinka",
  "/za-majstore/registracija",
  "/pretraga?q=disk",
  "/pretraga?q=5Q0615505R",
  "/ponuda/kocione-plocice-golf",
  "/ovo-ne-postoji",
  "/deo/kocione-plocice-prednje-demo-0012",
];

function words(node) {
  const doc = node.ownerDocument;
  const walker = doc.createTreeWalker(node, 4);
  const parts = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
  return parts
    .join(" ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

async function inspect(url) {
  const res = await fetch(BASE + url, { redirect: "manual" });
  const html = await res.text();
  const d = new JSDOM(html).window.document;
  const robots = d.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
  const canonical = toPath(d.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "");
  const hrefs = [...d.querySelectorAll("a[href]")].map((a) => {
    const h = a.getAttribute("href");
    return h.startsWith("http") ? toPath(h) : h;
  });
  const main = d.querySelector("main");
  let wordsWithCrumbs = null;
  let wordsNoCrumbs = null;
  let mainLinks = null;
  let h1 = null;
  let paragraphs = null;
  if (main) {
    main.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
    wordsWithCrumbs = words(main);
    main.querySelectorAll('nav[aria-label="Putanja"]').forEach((n) => n.remove());
    wordsNoCrumbs = words(main);
    mainLinks = main.querySelectorAll("a[href]").length;
    h1 = main.querySelector("h1")?.textContent.trim() ?? null;
    paragraphs = [...main.querySelectorAll("p")].map((p) => p.textContent.trim()).filter(Boolean).slice(0, 4);
  }
  return {
    url,
    status: res.status,
    robots,
    canonical,
    selfCanonical: canonical === url,
    wordsWithCrumbs,
    wordsNoCrumbs,
    mainLinks,
    h1,
    paragraphs,
    hrefs,
  };
}

const all = [...sitemapUrls.map((s) => s.url), "/", ...extra];
const uniq = [...new Set(all)];
const results = new Map();
let i = 0;
async function worker() {
  while (i < uniq.length) {
    const u = uniq[i++];
    try {
      results.set(u, await inspect(u));
    } catch (e) {
      results.set(u, { url: u, error: String(e) });
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

// ---- seo-06: thin indexable pages from the sitemaps
const rows = sitemapUrls.map(({ url, sitemap }) => {
  const r = results.get(url);
  return {
    url,
    sitemap,
    status: r.status,
    indexable: r.status === 200 && !/noindex/.test(r.robots) && r.selfCanonical,
    robots: r.robots,
    words: r.wordsNoCrumbs,
    wordsWithCrumbs: r.wordsWithCrumbs,
    mainLinks: r.mainLinks,
    h1: r.h1,
    paragraphs: r.paragraphs,
  };
});
const indexable = rows.filter((r) => r.indexable);
const under150 = indexable.filter((r) => r.words < 150).sort((a, b) => a.words - b.words);
const under60 = under150.filter((r) => r.words < 60);
const kinds = (r) =>
  r.url.startsWith("/delovi/")
    ? "system-or-category"
    : r.url === "/vozila"
      ? "vehicles-root"
      : /^\/vozila\/[^/]+$/.test(r.url)
        ? "brand-hub"
        : /^\/vozila\/[^/]+\/[^/]+$/.test(r.url)
          ? "model-hub"
          : /^\/vozila\//.test(r.url)
            ? "generation"
            : r.url.startsWith("/deo/")
              ? "product"
              : "other";
const byKind = {};
for (const r of under150) (byKind[kinds(r)] ??= []).push(`${r.words} ${r.url}`);

// Model hubs: how many generation links does each have?
const modelHubs = rows
  .filter((r) => /^\/vozila\/[^/]+\/[^/]+$/.test(r.url))
  .map((r) => {
    const gens = [...new Set(results.get(r.url).hrefs.filter((h) => h.startsWith(`${r.url}/`)))];
    return { url: r.url, words: r.words, generationLinks: gens };
  })
  .sort((a, b) => a.generationLinks.length - b.generationLinks.length);

const seo06 = {
  base: BASE,
  sitemaps: bySitemap,
  sitemapUrlCount: sitemapUrls.length,
  indexableCount: indexable.length,
  nonIndexableInSitemap: rows.filter((r) => !r.indexable).map((r) => ({ url: r.url, status: r.status, robots: r.robots })),
  under150Count: under150.length,
  under60Count: under60.length,
  byKind,
  singleGenerationModelHubs: modelHubs.filter((m) => m.generationLinks.length === 1),
  modelHubs,
  under150,
};
writeFileSync(path.join(OUT, "seo-06-reproduce.json"), JSON.stringify(seo06, null, 1));

// ---- seo-07: inlinks to /kontakt
const target = "/kontakt";
const linking = [];
for (const [u, r] of results) {
  if (!r.hrefs) continue;
  const n = r.hrefs.filter((h) => h === target || h.startsWith(`${target}?`) || h.startsWith(`${target}#`)).length;
  if (n > 0) linking.push({ from: u, count: n });
}
const seo07 = {
  base: BASE,
  pagesCrawled: results.size,
  kontaktInSitemap: sitemapUrls.some((s) => s.url === target),
  kontaktSitemap: sitemapUrls.find((s) => s.url === target)?.sitemap ?? null,
  kontaktStatus: results.get(target)?.status,
  kontaktRobots: results.get(target)?.robots,
  pagesLinkingToKontakt: linking,
  pagesLinkingToKontaktExcludingSelf: linking.filter((l) => l.from !== target),
  // For comparison: how many pages link to the other static pages?
  comparison: Object.fromEntries(
    ["/o-nama", "/dostava-i-placanje", "/reklamacije-i-povrat", "/uslovi-koriscenja", "/politika-privatnosti", "/kolacici", "/upit", "/za-majstore"].map(
      (p) => [p, [...results.values()].filter((r) => r.hrefs?.includes(p) && r.url !== p).length],
    ),
  ),
};
writeFileSync(path.join(OUT, "seo-07-reproduce.json"), JSON.stringify(seo07, null, 1));

console.log("sitemaps", bySitemap, "total", sitemapUrls.length, "indexable", indexable.length);
console.log(`<150: ${under150.length}  <60: ${under60.length}`);
for (const [k, v] of Object.entries(byKind)) console.log(k, v.length, v.join(" | "));
console.log("single-generation model hubs:", seo06.singleGenerationModelHubs.map((m) => `${m.url} -> ${m.generationLinks[0]}`).join(", "));
console.log("kontakt:", JSON.stringify({ inSitemap: seo07.kontaktInSitemap, sm: seo07.kontaktSitemap, crawled: seo07.pagesCrawled, linking: seo07.pagesLinkingToKontakt, comparison: seo07.comparison }));
