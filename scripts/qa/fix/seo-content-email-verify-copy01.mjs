// Step 22 independent re-verification of COPY-01 (package seo-content-email). Crawls every
// product URL of the product sitemap(s) and checks, per page, against the data the page itself
// carries (H1, RSC payload manufacturerName / oemPrimary / fitmentSummary):
//  - <title> == og:title == twitter:title, ≤ 60 characters, no „…“;
//  - every word of the title comes from the H1, the manufacturer, the code or the suffix (a lost
//    or mangled letter shows up as an unknown word), and the name part is a word prefix of the H1;
//  - the meta description is ≤ 155, has no „…“, no dangling „i“, and its vehicle list names the
//    first N vehicles of the stored fitment summary (declined) and counts the rest exactly.
//
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/seo-content-email-verify-copy01.mjs
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/seo-content-email/verify";
mkdirSync(OUT, { recursive: true });

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
const pick = (html, re) => decode(re.exec(html)?.[1] ?? "");
const rsc = (html, key) => {
  const m = new RegExp(`\\\\"${key}\\\\":(null|\\\\"(.*?)\\\\")`).exec(html);
  return m ? (m[1] === "null" ? null : m[2].replace(/\\\\u0026/g, "&")) : undefined;
};
const get = async (path, attempt = 1) => {
  try {
    const res = await fetch(`${BASE}${path}`);
    return { status: res.status, text: await res.text() };
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((r) => setTimeout(r, 4000 * attempt));
    return get(path, attempt + 1);
  }
};
const locs = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

// Mirror of the accusative rule, used only to compare names (not to judge grammar).
const acc = (s) =>
  s.replace(
    /(^|[\s(])(\p{Lu}\p{Ll}+)a(?=$|[\s),.])/gu,
    (_, b, stem) => `${b}${stem}${stem.endsWith("i") ? "ju" : "u"}`,
  );

const index = await get("/sitemap.xml");
const productMaps = locs(index.text).filter((p) => /proizvod/.test(p));
const urls = [];
for (const m of productMaps) urls.push(...locs((await get(m)).text));
console.log("product sitemaps", productMaps, "urls", urls.length);

const rows = [];
const queue = [...urls];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const r = await get(path);
      const html = r.text;
      const title = pick(html, /<title>([^<]*)<\/title>/);
      const og = pick(html, /<meta property="og:title" content="([^"]*)"/);
      const tw = pick(html, /<meta name="twitter:title" content="([^"]*)"/);
      const desc = pick(html, /<meta name="description" content="([^"]*)"/);
      const h1 = pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const maker = rsc(html, "manufacturerName") ?? "";
      const oem = rsc(html, "oemPrimary");
      const summary = rsc(html, "fitmentSummary");
      const ldMpn = /"@type":"Product"[^]*?"mpn":"([^"]*)"/.exec(html)?.[1] ?? null;
      // The code the template used is the one the description names („Kat. br. X.“).
      const code = /Kat\. br\. (.+)\.$/.exec(decode(/<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ""))?.[1] ?? oem ?? ldMpn ?? "";
      rows.push({ path, status: r.status, title, og, tw, desc, h1, maker, code, summary });
    }
  }),
);

const problems = [];
for (const r of rows) {
  const p = [];
  if (r.status !== 200) p.push(`status ${r.status}`);
  if (r.og !== r.title) p.push("og:title != title");
  if (r.tw !== r.title) p.push("twitter:title != title");
  if (r.title.length > 60) p.push(`title ${r.title.length} > 60`);
  if (r.title.includes("…")) p.push("title has …");
  const t = r.title.replace(/ \| SKLOP$/, "");
  const bareWord = (w) => w.replace(/[,.;:()]+/g, "");
  const source = new Set(`${r.h1} ${r.maker} ${r.code}`.split(/\s+/).map(bareWord));
  const unknown = t.split(/\s+/).map(bareWord).filter((w) => w && !source.has(w));
  if (unknown.length) p.push(`title words not in H1/maker/code: ${JSON.stringify(unknown)}`);
  // Name part = title minus trailing maker/code.
  let namePart = t;
  if (r.code && namePart.endsWith(` ${r.code}`)) namePart = namePart.slice(0, -r.code.length - 1);
  if (r.maker && namePart.endsWith(` ${r.maker}`)) namePart = namePart.slice(0, -r.maker.length - 1);
  const h1Bare = r.h1.replace(/\s*\([^)]*\)/g, "").trim();
  const isPrefix = (full) =>
    full === namePart ||
    (full.startsWith(namePart) && /^[,;:]? /.test(full.slice(namePart.length)));
  if (!isPrefix(r.h1) && !isPrefix(h1Bare)) p.push(`name part not a word prefix of H1: «${namePart}»`);
  if (namePart !== r.h1) r.shortened = true;
  if (!t.includes(r.maker)) r.makerDropped = true;
  if (r.code && !t.endsWith(r.code)) p.push("code missing / cut");
  // Description.
  if (r.desc.length > 155) p.push(`description ${r.desc.length} > 155`);
  if (r.desc.includes("…")) p.push("description has …");
  if (/\s(i|i još)\s*[.…]/.test(r.desc)) p.push("dangling i");
  if (r.summary) {
    const m = /^(.*?)(?:\s+i\s+još\s+(\d+))?\s*$/.exec(r.summary);
    const items = m[1].split(/,\s*/).filter(Boolean);
    const total = items.length + Number(m[2] ?? 0);
    const za = /\) za (.+?)\. (?:Cena|Na stanju\.|Trenutno nije|Po porudžbini\.|Kat\. br\.)/.exec(r.desc);
    if (!za) {
      r.vehicles = null;
      r.vehiclesDropped = true;
    } else {
      const v = za[1];
      const more = / i još (\d+)$/.exec(v);
      const namedStr = more ? v.slice(0, more.index) : v;
      const named = more ? namedStr.split(", ") : namedStr.split(/, | i /);
      const expected = items.slice(0, named.length).map(acc);
      if (JSON.stringify(named) !== JSON.stringify(expected))
        p.push(`vehicles ${JSON.stringify(named)} != ${JSON.stringify(expected)}`);
      const counted = named.length + (more ? Number(more[1]) : 0);
      if (counted !== total) p.push(`vehicle count ${counted} != ${total} (${r.summary})`);
      r.vehicles = v;
    }
  }
  if (p.length) problems.push({ path: r.path, title: r.title, desc: r.desc, h1: r.h1, problems: p });
  r.problems = p;
}

const summaryOut = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  products: rows.length,
  non200: rows.filter((r) => r.status !== 200).length,
  h1WithLowercaseS: rows.filter((r) => /s/.test(r.h1)).length,
  titlesWithProblems: problems.length,
  titlesShortened: rows.filter((r) => r.shortened).length,
  titlesMakerDropped: rows.filter((r) => r.makerDropped).length,
  descriptionsWithSummary: rows.filter((r) => r.summary).length,
  descriptionsVehiclesDropped: rows.filter((r) => r.vehiclesDropped).length,
  descriptionsMax: Math.max(...rows.map((r) => r.desc.length)),
  titleMax: Math.max(...rows.map((r) => r.title.length)),
};
console.log(JSON.stringify(summaryOut, null, 1));
for (const x of problems.slice(0, 20)) console.log(JSON.stringify(x));
const shortened = rows
  .filter((r) => r.shortened || r.makerDropped || r.vehiclesDropped)
  .map((r) => ({ path: r.path, h1: r.h1, title: r.title, desc: r.desc }));
writeFileSync(
  `${OUT}/copy01-crawl.json`,
  JSON.stringify({ summary: summaryOut, problems, shortened, rows }, null, 1),
);
