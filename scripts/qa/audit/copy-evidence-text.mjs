/**
 * Copy track: writes text evidence per finding from the crawl JSONs (docs/qa/audit/copy/ev-*.txt).
 *   node scripts/qa/audit/copy-evidence-text.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
const load = (f) => JSON.parse(readFileSync(`docs/qa/audit/copy/${f}`, "utf8")).results.filter((r) => r.text);
const site = load("crawl-sitemap.json");
const anon = load("crawl-anon1440.json");
const w = (name, s) => writeFileSync(`docs/qa/audit/copy/${name}`, s);

// copy-01 product titles / descriptions
{
  const pr = site.filter((r) => r.url.startsWith("/deo/"));
  const bad = pr.filter((r) => (r.title.replace(/ \| SKLOP$/, "").match(/s/g) ?? []).length < ((r.h1[0] ?? "").match(/s/g) ?? []).length);
  const desc = pr.filter((r) => /… Cena/.test(r.description ?? ""));
  let s = `Product pages: ${pr.length}; <title>/og:title missing letters "s": ${bad.length}; descriptions with a cut vehicle list: ${desc.length}\n\nH1 → <title>\n`;
  for (const r of bad) s += `${r.url}\n  H1:    ${r.h1[0]}\n  title: ${r.title}\n  og:    ${r.ogTitle}\n`;
  s += `\nDescriptions\n`;
  for (const r of desc) s += `${r.url}\n  ${r.description}\n`;
  w("ev-01-product-titles.txt", s);
}
// generic line finder
function find(pages, re) {
  const m = new Map();
  for (const p of pages)
    for (const l of [...p.text.split("\n"), p.title ?? "", p.description ?? "", ...(p.h1 ?? [])]) {
      const t = l.trim();
      if (t && re.test(t)) (m.get(t) ?? m.set(t, new Set()).get(t)).add(p.url);
    }
  return [...m].map(([l, u]) => `${l}\n    ↳ ${u.size} page(s): ${[...u].slice(0, 6).join(" ")}${u.size > 6 ? " …" : ""}`).join("\n");
}
w("ev-05-brand-declension.txt", find(site, /\bza (Škoda|Cupra|ŠKODA|CUPRA)\b/i));
w("ev-08-warranty.txt", find(site, /^\d+ meseci$/));
w("ev-10-landing-double-i.txt", find(site, /\) i [^,]+ \(\d+\) i još \d+/));
w("ev-02-contact-promises.txt", find(anon, /pozovete|Pozovite, pišite|stranice Kontakt|stranici Kontakt|Navedite njen broj|adresu prodavca/));
w("ev-03-14h.txt", find(anon, /14 časova/));
w("ev-20-content-descriptions.txt", site.filter((r) => ["/o-nama", "/kontakt", "/dostava-i-placanje", "/reklamacije-i-povrat", "/uslovi-koriscenja", "/politika-privatnosti", "/kolacici"].includes(r.url)).map((r) => `${r.url}\n  ${r.description}`).join("\n"));
w("ev-14-original-vag.txt", find(site, /Original VAG[,·] Original VAG|\(Original VAG, Original VAG\)/));
console.log("done");
