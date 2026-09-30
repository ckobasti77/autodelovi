// Recount copy-05 excluding the grammatical attributive „za Škoda vozila“.
import { writeFileSync } from "node:fs";
import { BASE } from "./kit.mjs";
const to = (u) => u.replace("http://localhost:3000", BASE);
const get = async (u) => (await fetch(u)).text();
const idx = await get(`${BASE}/sitemap.xml`);
let urls = [];
for (const m of [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => to(x[1]))) {
  const x = await get(m);
  urls.push(...[...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((q) => to(q[1])));
}
urls = [...new Set(urls)].filter((u) => !u.endsWith(".xml"));
const brandOnly = new Set(), femModel = new Set(), inTitleOrH1 = new Set();
let attributive = 0;
for (const u of urls) {
  const r = await fetch(u); if (r.status !== 200) continue;
  const html = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, " ");
  const path = new URL(u).pathname;
  for (const m of html.matchAll(/\bza (Škoda|Cupra|SEAT)((?: [A-ZČĆŽŠĐ][\w-]*)?)( vozil)?/g)) {
    if (m[3]) { attributive++; continue; }
    const model = m[2].trim();
    if (/^(Škoda|Cupra)$/.test(m[1])) brandOnly.add(path);
    else if (/a$/.test(model)) femModel.add(path);
  }
  const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, "") || "";
  if (/za (Škoda|Cupra)\b|za SEAT \w+a\b/i.test(t + " " + h1)) inTitleOrH1.add(path);
}
const all = new Set([...brandOnly, ...femModel]);
const out = [
  `sitemap pages: ${urls.length}`,
  `pages with „za Škoda/Cupra …“ (brand not declined): ${brandOnly.size}`,
  `pages with only „za SEAT <feminine model>“: ${[...femModel].filter((p) => !brandOnly.has(p)).length}`,
  `total affected: ${all.size}`,
  `affected in <title> or <h1>: ${inTitleOrH1.size}`,
  `attributive „za Škoda vozila“ occurrences (grammatical, excluded): ${attributive}`,
  `by type: ${JSON.stringify([...all].reduce((a, p) => ((a[p.split("/")[1]] = (a[p.split("/")[1]] || 0) + 1), a), {}))}`,
];
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/copy/copy-05-reproduce-count.txt", out.join("\n"));
