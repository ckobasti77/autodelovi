/**
 * Typed JSON-LD builders (SEO-ADS §J2). Only filled fields are emitted; no ratings or reviews
 * (none exist). Rendered by `components/seo/JsonLd.tsx`.
 */
import { site } from "@/config/site";

export type JsonLd = Record<string, unknown>;

const abs = (path: string) => new URL(path, site.url).toString();

const compact = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  ) as T;

export function breadcrumbJsonLd(items: { label: string; href?: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) =>
      compact({
        "@type": "ListItem",
        position: i + 1,
        name: item.label,
        item: item.href ? abs(item.href) : undefined,
      }),
    ),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.brand.name,
    url: abs("/"),
    inLanguage: site.locale,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${abs("/pretraga")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type StoreInfo = {
  name: string;
  telephone?: string;
  email?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  hours: { day: number; open: string; close: string; closed: boolean }[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function storeJsonLd(info: StoreInfo): JsonLd {
  const address =
    info.street && info.city
      ? compact({
          "@type": "PostalAddress",
          streetAddress: info.street,
          addressLocality: info.city,
          postalCode: info.postalCode,
          addressCountry: "RS",
        })
      : undefined;
  const open = info.hours.filter((h) => !h.closed);
  return compact({
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: info.name,
    url: abs("/"),
    telephone: info.telephone,
    email: info.email,
    address,
    areaServed: "RS",
    currenciesAccepted: "RSD",
    paymentAccepted: "Cash, Credit Card, Bank transfer",
    openingHoursSpecification: open.length
      ? open.map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: DAY_NAMES[h.day],
          opens: h.open,
          closes: h.close,
        }))
      : undefined,
  });
}

export type ProductLdInput = {
  name: string;
  slug: string;
  sku: string;
  mpn: string | null;
  ean: string | null;
  manufacturer: string;
  category: string;
  description: string;
  images: string[];
  pricePara: number | null;
  stockState: "in_stock" | "low_stock" | "out_of_stock" | "on_order";
  shippingPara: number | null;
};

export function productJsonLd(p: ProductLdInput): JsonLd {
  const availability =
    p.stockState === "in_stock" || p.stockState === "low_stock"
      ? "https://schema.org/InStock"
      : p.stockState === "on_order"
        ? "https://schema.org/BackOrder"
        : "https://schema.org/OutOfStock";
  const offer =
    p.pricePara !== null
      ? compact({
          "@type": "Offer",
          url: abs(`/deo/${p.slug}`),
          priceCurrency: "RSD",
          price: (p.pricePara / 100).toFixed(2),
          availability,
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", name: site.brand.name },
          shippingDetails:
            p.shippingPara !== null
              ? {
                  "@type": "OfferShippingDetails",
                  shippingRate: {
                    "@type": "MonetaryAmount",
                    value: (p.shippingPara / 100).toFixed(2),
                    currency: "RSD",
                  },
                  shippingDestination: { "@type": "DefinedRegion", addressCountry: "RS" },
                }
              : undefined,
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "RS",
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 14,
          },
        })
      : undefined;
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    mpn: p.mpn ?? undefined,
    gtin13: p.ean && /^\d{13}$/.test(p.ean) ? p.ean : undefined,
    brand: { "@type": "Brand", name: p.manufacturer },
    category: p.category,
    description: p.description,
    image: p.images.map(abs),
    offers: offer,
  });
}

export function itemListJsonLd(items: { name: string; slug: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: abs(`/deo/${item.slug}`),
      name: item.name,
    })),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Safe serialisation for a `<script type="application/ld+json">` body. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
