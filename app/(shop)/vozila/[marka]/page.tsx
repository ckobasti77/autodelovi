import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { accusativeSr, listMoreSr } from "@/lib/seo/templates";
import { pluralSr } from "@/lib/format/plural";
import { catalogQuery, emptyFilters } from "@/lib/catalog/filters";
import { formatNumber } from "@/lib/format/number";
import {
  getSettingsPublic,
  getVehicleLandings,
  getVehicleParts,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { findBrand, modelHref, type TreeBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";
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

/** Two rows of model panels are on the first screen at 1440 × 900: they enter eagerly. */
const EAGER_MODELS = 6;

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
  const { counts, topCategories } = await brandParts(brand);
  const brandFilter = catalogQuery({ ...emptyFilters(), vehicle: { brand: marka } });
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
      {/*
        One panel per model: its name (the model hub) over its generations as rows. Three
        columns at most — a row of generation name, years and count needs the width, and six
        or three models then fill their rows.
      */}
      <RevealGroup className="mt-block grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {brand.models.map(({ model, generations }, i) => (
          <RevealItem
            as="section"
            key={model.slug}
            eager={i < EAGER_MODELS}
            index={i}
            aria-labelledby={`m-${model.slug}`}
            className="overflow-hidden panel"
          >
            <h2 id={`m-${model.slug}`} className="px-4 pt-4 pb-3 type-h3 text-ink-1 sm:px-5">
              <RouteLink
                href={modelHref(marka, { model, generations })}
                className="group inline-flex items-center gap-2 rounded-xs transition-control hover:text-accent"
              >
                {model.name}
                <ArrowRightIcon
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
                />
              </RouteLink>
            </h2>
            <ul className="flex flex-col border-t border-line">
              {generations.map((g) => (
                <li key={g.slug} className="border-b border-line-faint last:border-b-0">
                  <RouteLink
                    href={ROUTES.vehicleGeneration(marka, model.slug, g.slug)}
                    className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-ink-1 transition-control hover:bg-surface-2 focus-ring-inset sm:px-5"
                  >
                    <span className="type-body-s font-semibold">{g.name}</span>
                    <span className="text-right type-caption font-normal tabular-nums text-ink-3">
                      {yearsLabel(g)} · {formatNumber(counts.get(g._id) ?? 0)}{" "}
                      {pluralSr(counts.get(g._id) ?? 0, ["artikal", "artikla", "artikala"])}
                    </span>
                  </RouteLink>
                </li>
              ))}
            </ul>
          </RevealItem>
        ))}
      </RevealGroup>
      {topCategories.length > 0 ? (
        <nav aria-labelledby="brand-categories-title" className="mt-16 border-t border-line pt-8">
          <h2 id="brand-categories-title" className="type-h3 text-ink-1">
            {`Najviše delova za ${name}`}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {topCategories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`${ROUTES.category(c.slug)}${brandFilter}`}
                  variant="unstyled"
                  className="chip-link"
                  aria-label={`${c.name} za ${name}`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <LandingLinks
        id="brand-landings-title"
        title={`Delovi za ${name} po kategorijama`}
        links={landings}
        show="category"
      />
    </div>
  );
}

/**
 * Part counts of every generation of the make (the same cached query the generation pages
 * use) and its categories with the most parts across them (SEO-04).
 */
async function brandParts(brand: TreeBrand) {
  const generations = brand.models.flatMap((m) => m.generations);
  const parts = await Promise.all(
    generations.map((g) => getVehicleParts({ generationId: g._id, topLimit: 8 })),
  );
  const counts = new Map(generations.map((g, i) => [g._id, parts[i]?.total ?? 0] as const));
  const byCategory = new Map<string, { slug: string; name: string; weight: number }>();
  for (const p of parts) {
    for (const { category, count } of p.categories) {
      const row = byCategory.get(category.slug) ?? { slug: category.slug, name: category.name, weight: 0 };
      row.weight += count;
      byCategory.set(category.slug, row);
    }
  }
  const topCategories = [...byCategory.values()].sort((a, b) => b.weight - a.weight).slice(0, 10);
  return { counts, topCategories };
}
