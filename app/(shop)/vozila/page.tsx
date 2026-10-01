import type { Metadata } from "next";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pluralSr } from "@/lib/format/plural";
import { getSettingsPublic, getVehicleTree } from "@/lib/server/catalog-cache";
import { modelHref } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Delovi po vozilu — VW, Audi, Škoda, SEAT, Cupra",
    description:
      "Izaberite marku, model i generaciju vozila i pogledajte delove koji odgovaraju: kočnice, vešanje, motor, hlađenje, elektrika i servisni delovi.",
    path: ROUTES.vehicles,
    titleSuffix: settings.seo.titleSuffix,
  });
}

const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Vozila" }];

/** „6 modela · 14 generacija · od 1996. godine“ under a make. */
function brandFacts(models: { generations: { yearFrom: number }[] }[]): string {
  const generations = models.flatMap((m) => m.generations);
  const from = generations.length ? Math.min(...generations.map((g) => g.yearFrom)) : null;
  return [
    `${models.length} ${pluralSr(models.length, ["model", "modela", "modela"])}`,
    `${generations.length} ${pluralSr(generations.length, ["generacija", "generacije", "generacija"])}`,
    from ? `od ${from}. godine` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Vehicle hub: every make with its models (ROUTES §B1 `/vozila`). */
export default async function VehiclesPage() {
  const tree = await getVehicleTree();
  const modelCount = tree.reduce((n, b) => n + b.models.length, 0);
  const generations = tree.reduce(
    (n, b) => n + b.models.reduce((k, m) => k + m.generations.length, 0),
    0,
  );
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1 lg:col-span-7">
          Delovi po vozilu
        </RevealText>
        <RevealText as="p" className="max-w-[60ch] type-lead text-ink-2 lg:col-span-5 lg:self-end">
          {`Izaberite marku i model, pa generaciju. Na stranici generacije su svi delovi koji odgovaraju, po kategorijama. U katalogu je ${tree.length} ${pluralSr(tree.length, ["marka", "marke", "maraka"])}, ${modelCount} ${pluralSr(modelCount, ["model", "modela", "modela"])} i ${generations} ${pluralSr(generations, ["generacija", "generacije", "generacija"])} grupe Volkswagen.`}
        </RevealText>
      </div>
      <div className="mt-12 grid gap-x-(--gutter) gap-y-12 md:grid-cols-2 xl:grid-cols-3">
        {tree.map(({ brand, models }) => (
          <section key={brand.slug} aria-labelledby={`b-${brand.slug}`}>
            <h2 id={`b-${brand.slug}`} className="border-b border-line pb-3 type-display-m uppercase text-ink-1">
              <RouteLink href={ROUTES.vehicleBrand(brand.slug)} className="hover:text-accent">
                {brand.name}
              </RouteLink>
            </h2>
            <p className="mt-2 type-caption text-ink-3">
              {brandFacts(models)}
            </p>
            <ul className="mt-3 flex flex-col">
              {models.map((m) => (
                <li key={m.model.slug} className="border-b border-line-faint">
                  <RouteLink
                    href={modelHref(brand.slug, m)}
                    className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-ink-1 transition-control hover:text-accent"
                  >
                    <span className="type-body">{m.model.name}</span>
                    <span className="type-caption font-normal text-ink-3">
                      {m.generations.length > 0
                        ? `${m.generations[0].yearFrom}–${m.generations[m.generations.length - 1].yearTo ?? ""}`
                        : ""}
                    </span>
                  </RouteLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
