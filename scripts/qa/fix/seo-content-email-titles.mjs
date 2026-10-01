// seo-content-email (step 22: COPY-01, SEO-01, SEO-03, SEO-04, SEO-07, COPY-05): crawls every
// URL of the sitemaps and checks the server-rendered metadata — titles ≤ 60 characters,
// unique, without „…“ and without a lost letter; descriptions never end a word with „…“;
// no doubled maker label; brands declined after „za“; no thin system / model hubs.
//
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/seo-content-email-titles.mjs
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/seo-content-email";
mkdirSync(OUT, { recursive: true });

const get = async (path, attempt = 1) => {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    return { status: res.status, location: res.headers.get("location"), text: await res.text() };
  } catch (error) {
    // The shared dev server recompiles under other agents' edits: retry a dropped connection.
    if (attempt >= 4) throw error;
    await new Promise((r) => setTimeout(r, 5000 * attempt));
    return get(path, attempt + 1);
  }
};
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname + new URL(m[1]).search);
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const pick = (html, re) => decode(re.exec(html)?.[1] ?? "");

const index = await get("/sitemap.xml");
const children = locs(index.text);
const urls = [];
for (const c of children) urls.push(...locs((await get(c)).text));

const pages = [];
const queue = [...urls];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const r = await get(path);
      const main = /<main[\s\S]*?<\/main>/.exec(r.text)?.[0] ?? "";
      const words = main
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<nav[^>]*aria-label="(?:Putanja|Breadcrumb)[^"]*"[\s\S]*?<\/nav>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .split(/\s+/)
        .filter((w) => /\p{L}/u.test(w)).length;
      pages.push({
        path,
        status: r.status,
        location: r.location,
        title: pick(r.text, /<title>([^<]*)<\/title>/),
        description: pick(r.text, /<meta name="description" content="([^"]*)"/),
        robots: pick(r.text, /<meta name="robots" content="([^"]*)"/),
        h1: pick(r.text, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
        words,
      });
    }
  }),
);

const ok = pages.filter((p) => p.status === 200);
const byTitle = new Map();
for (const p of ok) byTitle.set(p.title, [...(byTitle.get(p.title) ?? []), p.path]);
const BRAND_NOM = /\bza (?:Škoda|Cupra)\b|\bza (?:VW |SEAT |Škodu |Cupru )?(?:Octavia|Fabia|Ibiza|Ateca|Arona|Scala)\b/;
const issues = {
  non200: pages.filter((p) => p.status !== 200).map((p) => `${p.status} ${p.path} → ${p.location ?? ""}`),
  titleOver60: ok.filter((p) => p.title.length > 60).map((p) => `${p.title.length} ${p.path}`),
  titleEllipsis: ok.filter((p) => p.title.includes("…")).map((p) => `${p.path}: ${p.title}`),
  duplicateTitles: [...byTitle].filter(([, v]) => v.length > 1).map(([t, v]) => `${t} ← ${v.join(", ")}`),
  productTitleLostS: ok
    .filter((p) => p.path.startsWith("/deo/") && /\bdi k\b|\bčelju t\b| enzor|vi oko|tečno t/.test(p.title))
    .map((p) => p.path),
  descriptionCutWord: ok.filter((p) => /\S…/.test(p.description) || /\bi …/.test(p.description)).map((p) => `${p.path}: ${p.description}`),
  doubledMaker: ok.filter((p) => /\(([^,()]+), \1\)/.test(p.description)).map((p) => p.path),
  doubleI: ok.filter((p) => /\bi [^.]*\bi još\b/.test(p.description)).map((p) => `${p.path}: ${p.description}`),
  brandNominativeAfterZa: ok
    .filter((p) => BRAND_NOM.test(p.title) || BRAND_NOM.test(p.h1) || BRAND_NOM.test(p.description))
    .map((p) => `${p.path}: ${p.title} | ${p.h1}`),
  thinHubs: ok
    .filter((p) => /^\/(delovi\/[^/?]+|vozila(\/[^/]+){0,2})$/.test(p.path) && p.words < 60)
    .map((p) => `${p.words} ${p.path}`),
};
const summary = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length]));
console.log(JSON.stringify({ base: BASE, urls: urls.length, ok: ok.length, summary }, null, 1));
for (const [k, v] of Object.entries(issues)) if (v.length) console.log(k, JSON.stringify(v.slice(0, 8), null, 1));
writeFileSync(`${OUT}/titles-crawl.json`, JSON.stringify({ base: BASE, urls: urls.length, summary, issues, pages }, null, 1));
