// perf-bundle track: fetches the HTML of every perf template (one request at a time) from the
// shared :3100 server, lists every script / stylesheet / font / preload referenced before
// interaction and sizes each asset from .next/static (raw, gzip -6, brotli q11).
//
//   node scripts/qa/audit/perf-bundle-html.mjs
import http from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants, gunzipSync, brotliDecompressSync, gzipSync } from "node:zlib";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/perf-bundle");
mkdirSync(path.join(OUT, "html"), { recursive: true });

const TEMPLATES = [
  ["home", "/"],
  ["delovi", "/delovi"],
  ["category", "/delovi/kocioni-diskovi"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["search", "/pretraga?q=disk"],
  ["generation", "/vozila/volkswagen/golf/golf-7"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["za-majstore", "/za-majstore"],
  ["upit", "/upit"],
  ["korpa", "/korpa"],
  ["porudzbina", "/porudzbina"],
  ["prijava", "/prijava"],
];

const consent = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-perf-bundle-0001" }));

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      url,
      { headers: { "accept-encoding": "br, gzip", accept: "text/html", cookie: `sk_consent=${consent}`, "user-agent": `SklopAudit-perf-bundle/${Date.now()}` } },
      (res) => {
        const chunks = [];
        const t0 = Date.now();
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), ms: Date.now() - t0 }));
      },
    );
    req.on("error", reject);
  });
}

const gz = (b) => gzipSync(b, { level: 6 }).length;
const br = (b) => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const sizeCache = new Map();
function sizeOf(urlPath) {
  if (sizeCache.has(urlPath)) return sizeCache.get(urlPath);
  const rel = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/_next\//, "");
  const file = path.resolve(".next", rel);
  let r = null;
  if (existsSync(file)) {
    const b = readFileSync(file);
    r = { raw: b.length, gz: gz(b), br: br(b) };
  }
  sizeCache.set(urlPath, r);
  return r;
}

const result = {};
for (const [name, route] of TEMPLATES) {
  const res = await get(BASE + route);
  const enc = res.headers["content-encoding"];
  const html = enc === "br" ? brotliDecompressSync(res.body) : enc === "gzip" ? gunzipSync(res.body) : res.body;
  writeFileSync(path.join(OUT, "html", `${name}.html`), html);
  const s = html.toString("utf8");
  const scripts = [...s.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)>/g)].map((m) => ({ src: m[2], attrs: (m[1] + m[3]).trim() }));
  const links = [...s.matchAll(/<link\b([^>]*)>/g)].map((m) => {
    const a = m[1];
    const rel = /rel="([^"]+)"/.exec(a)?.[1];
    const href = /href="([^"]+)"/.exec(a)?.[1];
    const as = /\bas="([^"]+)"/.exec(a)?.[1];
    const media = /media="([^"]+)"/.exec(a)?.[1];
    const fp = /fetchPriority="([^"]+)"/i.exec(a)?.[1];
    const imagesrcset = /imageSrcSet="([^"]+)"/i.exec(a)?.[1] ?? /imagesrcset="([^"]+)"/i.exec(a)?.[1];
    return { rel, href, as, media, fp, imagesrcset };
  });
  const inlineScripts = [...s.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const rscInline = inlineScripts.filter((x) => x.includes("self.__next_f")).reduce((n, x) => n + Buffer.byteLength(x), 0);
  const jsonLd = [...s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + Buffer.byteLength(m[1]), 0);
  const inlineStyles = [...s.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + Buffer.byteLength(m[1]), 0);
  const imgs = [...s.matchAll(/<img\b([^>]*)>/g)].map((m) => {
    const a = m[1];
    const pick = (k) => new RegExp(`\\b${k}="([^"]*)"`, "i").exec(a)?.[1];
    return {
      src: pick("src")?.slice(0, 140),
      srcset: pick("srcSet") ? true : !!pick("srcset"),
      sizes: pick("sizes"),
      loading: pick("loading"),
      fetchpriority: pick("fetchPriority") ?? pick("fetchpriority"),
      width: pick("width"),
      height: pick("height"),
      decoding: pick("decoding"),
      alt: pick("alt")?.slice(0, 60),
    };
  });
  const sources = [...s.matchAll(/<source\b([^>]*)>/g)].map((m) => m[1].slice(0, 300));
  const linkHeader = res.headers.link ?? "";
  const headerPreloads = [...linkHeader.matchAll(/<([^>]+)>;\s*rel=preload;\s*as="([^"]+)"/g)].map((m) => ({ href: m[1], as: m[2] }));

  const js = scripts
    .filter((x) => x.src.startsWith("/_next/"))
    .map((x) => ({ ...x, size: sizeOf(x.src) }));
  const css = links.filter((l) => l.rel === "stylesheet").map((l) => ({ ...l, size: sizeOf(l.href) }));
  const fontPreloads = [...headerPreloads.filter((p) => p.as === "font"), ...links.filter((l) => l.rel === "preload" && l.as === "font")].map((p) => ({ ...p, size: sizeOf(p.href) }));
  const otherPreloads = links.filter((l) => l.rel === "preload" && l.as !== "font");
  const sum = (arr, k) => arr.reduce((n, x) => n + (x.size?.[k] ?? 0), 0);
  result[name] = {
    route,
    status: res.status,
    contentEncoding: enc ?? "none",
    cacheControl: res.headers["cache-control"],
    htmlTransfer: res.body.length,
    htmlRaw: html.length,
    htmlGzipLocal: gz(html),
    htmlBrotliLocal: br(html),
    rscInlineBytes: rscInline,
    jsonLdBytes: jsonLd,
    inlineStyleBytes: inlineStyles,
    jsCount: js.length,
    js: js.map((x) => ({ src: x.src, attrs: x.attrs, ...x.size })),
    jsTotals: { raw: sum(js, "raw"), gz: sum(js, "gz"), br: sum(js, "br") },
    css: css.map((x) => ({ href: x.href, ...x.size })),
    cssTotals: { raw: sum(css, "raw"), gz: sum(css, "gz"), br: sum(css, "br") },
    fontPreloads: fontPreloads.map((x) => ({ href: x.href, ...x.size })),
    fontPreloadTotal: sum(fontPreloads, "raw"),
    otherPreloads,
    imgs,
    sources,
    nonNextScripts: scripts.filter((x) => !x.src.startsWith("/_next/")),
  };
  const r = result[name];
  console.log(
    `${name.padEnd(12)} ${String(r.status)} ${r.contentEncoding} html ${(r.htmlTransfer / 1024).toFixed(1)}KB wire / ${(r.htmlRaw / 1024).toFixed(1)}KB raw (rsc ${(r.rscInlineBytes / 1024).toFixed(1)}KB)  js ${r.jsCount} = ${(r.jsTotals.gz / 1024).toFixed(1)}KB gz / ${(r.jsTotals.br / 1024).toFixed(1)}KB br / ${(r.jsTotals.raw / 1024).toFixed(1)}KB raw  css ${r.css.length} = ${(r.cssTotals.gz / 1024).toFixed(1)}KB gz  fonts ${r.fontPreloads.length} = ${(r.fontPreloadTotal / 1024).toFixed(1)}KB  imgs ${r.imgs.length}  preloads ${r.otherPreloads.length}`,
  );
}
writeFileSync(path.join(OUT, "templates.json"), JSON.stringify(result, null, 2));

// Shared-by-all chunks
const names = Object.keys(result);
const counts = new Map();
for (const n of names) for (const j of result[n].js) counts.set(j.src, (counts.get(j.src) ?? 0) + 1);
const shared = [...counts.entries()].filter(([, c]) => c === names.length).map(([src]) => ({ src, ...sizeOf(src) }));
const sharedTot = shared.reduce((a, x) => ({ raw: a.raw + x.raw, gz: a.gz + x.gz, br: a.br + x.br }), { raw: 0, gz: 0, br: 0 });
console.log(`\nShared by all ${names.length} templates: ${shared.length} scripts, ${(sharedTot.gz / 1024).toFixed(1)} KB gz, ${(sharedTot.br / 1024).toFixed(1)} KB br, ${(sharedTot.raw / 1024).toFixed(1)} KB raw`);
for (const x of shared.sort((a, b) => b.gz - a.gz)) console.log(`  ${(x.gz / 1024).toFixed(1).padStart(7)} gz ${(x.raw / 1024).toFixed(1).padStart(7)} raw  ${x.src}`);
writeFileSync(path.join(OUT, "shared-chunks.json"), JSON.stringify({ shared, sharedTot }, null, 2));
