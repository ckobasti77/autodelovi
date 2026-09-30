/**
 * Sitemap XML (SEO-ADS §J3): an index at `/sitemap.xml` and children under `/sitemaps/`.
 * Pure string builders — escaping and limits are unit-tested. `<priority>`/`<changefreq>`
 * are not emitted (Google ignores them); `<lastmod>` only where it reflects a real change.
 */
import { site } from "@/config/site";

/** Products per child sitemap (protocol limit is 50 000; smaller files regenerate faster). */
export const PRODUCTS_PER_SITEMAP = 10_000;
/** Image entries per URL (Google allows 1 000; product pages list at most 3). */
export const IMAGES_PER_URL = 3;

export const SITEMAP_FILES = ["staticne", "kategorije", "vozila", "landing"] as const;
export type SitemapFile = (typeof SITEMAP_FILES)[number] | `proizvodi-${number}`;

export type SitemapUrl = {
  /** Path (`/delovi/turbina`) or absolute URL. */
  loc: string;
  lastModified?: number | null;
  /** Image paths or URLs. */
  images?: string[];
};

export function escapeXml(value: string): string {
  return (
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      // Characters that are illegal in XML 1.0 documents.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
  );
}

export const absoluteUrl = (pathOrUrl: string, origin: string = site.url): string =>
  new URL(pathOrUrl, origin).toString();

const w3cDate = (ms: number) => new Date(ms).toISOString();

export function urlsetXml(urls: SitemapUrl[], origin: string = site.url): string {
  const withImages = urls.some((u) => u.images?.length);
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${
      withImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ""
    }>`,
  ];
  for (const u of urls) {
    out.push("  <url>");
    out.push(`    <loc>${escapeXml(absoluteUrl(u.loc, origin))}</loc>`);
    if (u.lastModified) out.push(`    <lastmod>${w3cDate(u.lastModified)}</lastmod>`);
    for (const img of (u.images ?? []).slice(0, IMAGES_PER_URL)) {
      out.push(
        `    <image:image><image:loc>${escapeXml(absoluteUrl(img, origin))}</image:loc></image:image>`,
      );
    }
    out.push("  </url>");
  }
  out.push("</urlset>");
  return `${out.join("\n")}\n`;
}

export function sitemapIndexXml(
  files: { name: string; lastModified?: number | null }[],
  origin: string = site.url,
): string {
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const f of files) {
    out.push("  <sitemap>");
    out.push(`    <loc>${escapeXml(absoluteUrl(`/sitemaps/${f.name}.xml`, origin))}</loc>`);
    if (f.lastModified) out.push(`    <lastmod>${w3cDate(f.lastModified)}</lastmod>`);
    out.push("  </sitemap>");
  }
  out.push("</sitemapindex>");
  return `${out.join("\n")}\n`;
}

/** Child sitemap names for a catalog of `productCount` active products. */
export function sitemapFileNames(productCount: number): string[] {
  const productFiles = Math.max(1, Math.ceil(productCount / PRODUCTS_PER_SITEMAP));
  return [
    ...SITEMAP_FILES,
    ...Array.from({ length: productFiles }, (_, i) => `proizvodi-${i + 1}`),
  ];
}

/** `proizvodi-3` → 3; null for anything that is not a product sitemap. */
export function productSitemapIndex(name: string): number | null {
  const m = /^proizvodi-([1-9]\d{0,3})$/.exec(name);
  return m ? Number(m[1]) : null;
}

/** Indexable static routes (legal pages low priority but indexable, ROUTES §B1). */
export const STATIC_SITEMAP_PATHS = [
  "/",
  "/delovi",
  "/vozila",
  "/za-majstore",
  "/upit",
  "/o-nama",
  "/kontakt",
  "/dostava-i-placanje",
  "/reklamacije-i-povrat",
  "/uslovi-koriscenja",
  "/politika-privatnosti",
  "/kolacici",
] as const;

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
} as const;
