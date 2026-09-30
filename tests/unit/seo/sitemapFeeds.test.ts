// @vitest-environment jsdom
import { describe, expect, test } from "vitest";

import {
  csvField,
  feedPrice,
  feedTitle,
  merchantAvailability,
  merchantFeedXml,
  META_CSV_COLUMNS,
  metaAvailability,
  metaCatalogCsv,
  type FeedProduct,
} from "@/lib/seo/feeds";
import { googleCategoryFor } from "@/lib/seo/googleCategories";
import { offlineConversionsCsv } from "@/lib/seo/offlineConversions";
import {
  escapeXml,
  productSitemapIndex,
  sitemapFileNames,
  sitemapIndexXml,
  urlsetXml,
} from "@/lib/seo/sitemap";

const ORIGIN = "https://sklop.rs";

/** Parses XML with the DOM parser; throws on a well-formedness error. */
function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const error = doc.getElementsByTagName("parsererror")[0];
  if (error) throw new Error(`XML error: ${error.textContent}`);
  return doc;
}

describe("sitemaps", () => {
  test("urlset is well-formed, absolute, escaped, with the image namespace when needed", () => {
    const xml = urlsetXml(
      [
        { loc: "/delovi/kocione-plocice", lastModified: Date.UTC(2026, 8, 30) },
        { loc: "/pretraga?q=pločice&x=1", images: ["/slike/deo/a-1-abc123.jpg", "/b.webp", "/c.webp", "/d.webp"] },
      ],
      ORIGIN,
    );
    const doc = parseXml(xml);
    const locs = [...doc.getElementsByTagName("loc")].map((l) => l.textContent);
    expect(locs[0]).toBe("https://sklop.rs/delovi/kocione-plocice");
    expect(locs[1]).toBe("https://sklop.rs/pretraga?q=plo%C4%8Dice&x=1");
    expect(doc.getElementsByTagName("lastmod")[0]?.textContent).toBe("2026-09-30T00:00:00.000Z");
    expect(doc.getElementsByTagName("image:image")).toHaveLength(3);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).not.toMatch(/<priority>|<changefreq>/);
  });

  test("index lists children; product files are chunked by 10 000", () => {
    expect(sitemapFileNames(0)).toEqual([
      "staticne",
      "kategorije",
      "vozila",
      "landing",
      "proizvodi-1",
    ]);
    expect(sitemapFileNames(25_001).slice(-3)).toEqual(["proizvodi-1", "proizvodi-2", "proizvodi-3"]);
    const doc = parseXml(sitemapIndexXml([{ name: "staticne" }, { name: "proizvodi-1" }], ORIGIN));
    expect(doc.documentElement.nodeName).toBe("sitemapindex");
    expect([...doc.getElementsByTagName("loc")].map((l) => l.textContent)).toEqual([
      "https://sklop.rs/sitemaps/staticne.xml",
      "https://sklop.rs/sitemaps/proizvodi-1.xml",
    ]);
    expect(productSitemapIndex("proizvodi-12")).toBe(12);
    expect(productSitemapIndex("proizvodi-0")).toBeNull();
    expect(productSitemapIndex("kategorije")).toBeNull();
  });

  test("escapeXml handles markup characters and strips control characters", () => {
    expect(escapeXml(`a&b<c>"d'\u0001`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;");
  });
});

const item = (over: Partial<FeedProduct> = {}): FeedProduct => ({
  sku: "SK-1",
  slug: "kocioni-disk-prednji",
  name: "Kočioni disk prednji & ventilirani <312>",
  manufacturerName: "Brembo",
  mpn: "09.A820.11",
  ean: null,
  oemPrimary: "5Q0 615 301 F",
  pricePara: 1_299_000,
  stockState: "in_stock",
  allowBackorder: false,
  description: null,
  fitmentSummary: "VW Golf VII",
  images: [],
  categorySlug: "kocioni-diskovi",
  productType: "Kočnice > Kočioni diskovi",
  googleCategoryId: 2977,
  ...over,
});

describe("Google Merchant feed", () => {
  test("RSS 2.0 with the g: namespace and every required attribute per item", () => {
    const xml = merchantFeedXml(
      [item(), item({ sku: "SK-2", mpn: null, oemPrimary: null, stockState: "on_order", allowBackorder: true, pricePara: 500_000 })],
      { shipping: { pricePara: 45_000, freeOverPara: 1_000_000 }, storeName: "SKLOP", origin: ORIGIN },
    );
    const doc = parseXml(xml);
    expect(doc.documentElement.getAttribute("version")).toBe("2.0");
    expect(doc.documentElement.getAttribute("xmlns:g")).toBe("http://base.google.com/ns/1.0");
    const items = [...doc.getElementsByTagName("item")];
    expect(items).toHaveLength(2);
    const text = (el: Element, tag: string) => el.getElementsByTagName(tag)[0]?.textContent ?? null;
    for (const el of items) {
      for (const tag of [
        "g:id",
        "g:title",
        "g:description",
        "g:link",
        "g:image_link",
        "g:availability",
        "g:price",
        "g:brand",
        "g:condition",
        "g:google_product_category",
        "g:product_type",
      ]) {
        expect(text(el, tag), `${tag} missing`).toBeTruthy();
      }
    }
    expect(text(items[0]!, "g:title")).toBe(
      "Kočioni disk prednji & ventilirani <312> Brembo 5Q0 615 301 F",
    );
    expect(text(items[0]!, "g:price")).toBe("12990.00 RSD");
    expect(text(items[0]!, "g:image_link")).toBe("https://sklop.rs/images/parts/kocioni-diskovi.webp");
    // Free shipping above the threshold, courier price below it.
    expect(items[0]!.getElementsByTagName("g:shipping")[0]?.getElementsByTagName("g:price")[0]?.textContent).toBe("0.00 RSD");
    expect(items[1]!.getElementsByTagName("g:shipping")[0]?.getElementsByTagName("g:price")[0]?.textContent).toBe("450.00 RSD");
    expect(text(items[1]!, "g:availability")).toBe("backorder");
    expect(text(items[1]!, "g:identifier_exists")).toBe("no");
    expect(text(items[0]!, "g:identifier_exists")).toBeNull();
  });

  test("availability, price and title formats", () => {
    expect(merchantAvailability({ stockState: "low_stock", allowBackorder: false })).toBe("in_stock");
    expect(merchantAvailability({ stockState: "on_order", allowBackorder: false })).toBe("out_of_stock");
    expect(metaAvailability({ stockState: "on_order", allowBackorder: true })).toBe(
      "available for order",
    );
    expect(feedPrice(49_050)).toBe("490.50 RSD");
    const long = feedTitle({ name: "x ".repeat(120), manufacturerName: "Bosch", oemPrimary: "0 986 4", mpn: null });
    expect(long.length).toBeLessThanOrEqual(150);
    expect(long.endsWith("Bosch 0 986 4")).toBe(true);
  });

  test("Google product categories per category and system", () => {
    expect(googleCategoryFor({ categorySlug: "kocioni-diskovi", systemSlug: "kocnice" })).toBe(2977);
    expect(googleCategoryFor({ categorySlug: "farovi", systemSlug: "elektrika-i-svetla" })).toBe(3318);
    expect(googleCategoryFor({ categorySlug: "filter-ulja", parentSlug: "filteri", systemSlug: "servis" })).toBe(2550);
    expect(googleCategoryFor({ categorySlug: "nepoznato", systemSlug: "nepoznato" })).toBe(899);
  });
});

describe("Meta catalog CSV", () => {
  test("header, RFC 4180 quoting, one line per product", () => {
    const csv = metaCatalogCsv([item({ description: 'Disk "premium", 312 mm\nventiliran' })], ORIGIN);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(META_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Disk ""premium"", 312 mm ventiliran"');
    expect(lines[1]).toContain(",in stock,new,12990.00 RSD,https://sklop.rs/deo/kocioni-disk-prednji,");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField(null)).toBe("");
  });
});

describe("offline conversions CSV", () => {
  test("legacy Google Ads template with the time zone line", () => {
    const csv = offlineConversionsCsv(
      [{ gclid: "Cj0KCQ-test", time: "2026-09-30 14:05:09", valuePara: 1_299_050 }],
      "Porudžbina završena",
    );
    expect(csv.split("\n").slice(0, 3)).toEqual([
      "Parameters:TimeZone=Europe/Belgrade",
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      "Cj0KCQ-test,Porudžbina završena,2026-09-30 14:05:09,12990.50,RSD",
    ]);
    expect(offlineConversionsCsv([], null)).toContain("Google Click ID");
  });

  test("rows whose click id is not a real gclid are left out (CSV injection)", () => {
    const csv = offlineConversionsCsv(
      [
        { gclid: '=HYPERLINK("https://x.test")', time: "2026-09-30 14:05:09", valuePara: 100 },
        { gclid: "Cj0KCQjw_ok-1", time: "2026-09-30 14:05:09", valuePara: 100 },
      ],
      null,
    );
    expect(csv).not.toContain("HYPERLINK");
    expect(csv).toContain("Cj0KCQjw_ok-1");
  });
});
