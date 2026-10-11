import { describe, expect, test } from "vitest";

import {
  availabilityUrl,
  breadcrumbJsonLd,
  extractJsonLd,
  faqJsonLd,
  isValidEan13,
  itemListJsonLd,
  productJsonLd,
  serializeJsonLd,
  storeJsonLd,
  websiteJsonLd,
} from "@/lib/seo/jsonld";

// JSON-LD nodes are open records; `any` keeps nested assertions readable in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;

const product = {
  name: "Kočioni disk prednji",
  slug: "kocioni-disk-prednji",
  sku: "SK-1",
  mpn: "09.A820.11",
  ean: "4006633356541",
  manufacturer: "Brembo",
  category: "Kočioni diskovi",
  description: "Disk.",
  images: ["/slike/deo/kocioni-disk-prednji-1-abc123.jpg"],
  pricePara: 1_299_000,
  stockState: "in_stock" as const,
  shippingPara: 45_000,
  freeOverPara: 1_000_000,
};

describe("Product + Offer", () => {
  test("RSD price as a decimal string, availability URL, condition, brand, identifiers", () => {
    const ld = productJsonLd(product) as Node;
    expect(ld["@type"]).toBe("Product");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "Brembo" });
    expect(ld.mpn).toBe("09.A820.11");
    expect(ld.gtin13).toBe("4006633356541");
    expect(ld.image[0]).toMatch(/^https?:\/\/.+\/slike\/deo\//);
    expect(ld.offers).toMatchObject({
      "@type": "Offer",
      price: "12990.00",
      priceCurrency: "RSD",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    });
    // Free shipping above the threshold.
    expect(ld.offers.shippingDetails.shippingRate.value).toBe("0.00");
    expect(ld.offers.hasMerchantReturnPolicy).toMatchObject({
      applicableCountry: "RS",
      merchantReturnDays: 14,
    });
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });

  test("hidden price → no Offer; invalid EAN → no gtin; backorder availability", () => {
    const ld = productJsonLd({ ...product, pricePara: null, ean: "4006633356542" }) as Node;
    expect(ld.offers).toBeUndefined();
    expect(ld.gtin13).toBeUndefined();
    expect(availabilityUrl("on_order")).toBe("https://schema.org/BackOrder");
    expect(availabilityUrl("out_of_stock")).toBe("https://schema.org/OutOfStock");
    expect(isValidEan13("4006633356541")).toBe(true);
    expect(isValidEan13("400663335654")).toBe(false);
  });

  test("courier price applies below the free-shipping threshold", () => {
    const ld = productJsonLd({ ...product, pricePara: 500_000 }) as Node;
    expect(ld.offers.shippingDetails.shippingRate.value).toBe("450.00");
  });
});

describe("business, site, lists", () => {
  test("AutoPartsStore only with an address; Organization otherwise — never invented data", () => {
    const hours = [{ day: 1, open: "08:00", close: "17:00", closed: false }];
    const org = storeJsonLd({ name: "Euromotors Plus", alternateName: "OEM Parts", hours }) as Node;
    expect(org["@type"]).toBe("Organization");
    expect(org).toMatchObject({ name: "Euromotors Plus", alternateName: "OEM Parts" });
    expect(org.logo).toMatch(/^https?:\/\/[^/]+\/brand\/icon-512\.png$/);
    // A second name that repeats the first says nothing, so it is left out.
    expect(
      (storeJsonLd({ name: "OEM Parts", alternateName: "oem parts", hours }) as Node).alternateName,
    ).toBeUndefined();
    expect(org.address).toBeUndefined();
    expect(org.telephone).toBeUndefined();
    const store = storeJsonLd({
      name: "Euromotors Plus",
      street: "Bulevar 1",
      city: "Beograd",
      postalCode: "11000",
      telephone: "+381641234567",
      hours,
    }) as Node;
    expect(store["@type"]).toBe("AutoPartsStore");
    expect(store.address).toMatchObject({ addressLocality: "Beograd", addressCountry: "RS" });
    expect(store.openingHoursSpecification[0]).toMatchObject({
      dayOfWeek: "Monday",
      opens: "08:00",
    });
  });

  test("WebSite SearchAction, breadcrumbs with absolute URLs, ItemList, FAQPage", () => {
    const site = websiteJsonLd() as Node;
    expect(site).toMatchObject({ name: "Euromotors Plus", alternateName: "OEM Parts" });
    expect((websiteJsonLd("OEM Parts") as Node).alternateName).toBeUndefined();
    expect(site.potentialAction.target.urlTemplate).toMatch(
      /\/pretraga\?q=\{search_term_string\}$/,
    );
    const crumbs = breadcrumbJsonLd([
      { label: "Početna", href: "/" },
      { label: "Turbina" },
    ]) as Node;
    expect(crumbs.itemListElement[0].item).toMatch(/^https?:\/\//);
    expect(crumbs.itemListElement[1].item).toBeUndefined();
    const list = itemListJsonLd([{ name: "A", slug: "a" }], "Lista") as Node;
    expect(list).toMatchObject({ numberOfItems: 1, name: "Lista" });
    const faq = faqJsonLd([{ question: "P?", answer: "O." }]) as Node;
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe("O.");
  });

  test("serialisation cannot close the script tag; extraction parses it back", () => {
    const json = serializeJsonLd({ "@type": "Thing", name: "</script><b>" });
    expect(json).not.toContain("</script>");
    const html = `<head><script type="application/ld+json">${json}</script><script type="application/ld+json">${serializeJsonLd([websiteJsonLd()])}</script></head>`;
    const nodes = extractJsonLd(html);
    expect(nodes.map((n) => n["@type"])).toEqual(["Thing", "WebSite"]);
    expect(nodes[0]!.name).toBe("</script><b>");
  });
});
