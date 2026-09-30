/**
 * Step 21 QA audit, track "seo": crawl of the local production build (no JS, raw server HTML).
 * Seeds: every URL of /sitemap.xml (children), home, and internal links discovered on crawled pages
 * (BFS). Max 2 concurrent requests. Query-string URLs are crawled up to a cap (facets, pagination).
 *
 *   node scripts/qa/audit/seo-crawl.mjs            -> docs/qa/audit/seo/crawl.json + crawl.csv
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const SITE = "http://localhost:3000"; // NEXT_PUBLIC_SITE_URL in .env.local
const OUT = path.resolve("docs/qa/audit/seo");
mkdirSync(OUT, { recursive: true });
const UA = "Mozilla/5.0 (compatible; SklopAudit-seo/1.0; +audit)";
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 700);
const MAX_QUERY_URLS = Number(process.env.MAX_QUERY_URLS ?? 80);
const SKIP = [/^\/admin/, /^\/api\//, /^\/nalog/, /^\/majstor(\/|$)/, /^\/_next\//, /^\/slike\//, /^\/feeds\//];

const toLocal = (u) => u.replace(SITE, BASE);
const toSite = (u) => u.replace(BASE, SITE);

async function fetchRaw(url) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: "manual", headers: { "user-agent": UA, accept: "text/html,*/*" } });
  const body = await res.text();
  return { res, body, ms: Date.now() - t0 };
}

async function fetchFollow(url) {
  const chain = [];
  let cur = url;
  for (let i = 0; i < 6; i++) {
    const r = await fetchRaw(cur);
    if (r.res.status >= 300 && r.res.status < 400 && r.res.headers.get("location")) {
      chain.push({ url: cur, status: r.res.status, location: r.res.headers.get("location") });
      cur = new URL(r.res.headers.get("location"), cur).toString();
      continue;
    }
    return { ...r, chain, finalUrl: cur };
  }
  return { res: null, body: "", chain, finalUrl: cur, ms: 0 };
}

async function sitemapUrls() {
  const idx = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const children = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toLocal(m[1]));
  const urls = [];
  const bySitemap = {};
  for (const c of children) {
    const xml = await (await fetch(c)).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => toLocal(m[1].replaceAll("&amp;", "&")));
    bySitemap[c.replace(BASE, "")] = locs.map((u) => u.replace(BASE, ""));
    urls.push(...locs);
  }
  return { urls, bySitemap };
}

function textOf(el) {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parse(html, url) {
  const dom = new JSDOM(html);
  const d = dom.window.document;
  const meta = (sel) => d.querySelector(sel)?.getAttribute("content") ?? null;
  const title = d.querySelector("head > title")?.textContent ?? null;
  const titles = d.querySelectorAll("title").length;
  const canonicals = [...d.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href"));
  const h = [...d.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((e) => ({ l: Number(e.tagName[1]), t: textOf(e).slice(0, 120) }));
  const jsonld = [];
  for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      jsonld.push(JSON.parse(s.textContent));
    } catch (e) {
      jsonld.push({ __parseError: String(e).slice(0, 200), raw: s.textContent.slice(0, 200) });
    }
  }
  const links = [];
  for (const a of d.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    let abs;
    try {
      abs = new URL(href, url).toString();
    } catch {
      continue;
    }
    links.push({ href: abs, rel: a.getAttribute("rel") ?? "", text: textOf(a).slice(0, 60), aria: a.getAttribute("aria-label") ?? "" });
  }
  const imgs = [...d.querySelectorAll("img")].map((i) => ({
    src: (i.getAttribute("src") ?? "").slice(0, 160),
    alt: i.hasAttribute("alt") ? i.getAttribute("alt") : null,
    w: i.getAttribute("width"),
    h: i.getAttribute("height"),
    loading: i.getAttribute("loading"),
    fetchpriority: i.getAttribute("fetchpriority"),
  }));
  const main = d.querySelector("main");
  const mainClone = main?.cloneNode(true);
  mainClone?.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
  const mainText = textOf(mainClone);
  const og = {};
  for (const m of d.querySelectorAll('meta[property^="og:"]')) og[m.getAttribute("property")] = m.getAttribute("content");
  const tw = {};
  for (const m of d.querySelectorAll('meta[name^="twitter:"]')) tw[m.getAttribute("name")] = m.getAttribute("content");
  const breadcrumbNav = d.querySelector('nav[aria-label*="Putanja" i], nav[aria-label*="breadcrumb" i], nav[aria-label*="Mrvice" i]');
  return {
    lang: d.documentElement.getAttribute("lang"),
    title,
    titles,
    description: meta('meta[name="description"]'),
    descriptions: d.querySelectorAll('meta[name="description"]').length,
    robots: meta('meta[name="robots"]'),
    googlebot: meta('meta[name="googlebot"]'),
    viewport: meta('meta[name="viewport"]'),
    canonicals,
    hreflang: [...d.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => `${l.getAttribute("hreflang")} ${l.getAttribute("href")}`),
    prevNext: [...d.querySelectorAll('link[rel="prev"],link[rel="next"]')].map((l) => `${l.getAttribute("rel")} ${l.getAttribute("href")}`),
    h1: h.filter((x) => x.l === 1).map((x) => x.t),
    headings: h,
    og,
    tw,
    jsonld,
    links,
    imgs,
    mainWords: mainText ? mainText.split(" ").length : 0,
    mainText: mainText.slice(0, 4000),
    breadcrumbVisible: breadcrumbNav ? [...breadcrumbNav.querySelectorAll("a,li,span[aria-current]")].map(textOf).filter(Boolean) : null,
    breadcrumbLabel: breadcrumbNav?.getAttribute("aria-label") ?? null,
  };
}

function normalize(u) {
  const x = new URL(u);
  x.hash = "";
  return x.toString();
}

const { urls: smUrls, bySitemap } = await sitemapUrls();
writeFileSync(path.join(OUT, "sitemap-urls.json"), JSON.stringify(bySitemap, null, 2));
const queue = [];
const seen = new Set();
const inSitemap = new Set(smUrls.map(normalize));
let queryCount = 0;
function enqueue(u, from) {
  let n;
  try {
    n = normalize(u);
  } catch {
    return;
  }
  if (!n.startsWith(BASE)) return;
  const p = new URL(n);
  if (SKIP.some((r) => r.test(p.pathname))) return;
  if (seen.has(n)) return;
  if (p.search) {
    if (queryCount >= MAX_QUERY_URLS) return;
    queryCount++;
  }
  seen.add(n);
  queue.push({ url: n, from });
}
enqueue(`${BASE}/`, "seed");
for (const u of smUrls) enqueue(u, "sitemap");

const pages = [];
const inlinks = {};
let active = 0;
let idx = 0;
async function worker() {
  while (idx < queue.length && pages.length < MAX_PAGES) {
    const item = queue[idx++];
    try {
      const r = await fetchFollow(item.url);
      const ct = r.res?.headers.get("content-type") ?? "";
      const rec = {
        url: item.url.replace(BASE, ""),
        from: item.from,
        inSitemap: inSitemap.has(item.url),
        status: r.res?.status ?? 0,
        chain: r.chain.map((c) => `${c.status} ${c.url.replace(BASE, "")} -> ${c.location.replace(BASE, "")}`),
        finalUrl: r.finalUrl.replace(BASE, ""),
        ms: r.ms,
        contentType: ct,
        xRobots: r.res?.headers.get("x-robots-tag") ?? null,
        cacheControl: r.res?.headers.get("cache-control") ?? null,
        bytes: Buffer.byteLength(r.body),
      };
      if (ct.includes("text/html") && r.body) {
        Object.assign(rec, parse(r.body, r.finalUrl));
        for (const l of rec.links) {
          const lu = (() => {
            try {
              return normalize(l.href);
            } catch {
              return null;
            }
          })();
          if (!lu || !lu.startsWith(BASE)) continue;
          const key = lu.replace(BASE, "");
          (inlinks[key] ??= new Set()).add(rec.url);
          enqueue(lu, rec.url);
        }
      }
      pages.push(rec);
      if (pages.length % 25 === 0) console.log(`${pages.length} pages, queue ${queue.length}`);
    } catch (e) {
      pages.push({ url: item.url.replace(BASE, ""), from: item.from, error: String(e).slice(0, 200) });
    }
  }
}
await Promise.all([worker(), worker()]);
active;

const inl = Object.fromEntries(Object.entries(inlinks).map(([k, v]) => [k, [...v].slice(0, 5).concat(v.size > 5 ? [`… ${v.size} total`] : [])]));
const inlCount = Object.fromEntries(Object.entries(inlinks).map(([k, v]) => [k, v.size]));
writeFileSync(path.join(OUT, "crawl.json"), JSON.stringify({ base: BASE, crawledAt: new Date().toISOString(), pages, inlinkSample: inl, inlinkCount: inlCount }, null, 1));

const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const csv = [
  ["url", "status", "chain", "inSitemap", "xRobots", "robots", "canonical", "titleLen", "title", "descLen", "description", "h1Count", "h1", "jsonldTypes", "ogImage", "bytes", "mainWords", "inlinks", "imgsNoAlt", "imgsNoDims", "ms"].join(","),
  ...pages.map((p) =>
    [
      p.url,
      p.status,
      (p.chain ?? []).join(" | "),
      p.inSitemap,
      p.xRobots,
      p.robots,
      (p.canonicals ?? []).join(" "),
      p.title?.length,
      p.title,
      p.description?.length,
      p.description,
      p.h1?.length,
      (p.h1 ?? []).join(" / "),
      (p.jsonld ?? []).map((j) => (j["@graph"] ? j["@graph"].map((g) => g["@type"]).join("+") : j["@type"])).join(" "),
      p.og?.["og:image"],
      p.bytes,
      p.mainWords,
      inlCount[p.url] ?? 0,
      (p.imgs ?? []).filter((i) => i.alt === null).length,
      (p.imgs ?? []).filter((i) => !i.w || !i.h).length,
      p.ms,
    ]
      .map(esc)
      .join(","),
  ),
].join("\n");
writeFileSync(path.join(OUT, "crawl.csv"), csv);
console.log(`done: ${pages.length} pages; queue ${queue.length}; query urls ${queryCount}`);
