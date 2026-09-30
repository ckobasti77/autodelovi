/**
 * Product feeds (SEO-ADS §J9): Google Merchant Center RSS 2.0 (`g:` namespace) and the Meta
 * catalog CSV. Pure builders — escaping, required attributes and formats are unit-tested.
 * Only active products with a public price reach these functions (`seo.feedProducts`).
 */
import { escapeXml, absoluteUrl } from "@/lib/seo/sitemap";
import { isValidEan13 } from "@/lib/seo/jsonld";
import { site } from "@/config/site";

export type FeedStockState = "in_stock" | "low_stock" | "out_of_stock" | "on_order";

export type FeedProduct = {
  sku: string;
  slug: string;
  name: string;
  manufacturerName: string;
  mpn: string | null;
  ean: string | null;
  oemPrimary: string | null;
  pricePara: number;
  stockState: FeedStockState;
  allowBackorder: boolean;
  description: string | null;
  fitmentSummary: string | null;
  /** Image paths (`/slike/deo/…`); the category render is the fallback. */
  images: string[];
  categorySlug: string;
  /** „Kočnice > Kočioni diskovi“. */
  productType: string;
  googleCategoryId: number;
};

export type FeedShipping = { pricePara: number; freeOverPara: number | null } | null;

/** „12990.00 RSD“ — the Merchant Center / Meta price format. */
export const feedPrice = (para: number) => `${(para / 100).toFixed(2)} RSD`;

export function merchantAvailability(p: Pick<FeedProduct, "stockState" | "allowBackorder">) {
  if (p.stockState === "in_stock" || p.stockState === "low_stock") return "in_stock";
  if (p.stockState === "on_order" && p.allowBackorder) return "backorder";
  return "out_of_stock";
}

export function metaAvailability(p: Pick<FeedProduct, "stockState" | "allowBackorder">) {
  if (p.stockState === "in_stock" || p.stockState === "low_stock") return "in stock";
  if (p.stockState === "on_order" && p.allowBackorder) return "available for order";
  return "out of stock";
}

/** Title ≤ 150: name + manufacturer + OEM, never cut inside the code. */
export function feedTitle(
  p: Pick<FeedProduct, "name" | "manufacturerName" | "oemPrimary" | "mpn">,
) {
  const code = p.oemPrimary ?? p.mpn;
  const full = `${p.name} ${p.manufacturerName}${code ? ` ${code}` : ""}`
    .replace(/\s+/g, " ")
    .trim();
  if (full.length <= 150) return full;
  const suffix = ` ${p.manufacturerName}${code ? ` ${code}` : ""}`;
  return `${p.name.slice(0, Math.max(20, 150 - suffix.length - 1)).trim()}…${suffix}`.slice(0, 150);
}

export function feedDescription(p: FeedProduct): string {
  const text = p.description
    ? p.description
        .replace(/[#*_`>[\]]/g, "")
        .replace(/\(https?:[^)]*\)/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
  const fallback = [
    `${p.name} — ${p.manufacturerName}.`,
    p.oemPrimary ? `OEM broj ${p.oemPrimary}.` : "",
    p.fitmentSummary ? `Odgovara za ${p.fitmentSummary}.` : "",
    "Cena sa PDV-om. Plaćanje pouzećem ili pri preuzimanju u radnji.",
  ]
    .filter(Boolean)
    .join(" ");
  return (text || fallback).slice(0, 5_000);
}

function shippingPara(p: FeedProduct, shipping: FeedShipping): number | null {
  if (!shipping) return null;
  return shipping.freeOverPara !== null && p.pricePara >= shipping.freeOverPara
    ? 0
    : shipping.pricePara;
}

function images(p: FeedProduct, origin: string): string[] {
  const list = p.images.length ? p.images : [`/images/parts/${p.categorySlug}.webp`];
  return list.map((i) => absoluteUrl(i, origin));
}

const tag = (name: string, value: string | number) =>
  `      <${name}>${escapeXml(String(value))}</${name}>`;

export function merchantFeedXml(
  products: FeedProduct[],
  opts: { shipping: FeedShipping; storeName: string; origin?: string },
): string {
  const origin = opts.origin ?? site.url;
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${escapeXml(opts.storeName)}</title>`,
    `    <link>${escapeXml(absoluteUrl("/", origin))}</link>`,
    `    <description>${escapeXml(`${opts.storeName} — delovi za VAG vozila`)}</description>`,
  ];
  for (const p of products) {
    const [image, ...additional] = images(p, origin);
    const gtin = isValidEan13(p.ean) ? p.ean : null;
    const mpn = p.mpn ?? p.oemPrimary;
    const ship = shippingPara(p, opts.shipping);
    out.push("    <item>");
    out.push(tag("g:id", p.sku));
    out.push(tag("g:title", feedTitle(p)));
    out.push(tag("g:description", feedDescription(p)));
    out.push(tag("g:link", absoluteUrl(`/deo/${p.slug}`, origin)));
    out.push(tag("g:image_link", image!));
    for (const extra of additional.slice(0, 10)) out.push(tag("g:additional_image_link", extra));
    out.push(tag("g:availability", merchantAvailability(p)));
    out.push(tag("g:price", feedPrice(p.pricePara)));
    out.push(tag("g:brand", p.manufacturerName));
    if (gtin) out.push(tag("g:gtin", gtin));
    if (mpn) out.push(tag("g:mpn", mpn));
    if (!gtin && !mpn) out.push(tag("g:identifier_exists", "no"));
    out.push(tag("g:condition", "new"));
    out.push(tag("g:google_product_category", p.googleCategoryId));
    out.push(tag("g:product_type", p.productType));
    if (ship !== null) {
      out.push("      <g:shipping>");
      out.push(`        <g:country>RS</g:country>`);
      out.push(`        <g:price>${escapeXml(feedPrice(ship))}</g:price>`);
      out.push("      </g:shipping>");
    }
    out.push("    </item>");
  }
  out.push("  </channel>", "</rss>");
  return `${out.join("\n")}\n`;
}

/** RFC 4180 field: quoted when it contains a comma, quote or line break. */
export function csvField(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value).replace(/\r?\n/g, " ");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const META_CSV_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand",
  "mpn",
  "google_product_category",
  "product_type",
] as const;

export function metaCatalogCsv(products: FeedProduct[], origin: string = site.url): string {
  const lines = [META_CSV_COLUMNS.join(",")];
  for (const p of products) {
    const [image] = images(p, origin);
    lines.push(
      [
        p.sku,
        feedTitle(p),
        feedDescription(p),
        metaAvailability(p),
        "new",
        feedPrice(p.pricePara),
        absoluteUrl(`/deo/${p.slug}`, origin),
        image,
        p.manufacturerName,
        p.mpn ?? p.oemPrimary ?? "",
        p.googleCategoryId,
        p.productType,
      ]
        .map(csvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
