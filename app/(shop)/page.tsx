import type { Metadata } from "next";

import { catalogProductCount } from "@/lib/catalog/types";
import { fillPlaceholders } from "@/lib/content/placeholders";
import { markdownToText } from "@/lib/content/markdown";
import { formatNumber } from "@/lib/format/number";
import { formatRSD } from "@/lib/format/money";
import { faqJsonLd, storeJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { companyFromSettings, contactFromSettings, placeholderValues } from "@/lib/settings/public";
import {
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
  HowOrdering,
  MakesCovered,
  MechanicsBand,
  TrustFacts,
} from "@/components/home/HomeSections";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Auto delovi za VW, Audi, Škoda, SEAT i Cupra",
    description:
      "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra: pretraga po OEM broju i vozilu, cene sa PDV-om i stanje. Plaćanje pouzećem ili pri preuzimanju u radnji.",
    path: "/",
    titleSuffix: settings.seo.titleSuffix,
  });
}

/**
 * Home (§10.1): the 3D hero (step 10), how ordering works, featured categories with renders,
 * the systems index (the 3D car's text equivalent), the mechanics band, makes covered, facts
 * from data and settings, FAQ and the contact strip.
 */
export default async function HomePage() {
  const [settings, tree, vehicles, faqs, tiers] = await Promise.all([
    getSettingsPublic(),
    getCategoryTree(),
    getVehicleTree(),
    getFaqs("home"),
    getPublicTiers(),
  ]);
  const values = placeholderValues(settings);
  const faqItems = faqs.map((f) => ({ question: f.question, answer: fillPlaceholders(f.answerMd, values) }));
  const contact = contactFromSettings(settings);
  const company = companyFromSettings(settings);
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
      value: formatNumber(vehicles.reduce((n, b) => n + b.models.reduce((m, x) => m + x.generations.length, 0), 0)),
    },
  ];
  const hasAddress = Boolean(contact.address.street && contact.address.city);

  return (
    <>
      <JsonLd
        data={[
          websiteJsonLd(),
          storeJsonLd({
            name: company.legalName || settings.brand.name,
            ...(contact.phone ? { telephone: contact.phone } : {}),
            ...(contact.email ? { email: contact.email } : {}),
            ...(hasAddress
              ? { street: contact.address.street, city: contact.address.city, postalCode: contact.address.postalCode }
              : {}),
            hours: settings.hours,
          }),
          ...(faqItems.length
            ? [faqJsonLd(faqItems.map((f) => ({ question: f.question, answer: markdownToText(f.answer) })))]
            : []),
        ]}
      />
      <HeroSection />
      <HowOrdering courierLine={courierLine} />
      <HomeCategories tree={tree} />
      <SystemsIndex />
      <MechanicsBand tiers={tiers} />
      <MakesCovered tree={vehicles} />
      <TrustFacts facts={settings.trustFacts} computed={computed} />
      <HomeFaq items={faqItems} />
      <ContactStrip contact={contact} />
    </>
  );
}
