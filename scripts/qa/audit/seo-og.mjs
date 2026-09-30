/**
 * Step 21 QA audit, track "seo": fetches the og:image of one page per template (plus edge cases),
 * checks status, content type, dimensions (1200x630 PNG), bytes, cache headers, and saves a
 * WebP copy under docs/qa/audit/seo/og/ for visual review.
 *   node scripts/qa/audit/seo-og.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/seo/og");
mkdirSync(OUT, { recursive: true });
const pages = [
  "/",
  "/delovi/kocnice",
  "/delovi/kocioni-diskovi",
  "/delovi/kocioni-diskovi/volkswagen",
  "/delovi/kocioni-diskovi/volkswagen/golf",
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/deo/kocione-plocice-prednje-sa-senzorom-demo-0009",
  "/deo/kocione-plocice-prednje-demo-0012",
  "/deo/set-zupcastog-kaisa-sa-vodenom-pumpom-1-9-tdi-demo-0057",
  "/vozila/volkswagen/golf/golf-7",
  "/ponuda/kocione-plocice-golf",
  "/delovi/filteri",
  "/delovi/senzori",
];
const rows = [];
for (const p of pages) {
  const html = await (await fetch(BASE + p)).text();
  const m = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (!m) {
    rows.push({ page: p, error: "no og:image" });
    continue;
  }
  const url = m[1].replaceAll("&amp;", "&").replace("http://localhost:3000", BASE);
  const t0 = Date.now();
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Date.now() - t0;
  let meta = {};
  try {
    meta = await sharp(buf).metadata();
  } catch (e) {
    meta = { error: String(e) };
  }
  const name = p === "/" ? "home" : p.replaceAll("/", "_").replace(/^_/, "");
  if (!meta.error) await sharp(buf).webp({ quality: 75 }).toFile(path.join(OUT, `${name}.webp`));
  rows.push({
    page: p,
    og: url.replace(BASE, ""),
    status: res.status,
    type: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
    bytes: buf.length,
    width: meta.width,
    height: meta.height,
    format: meta.format,
    ms,
    evidence: `docs/qa/audit/seo/og/${name}.webp`,
  });
}
writeFileSync(path.join(OUT, "og-check.json"), JSON.stringify(rows, null, 1));
console.table(rows.map(({ page, status, type, bytes, width, height, ms }) => ({ page, status, type, bytes, width, height, ms })));
