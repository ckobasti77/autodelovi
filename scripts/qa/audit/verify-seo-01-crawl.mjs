// Verifier for seo-01: crawl every product URL from the product sitemap (raw server HTML) and
// compare <title>/og:title/twitter:title against the H1, JSON-LD Product name and meta description.
import { writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = "docs/qa/audit/verify/seo";

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
const norm = (s) => s.replace(/[\s ]+/g, " ").trim();

const sm = await (await fetch(`${BASE}/sitemaps/proizvodi-1.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("http://localhost:3000", BASE));
const rows = [];
for (const url of urls) {
  const html = await (await fetch(url)).text();
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const og = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "");
  const tw = decode(html.match(/<meta name="twitter:title" content="([^"]*)"/)?.[1] ?? "");
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  const h1raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const h1 = norm(decode(h1raw.replace(/<[^>]+>/g, "")));
  let ldName = "";
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : j["@graph"] ?? [j];
      for (const o of arr) if (o["@type"] === "Product") ldName = o.name;
    } catch {}
  }
  const name = ldName || h1;
  const hasS = /s/.test(name);
  const titleStartsWithName = norm(title).startsWith(norm(name));
  rows.push({
    path: new URL(url).pathname,
    name,
    h1,
    title,
    og,
    tw,
    desc,
    hasS,
    titleOk: titleStartsWithName,
    ogSame: og === title,
    twSame: tw === title,
    descHasName: norm(desc).startsWith(norm(name)),
  });
}
const bad = rows.filter((r) => !r.titleOk);
const summary = {
  base: BASE,
  products: rows.length,
  namesWithLowercaseS: rows.filter((r) => r.hasS).length,
  titleNotStartingWithName: bad.length,
  badWithoutS: bad.filter((r) => !r.hasS).length,
  goodWithS: rows.filter((r) => r.hasS && r.titleOk).length,
  ogEqualsTitle: rows.filter((r) => r.ogSame).length,
  twEqualsTitle: rows.filter((r) => r.twSame).length,
  descStartsWithName: rows.filter((r) => r.descHasName).length,
  h1EqualsLdName: rows.filter((r) => r.h1 === r.name).length,
};
console.log(JSON.stringify(summary, null, 2));
for (const r of bad.slice(0, 8)) console.log(`${r.path}\n  name : ${r.name}\n  title: ${r.title}`);
writeFileSync(`${OUT}/seo-01-reproduce.json`, JSON.stringify({ summary, rows }, null, 2));
