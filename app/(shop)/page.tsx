import type { Metadata } from "next";

import { catalogProductCount, categoryProductCount } from "@/lib/catalog/types";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { markdownToText } from "@/lib/content/markdown";
import { formatNumber } from "@/lib/format/number";
import { formatRSD } from "@/lib/format/money";
import { faqJsonLd, storeJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { storeInfoFromSettings } from "@/lib/seo/store";
import { buildMetadata } from "@/lib/seo/metadata";
import { contactFromSettings, placeholderValues } from "@/lib/settings/public";
import {
  getCategoryListing,
  getCategoryTree,
  getFaqs,
  getPublicTiers,
  getSettingsPublic,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroSection } from "@/components/three/HeroSection";
import { SystemsIndex } from "@/components/three/SystemsIndex";
import {
  ContactStrip,
  HomeCategories,
  HomeFaq,
  HomeFeatured,
  HowOrdering,
  MakesCovered,
  MechanicsBand,
  TrustFacts,
} from "@/components/home/HomeSections";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    // 27 characters, so both names of the shop fit behind it (D309); the description and the
    // page itself carry all five makes.
    title: "Auto delovi VW, Audi, Škoda",
    description:
      "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra: pretraga po OEM broju i vozilu, cene sa PDV-om i stanje. Plaćanje pouzećem ili pri preuzimanju u radnji.",
    path: "/",
    titleSuffix: settings.seo.titleSuffix,
  });
}

/** Categories whose most ordered part in stock is shown on the home page (one card each). */
const FEATURED_PART_CATEGORIES = [
  "kocione-plocice",
  "kocioni-diskovi",
  "amortizeri-opruge",
  "filteri",
];

/**
 * Home (§10.1): the 3D hero (step 10), how ordering works, featured categories with renders,
 * parts in stock, the systems index (the 3D car's text equivalent), the mechanics band, makes
 * covered, facts from data and settings, FAQ and the contact strip.
 */
export default async function HomePage() {
  const [settings, tree, vehicles, faqs, tiers, featuredListings] = await Promise.all([
    getSettingsPublic(),
    getCategoryTree(),
    getVehicleTree(),
    getFaqs("home"),
    getPublicTiers(),
    Promise.all(
      FEATURED_PART_CATEGORIES.map((categorySlug) =>
        getCategoryListing({
          categorySlug,
          availability: "in_stock",
          sort: "popular",
          page: 1,
          pageSize: 1,
        }),
      ),
    ),
  ]);
  const featuredParts = featuredListings.flatMap((listing) => listing?.items ?? []);
  const categoryCounts = Object.fromEntries(
    tree.categories.map((c) => [c.slug, categoryProductCount(tree, c)]),
  );
  const values = placeholderValues(settings);
  const faqItems = faqs.map((f) => ({
    question: f.question,
    answer: fillPlaceholders(f.answerMd, values),
  }));
  const contact = contactFromSettings(settings);
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  const courierLine = courier
    ? `Kurir ${formatRSD(courier.pricePara)}${courier.freeOverPara ? `, besplatno iznad ${formatRSD(courier.freeOverPara)}` : ""}; preuzimanje u radnji bez troška.`
    : null;
  const { all: products, inStock } = catalogProductCount(tree);
  const computed = [
    ...(products > 0 ? [{ label: "artikala u katalogu", value: formatNumber(products) }] : []),
    ...(inStock > 0 ? [{ label: "artikala na stanju", value: formatNumber(inStock) }] : []),
    { label: "kategorija delova", value: formatNumber(tree.categories.length) },
    {
      label: "generacija vozila",
      value: formatNumber(
        vehicles.reduce((n, b) => n + b.models.reduce((m, x) => m + x.generations.length, 0), 0),
      ),
    },
  ];

  return (
    <>
      <JsonLd
        data={[
          websiteJsonLd(settings.brand.name),
          storeJsonLd(storeInfoFromSettings(settings)),
          ...(faqItems.length
            ? [
                faqJsonLd(
                  faqItems.map((f) => ({ question: f.question, answer: markdownToText(f.answer) })),
                ),
              ]
            : []),
        ]}
      />
      <HeroSection />
      <HowOrdering courierLine={courierLine} />
      <HomeCategories tree={tree} />
      <HomeFeatured items={featuredParts} />
      <SystemsIndex counts={categoryCounts} />
      <MechanicsBand tiers={tiers} />
      <MakesCovered tree={vehicles} />
      <TrustFacts facts={settings.trustFacts} computed={computed} />
      <HomeFaq items={faqItems} />
      <ContactStrip contact={contact} />
    </>
  );
}
