import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata, DESCRIPTION_MAX } from "@/lib/seo/metadata";
import { accusativeSr, fitSentences, listMoreSr } from "@/lib/seo/templates";
import {
  getSettingsPublic,
  getVehicleLandings,
  getVehicleParts,
  getVehicleTree,
} from "@/lib/server/catalog-cache";
import { findBrand, findModel, shortBrand, yearsLabel } from "@/lib/vehicle/hub";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingLinks } from "@/components/seo/LandingLinks";
import { ROUTES } from "@/constants/routes";

const ARTIKAL = ["artikal", "artikla", "artikala"] as const;

/** The first row of generation cards is on the first screen: it enters eagerly. */
const EAGER_CARDS = 5;

const WIDE_LG = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as const;
const WIDE_XL = {
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
} as const;

/**
 * Columns for `count` cards with at most `max` in a row, so that the last row is never a card
 * on its own: all in one row when they fit, else the widest grid they divide into, else the
 * widest one that leaves more than one card in the last row.
 */
function columnsFor<M extends 4 | 5>(count: number, max: M): 2 | 3 | 4 | M {
  type Columns = 2 | 3 | 4 | M;
  if (count <= max) return Math.max(count, 2) as Columns;
  const candidates = (max === 5 ? [5, 4, 3] : [4, 3]) as Columns[];
  return (
    candidates.find((c) => count % c === 0) ?? candidates.find((c) => count % c !== 1) ?? max
  );
}

/**
 * The model and its generations with their real part counts. A model with a single
 * generation has no hub of its own: its URL is a permanent redirect to that generation, which
 * carries the same content and more (SEO-04, D255) — resolved here, before anything streams.
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
  const gens = data.generations.map(
    ({ generation: g, total }) => `${g.name} (${formatNumber(total)} ${pluralSr(total, ARTIKAL)})`,
  );
  // Whole generations only: the list shrinks to „… i još N“ instead of being cut mid-name.
  let description = "";
  for (let shown = gens.length; shown >= 1 && !description; shown -= 1) {
    const text = `Delovi za ${name} po generacijama: ${listMoreSr(gens, shown, { nameLast: false })}.`;
    if (text.length <= DESCRIPTION_MAX) description = text;
  }
  return buildMetadata({
    title: `Delovi za ${name} — sve generacije`,
    description: fitSentences(
      [
        description ||
          `Delovi za ${name}: ${gens.length} ${pluralSr(gens.length, ["generacija", "generacije", "generacija"])} u katalogu.`,
      ],
      ["Izaberite generaciju i pogledajte delove po kategorijama."],
    ),
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
      <RevealGroup
        as="ul"
        className={cn(
          "mt-block grid gap-3 sm:grid-cols-2 lg:gap-4",
          // An odd count leaves one card alone in two columns: it takes the row.
          "max-lg:sm:[&>li:last-child:nth-child(odd)]:col-span-2",
          WIDE_LG[columnsFor(data.generations.length, 4)],
          WIDE_XL[columnsFor(data.generations.length, 5)],
        )}
      >
        {data.generations.map(({ generation: g, total, categories }, i) => (
          <RevealItem as="li" key={g.slug} eager={i < EAGER_CARDS} index={i}>
            <RouteLink
              href={ROUTES.vehicleGeneration(marka, model, g.slug)}
              className="group flex h-full flex-col panel card-interactive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="flex flex-col gap-1 px-4 pt-4 pb-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="type-h3 text-ink-1">{g.name}</span>
                  <ArrowRightIcon
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
                  />
                </span>
                <span className="type-body-s tabular-nums text-ink-2">
                  {yearsLabel(g)} · {formatNumber(total)} {pluralSr(total, ARTIKAL)}
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-1.5 border-t border-line-faint px-4 pt-3 pb-4">
                {categories.length ? (
                  <span className="type-caption font-normal text-ink-2">
                    {listMoreSr(categories, 3)}
                  </span>
                ) : null}
                {g.platform ? (
                  <span className="type-caption font-normal text-ink-3">
                    Platforma {g.platform}
                  </span>
                ) : null}
                {g.vinModelCodes.length ? (
                  <span className="type-caption font-normal text-ink-3">
                    VIN kod{" "}
                    <span className="type-code text-ink-2">{g.vinModelCodes.join(", ")}</span>
                  </span>
                ) : null}
              </span>
            </RouteLink>
          </RevealItem>
        ))}
      </RevealGroup>
      <LandingLinks
        id="model-landings-title"
        title={`Delovi za ${accusativeSr(`${shortBrand(data.brand.brand)} ${data.model.model.name}`)} po kategorijama`}
        links={landings}
        show="category"
      />
    </div>
  );
}
