import type { Metadata } from "next";
import { ArrowRightIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { pluralSr } from "@/lib/format/plural";
import { getSettingsPublic, getVehicleTree } from "@/lib/server/catalog-cache";
import { modelHref } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";
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

const GENERATION = ["generacija", "generacije", "generacija"] as const;

/** Makes whose model tiles are on the first screen (1440 × 900): their tiles enter eagerly. */
const EAGER_BRANDS = 3;

/** „6 modela · 14 generacija · od 1996. godine“ under a make. */
function brandFacts(models: { generations: { yearFrom: number }[] }[]): string {
  const generations = models.flatMap((m) => m.generations);
  const from = generations.length ? Math.min(...generations.map((g) => g.yearFrom)) : null;
  return [
    `${models.length} ${pluralSr(models.length, ["model", "modela", "modela"])}`,
    `${generations.length} ${pluralSr(generations.length, GENERATION)}`,
    from ? `od ${from}. godine` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Vehicle hub: every make with its models (ROUTES §B1 `/vozila`). One band per make — the name
 * in display caps with its facts on the left, the models as a grid of tiles beside it. Each
 * tile is one link (a model with a single generation goes straight to it, SEO-04).
 */
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
          {`Izaberite marku i model, pa generaciju. Na stranici generacije su svi delovi koji odgovaraju, po kategorijama. U katalogu je ${tree.length} ${pluralSr(tree.length, ["marka", "marke", "maraka"])}, ${modelCount} ${pluralSr(modelCount, ["model", "modela", "modela"])} i ${generations} ${pluralSr(generations, GENERATION)} grupe Volkswagen.`}
        </RevealText>
      </div>
      <div className="mt-block flex flex-col">
        {tree.map(({ brand, models }, b) => (
          <section
            key={brand.slug}
            aria-labelledby={`b-${brand.slug}`}
            className="grid gap-x-(--gutter) gap-y-5 border-t border-line py-8 lg:grid-cols-12 lg:py-10"
          >
            <div className="flex flex-col gap-2 lg:col-span-3">
              <h2 id={`b-${brand.slug}`} className="type-display-m uppercase text-ink-1">
                <RouteLink
                  href={ROUTES.vehicleBrand(brand.slug)}
                  className="group inline-flex items-center gap-2.5 rounded-xs transition-control hover:text-accent"
                >
                  {brand.name}
                  <ArrowRightIcon
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
                  />
                </RouteLink>
              </h2>
              <p className="type-caption text-ink-3">{brandFacts(models)}</p>
            </div>
            <RevealGroup
              as="ul"
              className="grid grid-cols-2 gap-3 lg:col-span-9 xl:grid-cols-3 max-xl:[&>li:last-child:nth-child(odd)]:col-span-2"
            >
              {models.map((m, i) => {
                const first = m.generations[0];
                const last = m.generations[m.generations.length - 1];
                return (
                  <RevealItem as="li" key={m.model.slug} eager={b < EAGER_BRANDS} index={i}>
                    <RouteLink
                      href={modelHref(brand.slug, m)}
                      className="group flex h-full min-h-16 items-center justify-between gap-3 panel card-interactive px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="type-h4 text-ink-1">{m.model.name}</span>
                        {first && last ? (
                          <span className="type-caption font-normal tabular-nums text-ink-3">
                            {`${first.yearFrom}–${last.yearTo ?? ""}`}
                            <span className="max-sm:hidden">
                              {` · ${m.generations.length} ${pluralSr(m.generations.length, GENERATION)}`}
                            </span>
                          </span>
                        ) : null}
                      </span>
                      <CaretRightIcon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
                      />
                    </RouteLink>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </section>
        ))}
      </div>
    </div>
  );
}
