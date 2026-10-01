import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { accusativeSr, listMoreSr } from "@/lib/seo/templates";
import { pluralSr } from "@/lib/format/plural";
import { getSettingsPublic, getVehicleLandings, getVehicleTree } from "@/lib/server/catalog-cache";
import { findBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingLinks } from "@/components/seo/LandingLinks";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata({
  params,
}: PageProps<"/vozila/[marka]">): Promise<Metadata> {
  const { marka } = await params;
  const [tree, settings] = await Promise.all([getVehicleTree(), getSettingsPublic()]);
  const brand = findBrand(tree, marka);
  if (!brand) notFound();
  const name = accusativeSr(brand.brand.name);
  return buildMetadata({
    title: `Delovi za ${name} — svi modeli`,
    description: `Delovi za ${name}: ${listMoreSr(
      brand.models.map((m) => m.model.name),
      6,
    )}. Izaberite generaciju i pogledajte delove koji odgovaraju.`,
    path: ROUTES.vehicleBrand(marka),
    titleSuffix: settings.seo.titleSuffix,
  });
}

export default async function VehicleBrandPage({ params }: PageProps<"/vozila/[marka]">) {
  const { marka } = await params;
  const [tree, landings] = await Promise.all([getVehicleTree(), getVehicleLandings(marka)]);
  const brand = findBrand(tree, marka);
  if (!brand) notFound();
  const crumbs = [
    { label: "Početna", href: ROUTES.home },
    { label: "Vozila", href: ROUTES.vehicles },
    { label: brand.brand.name },
  ];
  const name = accusativeSr(brand.brand.name);
  const generationCount = brand.models.reduce((n, m) => n + m.generations.length, 0);
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <RevealText as="h1" className="mt-4 type-display-l uppercase text-ink-1">
        {`Delovi za ${name}`}
      </RevealText>
      <RevealText as="p" className="mt-4 max-w-[60ch] type-lead text-ink-2">
        {`Za ${name} vodimo ${brand.models.length} ${pluralSr(brand.models.length, ["model", "modela", "modela"])} i ${generationCount} ${pluralSr(generationCount, ["generaciju", "generacije", "generacija"])}. Izaberite generaciju: prikazujemo samo delove kojima je uneta kompatibilnost sa njom.`}
      </RevealText>
      <div className="mt-10 grid gap-x-(--gutter) gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {brand.models.map(({ model, generations }) => (
          <section key={model.slug} aria-labelledby={`m-${model.slug}`}>
            <h2 id={`m-${model.slug}`} className="border-b border-line pb-2 type-h3 text-ink-1">
              <RouteLink
                href={ROUTES.vehicleModel(marka, model.slug)}
                className="hover:text-accent"
              >
                {model.name}
              </RouteLink>
            </h2>
            <ul className="mt-2 flex flex-col">
              {generations.map((g) => (
                <li key={g.slug}>
                  <RouteLink
                    href={ROUTES.vehicleGeneration(marka, model.slug, g.slug)}
                    className="flex min-h-11 items-center justify-between gap-3 py-1 text-ink-2 transition-control hover:text-ink-1"
                  >
                    <span>{g.name}</span>
                    <span className="type-caption tabular-nums text-ink-3">{yearsLabel(g)}</span>
                  </RouteLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <LandingLinks
        id="brand-landings-title"
        title={`Delovi za ${name} po kategorijama`}
        links={landings}
        show="category"
      />
    </div>
  );
}
