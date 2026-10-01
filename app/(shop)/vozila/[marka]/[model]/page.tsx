import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { accusativeSr, listMoreSr, listSr } from "@/lib/seo/templates";
import {
  getSettingsPublic,
  getVehicleLandings,
  getVehicleParts,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { findBrand, findModel, shortBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingLinks } from "@/components/seo/LandingLinks";
import { ROUTES } from "@/constants/routes";

const ARTIKAL = ["artikal", "artikla", "artikala"] as const;

/**
 * The model and its generations with their real part counts. A model with a single
 * generation has no hub of its own: its URL is a permanent redirect to that generation, which
 * carries the same content and more (SEO-04, D252) — resolved here, before anything streams.
 */
async function load(marka: string, model: string) {
  const brand = findBrand(await getVehicleTree(), marka);
  const m = brand ? findModel(brand, model) : null;
  if (!brand || !m) return null;
  const only = m.generations.length === 1 ? m.generations[0] : undefined;
  if (only) permanentRedirect(ROUTES.vehicleGeneration(marka, model, only.slug));
  // Same arguments as the generation page, so both share one cached query per generation.
  const parts = await Promise.all(
    m.generations.map((g) => getVehicleParts({ generationId: g._id, topLimit: 8 })),
  );
  const generations = m.generations.map((g, i) => ({
    generation: g,
    total: parts[i]?.total ?? 0,
    categories: (parts[i]?.categories ?? [])
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((c) => c.category.name),
  }));
  return { brand, model: m, generations };
}

export async function generateMetadata({
  params,
}: PageProps<"/vozila/[marka]/[model]">): Promise<Metadata> {
  const { marka, model } = await params;
  const [data, settings] = await Promise.all([load(marka, model), getSettingsPublic()]);
  if (!data) notFound();
  const name = accusativeSr(`${shortBrand(data.brand.brand)} ${data.model.model.name}`);
  return buildMetadata({
    title: `Delovi za ${name} — sve generacije`,
    description: `Delovi za ${name}: ${listSr(
      data.generations.map(
        ({ generation: g, total }) =>
          `${g.name} (${yearsLabel(g)}, ${formatNumber(total)} ${pluralSr(total, ARTIKAL)})`,
      ),
    )}. Izaberite generaciju i pogledajte delove po kategorijama.`,
    path: ROUTES.vehicleModel(marka, model),
    titleSuffix: settings.seo.titleSuffix,
  });
}

export default async function VehicleModelPage({ params }: PageProps<"/vozila/[marka]/[model]">) {
  const { marka, model } = await params;
  const [data, landings] = await Promise.all([
    load(marka, model),
    getVehicleLandings(marka, model),
  ]);
  if (!data) notFound();
  const name = accusativeSr(`${data.brand.brand.name} ${data.model.model.name}`);
  const crumbs = [
    { label: "Početna", href: ROUTES.home },
    { label: "Vozila", href: ROUTES.vehicles },
    { label: data.brand.brand.name, href: ROUTES.vehicleBrand(marka) },
    { label: data.model.model.name },
  ];
  const most = data.generations.reduce<(typeof data.generations)[number] | null>(
    (best, g) => (g.total > (best?.total ?? 0) ? g : best),
    null,
  );
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <RevealText as="h1" className="mt-4 type-display-l uppercase text-ink-1">
        {`Delovi za ${name}`}
      </RevealText>
      <RevealText as="p" className="mt-4 max-w-[60ch] type-lead text-ink-2">
        {`Za ${name} pokrivamo ${data.generations.length} ${pluralSr(data.generations.length, ["generaciju", "generacije", "generacija"])}${
          most
            ? `; najviše delova ima za ${accusativeSr(most.generation.name)} (${formatNumber(most.total)} ${pluralSr(most.total, ARTIKAL)})`
            : ""
        }. Izaberite generaciju. Godine su okvirne; kad niste sigurni, pogledajte oznaku u saobraćajnoj ili pošaljite broj šasije.`}
      </RevealText>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.generations.map(({ generation: g, total, categories }) => (
          <li key={g.slug}>
            <RouteLink
              href={ROUTES.vehicleGeneration(marka, model, g.slug)}
              className="flex h-full flex-col gap-2 rounded-sm border border-line bg-surface-1 p-4 transition-control hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="type-h3 text-ink-1">{g.name}</span>
              <span className="type-body-s tabular-nums text-ink-2">
                {yearsLabel(g)} · {formatNumber(total)} {pluralSr(total, ARTIKAL)}
              </span>
              {categories.length ? (
                <span className="type-caption font-normal text-ink-2">
                  {listMoreSr(categories, 3)}
                </span>
              ) : null}
              {g.platform ? (
                <span className="type-caption font-normal text-ink-3">Platforma {g.platform}</span>
              ) : null}
              {g.vinModelCodes.length ? (
                <span className="type-caption font-normal text-ink-3">
                  VIN kod <span className="type-code text-ink-2">{g.vinModelCodes.join(", ")}</span>
                </span>
              ) : null}
            </RouteLink>
          </li>
        ))}
      </ul>
      <LandingLinks
        id="model-landings-title"
        title={`Delovi za ${accusativeSr(`${shortBrand(data.brand.brand)} ${data.model.model.name}`)} po kategorijama`}
        links={landings}
        show="category"
      />
    </div>
  );
}
