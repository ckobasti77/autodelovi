/**
 * Typed JSON-LD builders (SEO-ADS §J2). Only filled fields are emitted; no ratings or reviews
 * (none exist); no HowTo. Rendered by `components/seo/JsonLd.tsx` into the server HTML, and
 * parsed back out of rendered pages by the e2e SEO spec.
 */
import { site } from "@/config/site";

export type JsonLd = Record<string, unknown>;

const abs = (path: string) => new URL(path, site.url).toString();

/** Stable node ids so WebSite / products can reference the store. */
export const ORGANIZATION_ID = () => `${abs("/")}#organizacija`;
export const WEBSITE_ID = () => `${abs("/")}#sajt`;

const compact = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  ) as T;

/** Money as schema.org expects it: a plain decimal string with two places. */
export const decimal = (para: number) => (para / 100).toFixed(2);

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

export function websiteJsonLd(name: string = site.brand.name): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID(),
    name,
    url: abs("/"),
    inLanguage: site.locale,
    publisher: { "@id": ORGANIZATION_ID() },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${abs("/pretraga")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export type StoreInfo = {
  /** Brand (display) name; `legalName` is the registered company name when known. */
  name: string;
  legalName?: string;
  telephone?: string;
  email?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  mapUrl?: string;
  vatId?: string;
  hours: { day: number; open: string; close: string; closed: boolean }[];
  /** Social / listing profiles (Google Business Profile, Facebook …) when the owner has them. */
  sameAs?: string[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The business node: `AutoPartsStore` (a LocalBusiness) when a street address exists in the
 * settings, otherwise a plain `Organization` — Google requires an address for local
 * business markup, and we never invent one.
 */
export function storeJsonLd(info: StoreInfo): JsonLd {
  const hasAddress = Boolean(info.street && info.city);
  const address = hasAddress
    ? compact({
        "@type": "PostalAddress",
        streetAddress: info.street,
        addressLocality: info.city,
        postalCode: info.postalCode,
        addressCountry: "RS",
      })
    : undefined;
  const open = info.hours.filter((h) => !h.closed);
  const common = {
    "@context": "https://schema.org",
    "@id": ORGANIZATION_ID(),
    name: info.name,
    legalName: info.legalName && info.legalName !== info.name ? info.legalName : undefined,
    url: abs("/"),
    logo: abs("/apple-icon.png"),
    telephone: info.telephone,
    email: info.email,
    vatID: info.vatId,
    sameAs: info.sameAs?.filter(Boolean),
  };
  if (!hasAddress) {
    return compact({
      ...common,
      "@type": "Organization",
      areaServed: { "@type": "Country", name: "Srbija" },
      contactPoint: info.telephone
        ? {
            "@type": "ContactPoint",
            telephone: info.telephone,
            contactType: "customer service",
            areaServed: "RS",
            availableLanguage: "sr",
          }
        : undefined,
    });
  }
  return compact({
    ...common,
    "@type": "AutoPartsStore",
    image: abs("/images/hero/car-assembled-1080.webp"),
    address,
    hasMap: info.mapUrl,
    areaServed: { "@type": "Country", name: "Srbija" },
    currenciesAccepted: "RSD",
    paymentAccepted: "Gotovina, platna kartica, uplata na račun",
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
  /** Retail incl. PDV; null when prices are hidden (then no Offer is emitted). */
  pricePara: number | null;
  stockState: "in_stock" | "low_stock" | "out_of_stock" | "on_order";
  /** Courier price; free at or above `freeOverPara`. Null when no courier delivery exists. */
  shippingPara: number | null;
  freeOverPara?: number | null;
  /** Withdrawal window for distance sales (Zakon o zaštiti potrošača: 14 days). */
  returnDays?: number;
  /** Shop name from settings; the config brand otherwise. */
  sellerName?: string;
};

/** Valid EAN-13 (GS1 check digit). */
export function isValidEan13(value: string | null | undefined): value is string {
  if (!value || !/^\d{13}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, 12).reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export function availabilityUrl(state: ProductLdInput["stockState"]): string {
  return state === "in_stock" || state === "low_stock"
    ? "https://schema.org/InStock"
    : state === "on_order"
      ? "https://schema.org/BackOrder"
      : "https://schema.org/OutOfStock";
}

export function productJsonLd(p: ProductLdInput): JsonLd {
  const shippingPara =
    p.shippingPara === null
      ? null
      : p.pricePara !== null && p.freeOverPara && p.pricePara >= p.freeOverPara
        ? 0
        : p.shippingPara;
  const offer =
    p.pricePara !== null && p.pricePara > 0
      ? compact({
          "@type": "Offer",
          url: abs(`/deo/${p.slug}`),
          priceCurrency: "RSD",
          price: decimal(p.pricePara),
          availability: availabilityUrl(p.stockState),
          itemCondition: "https://schema.org/NewCondition",
          // Inline, not only a reference: the Organization node lives on / and /kontakt, so a
          // bare @id leaves the seller unresolved on a product page (SEO-09).
          seller: {
            "@type": "Organization",
            "@id": ORGANIZATION_ID(),
            name: p.sellerName ?? site.brand.name,
          },
          shippingDetails:
            shippingPara !== null
              ? {
                  "@type": "OfferShippingDetails",
                  shippingRate: {
                    "@type": "MonetaryAmount",
                    value: decimal(shippingPara),
                    currency: "RSD",
                  },
                  shippingDestination: { "@type": "DefinedRegion", addressCountry: "RS" },
                }
              : undefined,
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "RS",
            returnPolicyCountry: "RS",
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: p.returnDays ?? 14,
          },
        })
      : undefined;
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    mpn: p.mpn ?? undefined,
    gtin13: isValidEan13(p.ean) ? p.ean : undefined,
    brand: { "@type": "Brand", name: p.manufacturer },
    category: p.category,
    description: p.description,
    image: p.images.map(abs),
    url: abs(`/deo/${p.slug}`),
    offers: offer,
  });
}

export function itemListJsonLd(items: { name: string; slug: string }[], name?: string): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: abs(`/deo/${item.slug}`),
      name: item.name,
    })),
  });
}

/** Only for FAQs that are visible on the same page (Google retired FAQ rich results). */
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

/** All JSON-LD nodes in an HTML document (tests and QA scripts). */
export function extractJsonLd(html: string): JsonLd[] {
  const out: JsonLd[] = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const parsed: unknown = JSON.parse(m[1]!);
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (node && typeof node === "object") out.push(node as JsonLd);
    }
  }
  return out;
}
