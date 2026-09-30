// Independent verifier (skeptic) for seo-01: crawl every product URL from the product sitemap
// on :3100 and compare <title>/og:title/twitter:title with the H1, JSON-LD Product name.
import fs from "node:fs";
const BASE = process.env.AUDIT_BASE || "http://localhost:3100";
const OUT = "docs/qa/audit/verify/seo";
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const sm = await (await fetch(`${BASE}/sitemaps/proizvodi-1.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, BASE));
const rows = [];
for (const url of urls) {
  const html = await (await fetch(url)).text();
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const og = decode(html.match(/property="og:title" content="([^"]*)"/)?.[1] ?? "");
  const tw = decode(html.match(/name="twitter:title" content="([^"]*)"/)?.[1] ?? "");
  const desc = decode(html.match(/name="description" content="([^"]*)"/)?.[1] ?? "");
  let ldName = "";
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : j["@graph"] ?? [j];
      for (const x of arr) if (x["@type"] === "Product") ldName = x.name;
    } catch {}
  }
  rows.push({ url: url.replace(BASE, ""), title, og, tw, ldName, desc, status: 0 });
}
let bad = 0;
const badRows = [];
for (const r of rows) {
  const titleName = r.title.replace(/ \| SKLOP$/, "");
  const ok = r.ldName && titleName.startsWith(r.ldName.slice(0, Math.min(r.ldName.length, 20)));
  const hasS = /s/.test(r.ldName);
  r.ok = !!ok;
  r.hasLowerS = hasS;
  if (!ok) { bad++; badRows.push(r); }
}
const withS = rows.filter((r) => r.hasLowerS).length;
const badWithoutS = badRows.filter((r) => !r.hasLowerS).length;
const ogMismatch = rows.filter((r) => r.og !== r.title || r.tw !== r.title).length;
const summary = { total: rows.length, namesWithLowercaseS: withS, titleMismatch: bad, mismatchWithoutS: badWithoutS, ogOrTwitterDifferentFromTitle: ogMismatch };
console.log(JSON.stringify(summary, null, 2));
for (const r of badRows.slice(0, 6)) console.log(`${r.url}\n  LD:    ${r.ldName}\n  title: ${r.title}\n  og:    ${r.og}\n  tw:    ${r.tw}`);
fs.writeFileSync(`${OUT}/seo-01-skeptic-crawl.json`, JSON.stringify({ summary, rows }, null, 2));
// descriptions shortened with an ellipsis (line 88 vehicle list path)
const ell = rows.filter((r) => r.desc.includes("…"));
console.log("descriptions with shortened vehicle list:", ell.length);
for (const r of ell.slice(0, 5)) console.log("  ", r.url, "|", r.desc);
