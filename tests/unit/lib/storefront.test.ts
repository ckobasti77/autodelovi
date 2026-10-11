import { describe, expect, it } from "vitest";

import {
  catalogQuery,
  emptyFilters,
  filterDimensions,
  listingIndexing,
  parseCatalogFilters,
} from "@/lib/catalog/filters";
import { isOrderable } from "@/lib/catalog/orderable";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { markdownToText, parseMarkdown } from "@/lib/content/markdown";
import { touchFromUrl } from "@/lib/analytics/attribution";
import { checkPhoto, fitWithin } from "@/lib/images/compress";
import { formatHours, placeholderValues, type PublicSettingsLike } from "@/lib/settings/public";
import { serializeJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { clampText, pageTitle } from "@/lib/seo/metadata";

describe("catalog filters ⇄ URL", () => {
  it("parses every dimension and normalises lists", () => {
    const f = parseCatalogFilters({
      marka: "volkswagen",
      model: "golf",
      generacija: "golf-7",
      motor: "20-tdi-110-kw",
      proizvodjac: "trw,Brembo,brembo",
      kvalitet: "aftermarket,oem,nepostoji",
      dostupnost: "na-stanju",
      cena: "15.000-2000",
      sort: "cena-rastuce",
      strana: "3",
    });
    expect(f.vehicle).toEqual({ brand: "volkswagen", model: "golf", generation: "golf-7", engine: "20-tdi-110-kw" });
    expect(f.manufacturers).toEqual(["brembo", "trw"]);
    expect(f.qualities).toEqual(["oem", "aftermarket"]);
    expect(f.inStock).toBe(true);
    expect([f.priceMin, f.priceMax]).toEqual([2000, 15000]);
    expect(f.sort).toBe("price_asc");
    expect(f.page).toBe(3);
  });

  it("drops a model or engine without its parent and rejects junk", () => {
    const f = parseCatalogFilters({ model: "golf", motor: "x", strana: "-4", sort: "hack", marka: "VW!" });
    expect(f.vehicle).toBeNull();
    expect(f.page).toBe(1);
    expect(f.sort).toBe("popular");
  });

  it("round-trips through the query string", () => {
    const f = parseCatalogFilters({ marka: "skoda", proizvodjac: "bosch", dostupnost: "na-stanju", strana: "2" });
    const q = catalogQuery(f);
    expect(q).toBe("?marka=skoda&proizvodjac=bosch&dostupnost=na-stanju&strana=2");
    expect(parseCatalogFilters(Object.fromEntries(new URLSearchParams(q)))).toEqual(f);
    expect(catalogQuery(emptyFilters())).toBe("");
  });

  it("follows the canonical/indexing rules (ROUTES §B1)", () => {
    const base = "/delovi/kocioni-diskovi";
    expect(listingIndexing(base, emptyFilters())).toEqual({ canonical: base, index: true });
    expect(listingIndexing(base, { ...emptyFilters(), page: 3 })).toEqual({ canonical: `${base}?strana=3`, index: true });
    const one = { ...emptyFilters(), inStock: true };
    expect(filterDimensions(one)).toBe(1);
    expect(listingIndexing(base, one)).toEqual({ canonical: base, index: true });
    const two = { ...one, manufacturers: ["bosch"] };
    expect(listingIndexing(base, two)).toEqual({ canonical: base, index: false });
    expect(listingIndexing(base, { ...emptyFilters(), sort: "new" as const })).toEqual({ canonical: base, index: false });
  });
});

describe("orderable", () => {
  it("allows stock or backorder only", () => {
    expect(isOrderable("in_stock", false)).toBe(true);
    expect(isOrderable("low_stock", false)).toBe(true);
    expect(isOrderable("out_of_stock", false)).toBe(false);
    expect(isOrderable("out_of_stock", true)).toBe(true);
    expect(isOrderable("on_order", false)).toBe(false);
  });
});

describe("content placeholders and Markdown", () => {
  it("fills values, uses fallbacks and drops lines with missing required values", () => {
    const md = "- Naziv: {{firma.naziv}}\n- PIB: {{firma.pib}}\nKurir {{dostava.kurir.cena|po ceniku}}.";
    expect(fillPlaceholders(md, { "firma.naziv": "Delovi d.o.o.", "firma.pib": "" })).toBe(
      "- Naziv: Delovi d.o.o.\nKurir po ceniku.",
    );
  });

  it("parses headings, lists, tables and drops empty sections", () => {
    const blocks = parseMarkdown("## Prazno\n## Puno\nTekst **bitno** i [link](/kontakt).\n\n- a\n- b\n\n| A | B |\n|---|---|\n| 1 | 2 |");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "table"]);
    expect(blocks[0]).toMatchObject({ kind: "heading", text: "Puno" });
    expect(blocks[3]).toMatchObject({ kind: "table", head: ["A", "B"], rows: [["1", "2"]] });
    expect(markdownToText("## N\nTekst **bitno** i [link](/x).")).toBe("N Tekst bitno i link.");
  });
});

describe("attribution capture", () => {
  const now = 1_790_000_000_000;
  it("reads campaign parameters and an external referrer", () => {
    const t = touchFromUrl(
      new URL("https://primer.rs/delovi/turbina?utm_source=google&utm_medium=cpc&gclid=abc123"),
      "https://www.google.com/search?q=turbina",
      now,
    );
    expect(t).toEqual({
      at: now,
      source: "google",
      medium: "cpc",
      gclid: "abc123",
      referrer: "https://www.google.com/search",
      landingPath: "/delovi/turbina",
    });
  });

  it("ignores internal navigation without campaign signals", () => {
    expect(touchFromUrl(new URL("https://primer.rs/deo/x"), "https://primer.rs/delovi", now)).toBeNull();
  });
});

describe("photo checks", () => {
  it("accepts JPG/PNG/WebP up to 8 MB", () => {
    expect(checkPhoto({ type: "image/jpeg", size: 1000 })).toEqual({ ok: true });
    expect(checkPhoto({ type: "image/gif", size: 1000 })).toEqual({ ok: false, reason: "type" });
    expect(checkPhoto({ type: "image/png", size: 9 * 1024 * 1024 })).toEqual({ ok: false, reason: "size" });
  });
  it("fits the long edge into 2048 px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("settings → public shapes", () => {
  it("groups working hours", () => {
    const hours = [1, 2, 3, 4, 5].map((day) => ({ day, open: "08:00", close: "17:00", closed: false }));
    expect(
      formatHours([...hours, { day: 6, open: "08:30", close: "14:00", closed: false }, { day: 0, open: "", close: "", closed: true }]),
    ).toBe("Pon–pet 8–17, sub 8:30–14");
    expect(formatHours([])).toBe("");
  });

  it("builds placeholder values without inventing company data", () => {
    const s: PublicSettingsLike = {
      company: { legalName: "", address: { street: "", city: "", postalCode: "" }, phones: [], bankAccounts: [] },
      hours: [],
      brand: { name: "Euromotors Plus", tagline: "" },
      commerce: { freeShippingOverPara: 1_000_000, quoteValidityDays: 7, etaText: "" },
      deliveryMethods: [
        { code: "courier", label: "Kurir", description: "", pricePara: 45_000, freeOverPara: 1_000_000, etaText: "" },
      ],
    };
    const v = placeholderValues(s, "https://primer.rs/");
    expect(v["firma.naziv"]).toBe("");
    expect(v["firma.pib"]).toBe("");
    expect(v["dostava.kurir.cena"]).toBe("450 RSD");
    expect(v["dostava.besplatnoPreko"]).toBe("10.000 RSD");
    expect(v.sajt).toBe("primer.rs");
  });
});

describe("SEO helpers", () => {
  it("keeps titles within budget and escapes JSON-LD", () => {
    expect(pageTitle("Kočioni diskovi za VW, Audi, Škoda, SEAT", " | Euromotors Plus")).toBe(
      "Kočioni diskovi za VW, Audi, Škoda, SEAT | Euromotors Plus",
    );
    expect(clampText("a ".repeat(100), 20).length).toBeLessThanOrEqual(20);
    expect(serializeJsonLd({ name: "</script><b>" })).not.toContain("</script>");
  });

  it("emits a product offer only with a price and never a rating", () => {
    const ld = productJsonLd({
      name: "Disk",
      slug: "disk",
      sku: "DEMO-1",
      mpn: null,
      ean: "123",
      manufacturer: "Brembo",
      category: "Kočioni diskovi",
      description: "Opis",
      images: ["/images/parts/kocioni-diskovi.webp"],
      pricePara: 729_000,
      stockState: "low_stock",
      shippingPara: 45_000,
    });
    expect(ld).toMatchObject({ "@type": "Product", sku: "DEMO-1", offers: { price: "7290.00", availability: "https://schema.org/InStock" } });
    expect(ld).not.toHaveProperty("gtin13");
    expect(ld).not.toHaveProperty("aggregateRating");
  });
});
