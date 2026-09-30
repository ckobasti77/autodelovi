// Verifier for copy-01: crawls every product URL in the product sitemap and compares the
// server-rendered <title>/og:title/twitter:title/meta description with the H1 (product name).
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/verify/copy");
mkdirSync(OUT, { recursive: true });

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const pick = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]) : null;
};

const sm = await (await fetch(`${BASE}/sitemaps/proizvodi-1.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace("http://localhost:3000", BASE),
);
console.log("product urls in sitemap:", urls.length);

const rows = [];
for (const url of urls) {
  const res = await fetch(url);
  const html = await res.text();
  const title = pick(html, /<title>([^<]*)<\/title>/);
  const og = pick(html, /<meta property="og:title" content="([^"]*)"/);
  const tw = pick(html, /<meta name="twitter:title" content="([^"]*)"/);
  const desc = pick(html, /<meta name="description" content="([^"]*)"/);
  const h1raw = pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1 = h1raw ? h1raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
  rows.push({ url: url.replace(BASE, ""), status: res.status, h1, title, og, tw, desc });
}

// Name part of the title = title minus suffix and code; a title is "broken" when the H1 has an
// "s" but the title does not contain the H1's first word containing "s".
const broken = rows.filter((r) => {
  if (!r.h1 || !r.title) return false;
  const words = r.h1.split(" ").filter((w) => /s/.test(w) && w.length > 1);
  return words.some((w) => !r.title.includes(w) && r.title.includes(w.replace(/s+/g, " ")));
});
const titleNoS = rows.filter((r) => r.h1 && /s/.test(r.h1) && r.title && !/[a-zčćžšđ]s|s[a-zčćžšđ]/i.test(r.title.replace(/ \| SKLOP$/, "").replace(/SKLOP/g, "")));
const ogMismatch = rows.filter((r) => r.og !== r.title && r.og !== r.title?.replace(/ \| SKLOP$/, ""));
const cutDesc = rows.filter((r) => r.desc && r.desc.includes("…"));
const dangling = cutDesc.filter((r) => {
  const m = r.desc.match(/ za (.*?)… /);
  if (!m) return false;
  const v = m[1];
  const last = v.split(/[\s,]+/).pop();
  return /\s(i|,)?$/.test(v) || / i$/.test(v) || /,$/.test(v) || (last && last.length <= 3 && !/^(II|III|IV|V|VI|VII|VIII|B\d|A\d|8P|8V)$/.test(last));
});

const report = {
  base: BASE,
  at: new Date().toISOString(),
  total: rows.length,
  brokenTitles: broken.length,
  ogEqualsTitleBroken: broken.filter((r) => r.og && !r.og.includes(r.h1.split(" ").find((w) => /s/.test(w)) ?? "")).length,
  descriptionsWithEllipsis: cutDesc.length,
  danglingCandidates: dangling.length,
  examples: broken.slice(0, 12).map(({ url, h1, title, og, tw }) => ({ url, h1, title, og, tw })),
  descExamples: cutDesc.map(({ url, desc }) => ({ url, desc })),
};
writeFileSync(path.join(OUT, "copy-01-reproduce.json"), JSON.stringify({ report, rows }, null, 2));
console.log(JSON.stringify({ ...report, descExamples: report.descExamples.slice(0, 40) }, null, 2));
