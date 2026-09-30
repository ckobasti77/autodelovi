// Independent verifier crawl (seo-02, seo-04): fetch every sitemap URL (3000 -> 3100) and
// record status, title, description, robots, canonical.
import { writeFileSync } from "node:fs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const map = (u) => u.replace("http://localhost:3000", BASE);
const dec = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function text(u) { const r = await fetch(u); return { status: r.status, body: await r.text() }; }
const idx = (await text(`${BASE}/sitemap.xml`)).body;
const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => map(m[1]));
const urls = [];
for (const sm of maps) {
  const b = (await text(sm)).body;
  for (const m of b.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push({ sitemap: sm.split("/").pop(), url: map(dec(m[1])) });
}
const out = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    const { status, body } = await text(u.url);
    const g = (re) => { const m = body.match(re); return m ? dec(m[1]) : null; };
    out.push({ ...u, status,
      title: g(/<title>([^<]*)<\/title>/),
      description: g(/<meta name="description" content="([^"]*)"/),
      robots: g(/<meta name="robots" content="([^"]*)"/),
      canonical: g(/<link rel="canonical" href="([^"]*)"/) });
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
out.sort((a, b) => a.url.localeCompare(b.url));
writeFileSync(process.argv[2], out.map((o) => JSON.stringify(o)).join("\n") + "\n");
const byTitle = new Map();
for (const o of out) { if (!o.title) continue; (byTitle.get(o.title) ?? byTitle.set(o.title, []).get(o.title)).push(o.url.replace(BASE, "")); }
const dups = [...byTitle].filter(([, v]) => v.length > 1);
console.log("urls", out.length, "by sitemap", Object.fromEntries(Object.entries(out.reduce((a, o) => ((a[o.sitemap] = (a[o.sitemap] ?? 0) + 1), a), {}))));
console.log("non-200", out.filter((o) => o.status !== 200).length, "noindex", out.filter((o) => o.robots && o.robots.includes("noindex")).length);
console.log("duplicate titles:", dups.length); for (const [t, v] of dups) console.log("  ", JSON.stringify(t), v);
const ell = out.filter((o) => o.title && o.title.includes("…"));
console.log("titles with ellipsis:", ell.length); for (const o of ell) console.log("  ", o.sitemap, o.url.replace(BASE, ""), JSON.stringify(o.title), o.title.length);
const over = out.filter((o) => o.title && o.title.length > 60); console.log("titles > 60:", over.length);
const byDesc = new Map();
for (const o of out) { if (!o.description) continue; (byDesc.get(o.description) ?? byDesc.set(o.description, []).get(o.description)).push(o.url.replace(BASE, "")); }
console.log("duplicate descriptions:", [...byDesc].filter(([, v]) => v.length > 1).length);
