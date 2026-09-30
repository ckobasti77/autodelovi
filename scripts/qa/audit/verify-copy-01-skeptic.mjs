// Verifier (skeptic) for copy-01: crawls every product URL in the product sitemap on BASE and
// compares <title>/og:title/twitter:title with the H1 text, and checks meta descriptions for
// mid-word cuts before the ellipsis. Pure HTTP (server-rendered head), no browser needed.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const sm = await (await fetch(`${BASE}/sitemaps/proizvodi-1.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
  m[1].replace("http://localhost:3000", BASE),
);
console.log("product urls", urls.length);

const rows = [];
for (const url of urls) {
  const html = await (await fetch(url)).text();
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const og = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? "");
  const tw = decode(html.match(/<meta name="twitter:title" content="([^"]*)"/)?.[1] ?? "");
  const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  const h1raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const h1 = decode(h1raw.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  // JSON-LD Product name/description
  const ld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const product = ld.flatMap((x) => (Array.isArray(x) ? x : x["@graph"] ?? [x])).find((x) => x["@type"] === "Product");
  const titleName = title.replace(/ \| SKLOP$/, "");
  const nameLostS = h1.includes("s") && !titleName.startsWith(h1.slice(0, Math.min(h1.length, 20))) && h1.replace(/s+/g, " ").trim().slice(0, 15) === titleName.slice(0, 15);
  const ellipsis = desc.includes("…");
  const beforeEllipsis = ellipsis ? desc.split("…")[0] : "";
  rows.push({
    url: url.replace(BASE, ""),
    h1,
    title,
    ogEqualsTitle: og === title,
    twEqualsTitle: tw === title,
    titleContainsH1: title.includes(h1),
    h1HasLowerS: /s/.test(h1),
    nameLostS,
    desc,
    ellipsis,
    beforeEllipsis: beforeEllipsis.slice(-40),
    ldName: product?.name ?? null,
    ldDescription: product?.description ?? null,
  });
}

const lostS = rows.filter((r) => r.nameLostS);
const hasS = rows.filter((r) => r.h1HasLowerS);
const ell = rows.filter((r) => r.ellipsis);
const ldDescCut = rows.filter((r) => r.ldDescription && r.ldDescription.includes("…"));
const summary = {
  base: BASE,
  products: rows.length,
  h1WithLowercaseS: hasS.length,
  titlesMissingLowercaseS: lostS.length,
  hasSButTitleOk: hasS.filter((r) => !r.nameLostS).map((r) => ({ url: r.url, h1: r.h1, title: r.title })),
  ogTitleMismatch: rows.filter((r) => !r.ogEqualsTitle).length,
  twTitleMismatch: rows.filter((r) => !r.twEqualsTitle).length,
  descriptionsWithEllipsis: ell.length,
  jsonLdDescriptionsWithEllipsis: ldDescCut.length,
  jsonLdNameEqualsH1: rows.filter((r) => r.ldName === r.h1).length,
};
console.log(JSON.stringify(summary, null, 2));

const lines = [
  `copy-01 skeptic verification — ${new Date().toISOString()} — ${BASE}`,
  JSON.stringify(summary, null, 2),
  "",
  "== Titles that lost the lowercase s (h1 → <title>) ==",
  ...lostS.map((r) => `${r.url}\n  H1:    ${r.h1}\n  title: ${r.title}`),
  "",
  "== Descriptions with an ellipsis (last 40 chars before …) ==",
  ...ell.map((r) => `${r.url}\n  …${r.beforeEllipsis}|…\n  full: ${r.desc}`),
];
writeFileSync(`${OUT}/copy-01-skeptic.txt`, lines.join("\n"));
writeFileSync(`${OUT}/copy-01-skeptic.json`, JSON.stringify({ summary, rows }, null, 2));
