/**
 * Step 21 QA audit, track "seo": BreadcrumbList JSON-LD vs the visible breadcrumb (nav „Putanja“)
 * on every indexable, parameter-free URL of the crawl (docs/qa/audit/seo/crawl.json). 2 concurrent.
 *   node scripts/qa/audit/seo-breadcrumbs.mjs -> docs/qa/audit/seo/breadcrumbs.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const crawl = JSON.parse(readFileSync(path.resolve("docs/qa/audit/seo/crawl.json"), "utf8"));
const urls = crawl.pages.filter((p) => !p.url.includes("?") && p.status === 200 && !/noindex/.test(p.robots ?? "")).map((p) => p.url);
const res = [];
let i = 0;
async function worker() {
  while (i < urls.length) {
    const u = urls[i++];
    const d = new JSDOM(await (await fetch(BASE + u)).text()).window.document;
    const lds = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
      const j = JSON.parse(s.textContent);
      return Array.isArray(j) ? j : [j];
    });
    const bl = lds.find((x) => x["@type"] === "BreadcrumbList");
    const nav = d.querySelector('nav[aria-label="Putanja"]');
    const vis = nav ? [...nav.querySelectorAll("li")].map((li) => li.textContent.replace(/\s+/g, " ").replace(/\s*\/\s*$/, "").trim()) : null;
    const ld = bl ? bl.itemListElement.map((x) => x.name) : null;
    const ldItems = bl ? bl.itemListElement.map((x) => x.item ?? null) : null;
    const lastHasItem = ldItems ? ldItems[ldItems.length - 1] !== null : null;
    const positionsOk = bl ? bl.itemListElement.every((x, k) => x.position === k + 1) : null;
    res.push({ url: u, ld, vis, match: JSON.stringify(ld) === JSON.stringify(vis), lastHasItem, positionsOk });
  }
}
await Promise.all([worker(), worker()]);
writeFileSync(path.resolve("docs/qa/audit/seo/breadcrumbs.json"), JSON.stringify(res, null, 1));
const bad = res.filter((r) => !r.match);
console.log(`checked ${res.length}; mismatches ${bad.length}; no JSON-LD ${res.filter((r) => !r.ld).length}; no visible ${res.filter((r) => !r.vis).length}`);
for (const b of bad.slice(0, 25)) console.log(b.url, "| ld:", JSON.stringify(b.ld), "| vis:", JSON.stringify(b.vis));
