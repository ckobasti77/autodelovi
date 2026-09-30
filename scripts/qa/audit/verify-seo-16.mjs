// Verify seo-16: near-duplicate twin pages. Independent method: <main> text 5-word shingles (Jaccard),
// plus 3-word shingles, containment, the set of product links (/deo/...) in <main>, H1/title/description,
// robots and canonical, and whether the twin pages link to each other.
import { JSDOM } from "jsdom";
import { writeFileSync } from "node:fs";
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const pairs = (process.argv.slice(2).length ? process.argv.slice(2) : [
  "/vozila/seat/ateca/ateca", "/vozila/cupra/ateca/cupra-ateca",
  "/delovi/kocione-plocice/seat/ateca", "/delovi/kocione-plocice/cupra/ateca",
  "/vozila/volkswagen/golf/golf-7", "/vozila/skoda/octavia/octavia-3",
  "/vozila/audi/a3/a3-8v", "/vozila/seat/leon/leon-3",
  "/delovi/kocioni-diskovi/volkswagen/golf", "/delovi/kocioni-diskovi/skoda/octavia",
]);
const get = async (p) => {
  const res = await fetch(BASE + p);
  const html = await res.text();
  const d = new JSDOM(html).window.document;
  const m = d.querySelector("main");
  const links = m ? [...m.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) : [];
  m?.querySelectorAll("script,style").forEach((n) => n.remove());
  return {
    status: res.status,
    title: d.title,
    h1: d.querySelector("h1")?.textContent.trim(),
    desc: d.querySelector('meta[name="description"]')?.content,
    robots: d.querySelector('meta[name="robots"]')?.content,
    canonical: d.querySelector('link[rel="canonical"]')?.href,
    text: m ? m.textContent.replace(/\s+/g, " ").trim() : "",
    products: new Set(links.filter((h) => h.startsWith("/deo/"))),
    links: new Set(links),
  };
};
const words = (t) => t.toLowerCase().replace(/[^a-zčćžšđ0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const sh = (w, k) => new Set(w.map((_, i) => w.slice(i, i + k).join(" ")).slice(0, Math.max(0, w.length - k + 1)));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return { j: i / (a.size + b.size - i), inter: i }; };
const out = [];
for (let i = 0; i + 1 < pairs.length; i += 2) {
  const [A, B] = [await get(pairs[i]), await get(pairs[i + 1])];
  const [wa, wb] = [words(A.text), words(B.text)];
  const j5 = jac(sh(wa, 5), sh(wb, 5));
  const j3 = jac(sh(wa, 3), sh(wb, 3));
  const pj = jac(A.products, B.products);
  const onlyA = [...new Set(wa)].filter((w) => !wb.includes(w));
  const onlyB = [...new Set(wb)].filter((w) => !wa.includes(w));
  const crossAB = [...A.links].some((h) => h === pairs[i + 1]);
  const crossBA = [...B.links].some((h) => h === pairs[i]);
  out.push([
    `${pairs[i]} vs ${pairs[i + 1]}`,
    `  status ${A.status}/${B.status}; robots "${A.robots}" / "${B.robots}"; canonical ${A.canonical} / ${B.canonical}`,
    `  words ${wa.length}/${wb.length}; jaccard 5-shingle ${j5.j.toFixed(2)}; 3-shingle ${j3.j.toFixed(2)}; product links ${A.products.size}/${B.products.size}, shared ${pj.inter} (jaccard ${pj.j.toFixed(2)})`,
    `  H1: "${A.h1}" / "${B.h1}"`,
    `  title: "${A.title}" / "${B.title}"`,
    `  desc A: ${A.desc}`,
    `  desc B: ${B.desc}`,
    `  cross-link A->B ${crossAB}, B->A ${crossBA}`,
    `  words only in A (${onlyA.length}): ${onlyA.join(" ").slice(0, 300)}`,
    `  words only in B (${onlyB.length}): ${onlyB.join(" ").slice(0, 300)}`,
  ].join("\n"));
}
const txt = out.join("\n\n");
console.log(txt);
writeFileSync("docs/qa/audit/verify/seo/seo-16-reproduce.txt", `seo-16 reproduce — ${new Date().toISOString()} — ${BASE}\n\n${txt}\n`);
