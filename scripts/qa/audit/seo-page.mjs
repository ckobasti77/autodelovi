/**
 * Step 21 QA audit, track "seo": prints the SEO-relevant facts of the raw server HTML of the given
 * paths (status, robots, canonical, title, H1, product cards, ItemList size, pagination text, empty
 * state, prev/next links). Appends to docs/qa/audit/seo/page-facts.jsonl.
 *   node scripts/qa/audit/seo-page.mjs "/delovi/kocioni-diskovi?strana=99" ...
 */
import { appendFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
for (const p of process.argv.slice(2)) {
  const res = await fetch(BASE + p, { redirect: "manual", headers: { "user-agent": "SklopAudit-seo" } });
  const html = await res.text();
  const d = new JSDOM(html).window.document;
  const main = d.querySelector("main");
  const text = (main?.textContent ?? "").replace(/\s+/g, " ");
  const lds = [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => {
    const j = JSON.parse(s.textContent);
    return Array.isArray(j) ? j : [j];
  });
  const itemList = lds.find((x) => x["@type"] === "ItemList");
  const cards = new Set(
    [...(main?.querySelectorAll('[data-testid="product-card"] a[href^="/deo/"]') ?? [])].map((a) => a.getAttribute("href")),
  );
  const pageLinks = [...(main?.querySelectorAll("a[href*='strana=']") ?? [])].map((a) => a.getAttribute("href"));
  const fact = {
    path: p,
    status: res.status,
    location: res.headers.get("location"),
    xRobots: res.headers.get("x-robots-tag"),
    robots: d.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    canonical: d.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    title: d.querySelector("title")?.textContent ?? null,
    description: d.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
    h1: [...d.querySelectorAll("h1")].map((h) => h.textContent.replace(/\s+/g, " ").trim()),
    cards: cards.size,
    firstCards: [...cards].slice(0, 3),
    itemList: itemList ? itemList.itemListElement.length : null,
    itemListFirst: itemList?.itemListElement?.[0]?.url ?? null,
    pageLinks,
    ldTypes: lds.map((x) => x["@type"]),
    words: text ? text.split(" ").length : 0,
    snippet: text.slice(0, 300),
  };
  appendFileSync(path.resolve("docs/qa/audit/seo/page-facts.jsonl"), `${JSON.stringify(fact)}\n`);
  console.log(JSON.stringify(fact, null, 1));
}
