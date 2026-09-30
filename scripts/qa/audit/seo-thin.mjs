/**
 * Step 21 QA audit, track "seo": word count of <main> (text nodes joined with spaces, scripts and
 * JSON-LD excluded, breadcrumb excluded) for every indexable URL in the crawl; lists pages < 150.
 *   node scripts/qa/audit/seo-thin.mjs -> docs/qa/audit/seo/thin-pages.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const crawl = JSON.parse(readFileSync(path.resolve("docs/qa/audit/seo/crawl.json"), "utf8"));
const urls = crawl.pages.filter((p) => !p.url.includes("?") && !/noindex/.test(p.robots ?? "")).map((p) => p.url);
const out = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    const d = new JSDOM(await (await fetch(BASE + u)).text()).window.document;
    const m = d.querySelector("main");
    m.querySelectorAll('script,style,nav[aria-label="Putanja"]').forEach((n) => n.remove());
    const walker = d.createTreeWalker(m, 4);
    const parts = [];
    while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
    const words = parts.join(" ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    out.push({ url: u, words, inSitemap: crawl.pages.find((p) => p.url === u)?.inSitemap ?? false });
  }
}
await Promise.all([worker(), worker()]);
out.sort((a, b) => a.words - b.words);
writeFileSync(path.resolve("docs/qa/audit/seo/thin-pages.json"), JSON.stringify(out, null, 1));
const thin = out.filter((r) => r.words < 150);
console.log(`indexable ${out.length}; < 150 words: ${thin.length}; < 60 words: ${out.filter((r) => r.words < 60).length}`);
for (const t of thin) console.log(t.words, t.url);
