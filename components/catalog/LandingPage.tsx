import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CarIcon, ChatCircleTextIcon } from "@phosphor-icons/react/dist/ssr";

import {
  catalogQuery,
  filterDimensions,
  parseCatalogFilters,
  type SearchParamsInput,
} from "@/lib/catalog/filters";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { faqJsonLd } from "@/lib/seo/jsonld";
import {
  landingFaq,
  landingIntro,
  vehicleText,
  yearsText,
  type LandingCopyInput,
} from "@/lib/seo/landingCopy";
import { landingHref, landingLabel, landingPath, landingVehicle } from "@/lib/seo/landingLinks";
import { buildMetadata } from "@/lib/seo/metadata";
import { landingMeta } from "@/lib/seo/templates";
import {
  getCategory,
  getLanding,
  getSettingsPublic,
  resolveVehicle,
} from "@/lib/server/catalog-cache";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { CategoryListingView, loadListing } from "@/components/catalog/CategoryListingView";
import { ROUTES } from "@/constants/routes";

/**
 * Programmatic landings `/delovi/[kategorija]/[marka](/[model])` (ROUTES §B1, SEO-ADS §J4):
 * the category listing locked to a make or model, with an intro, generation overview, FAQ and
 * links built from `landingStats`. Indexable only when the thin-content guard admits it
 * (hourly recompute); below the threshold `noindex, follow`; zero products → 404.
 */
async function load(kategorija: string, marka: string, model: string | undefined) {
  const category = await getCategory(kategorija);
  if (!category || category.category.kind === "system") return null;
  const vehicle = await resolveVehicle({
    brandSlug: marka,
    ...(model ? { modelSlug: model } : {}),
  });
  if (!vehicle || (model && !vehicle.model)) return null;
  const stats = await getLanding({
    categorySlug: kategorija,
    brandSlug: marka,
    ...(model ? { modelSlug: model } : {}),
  });
  return { category, vehicle, stats };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

function copyInput(data: Loaded): LandingCopyInput | null {
  const s = data.stats;
  if (!s) return null;
  return {
    categoryName: data.category.category.name,
    brandName: data.vehicle.brand.name,
    modelName: data.vehicle.model?.name ?? null,
    productCount: s.productCount,
    inStockCount: s.inStockCount,
    price: s.price,
    manufacturerCount: s.manufacturerCount,
    manufacturers: s.manufacturers,
    topOems: s.topOems,
    generations: s.generations,
    engines: s.engines,
  };
}

export async function landingMetadata(
  kategorija: string,
  marka: string,
  model: string | undefined,
  searchParams: SearchParamsInput,
): Promise<Metadata> {
  const [data, settings] = await Promise.all([load(kategorija, marka, model), getSettingsPublic()]);
  if (!data) return {};
  const path = landingPath(kategorija, marka, model);
  const s = data.stats;
  const text = landingMeta({
    categoryName: data.category.category.name,
    brandName: data.vehicle.brand.name,
    modelName: data.vehicle.model?.name ?? null,
    productCount: s?.productCount ?? null,
    inStockCount: s?.inStockCount ?? null,
    price: s?.price ?? null,
    manufacturers: s?.manufacturers.map((m) => m.name) ?? [],
    generations: s?.generations.map((g) => g.name) ?? [],
  });
  // Any parameter (generation, filters, sort, page) → canonical to the clean landing URL;
  // the parameterised view is only a filtered copy of it.
  const hasParams = Object.values(searchParams).some((v) => v !== undefined && v !== "");
  return buildMetadata({
    ...text,
    path,
    noindex: !s?.indexable || hasParams,
    titleSuffix: settings.seo.titleSuffix,
  });
}

export async function LandingPage({
  kategorija,
  marka,
  model,
  searchParams,
}: {
  kategorija: string;
  marka: string;
  model?: string;
  searchParams: SearchParamsInput;
}) {
  const data = await load(kategorija, marka, model);
  if (!data) notFound();
  const { category, vehicle, stats } = data;
  const parsed = parseCatalogFilters(searchParams);
  const generation =
    model && parsed.vehicle?.model === model ? parsed.vehicle.generation : undefined;
  const filters = {
    ...parsed,
    vehicle: {
      brand: marka,
      ...(model ? { model } : {}),
      ...(generation ? { generation } : {}),
      ...(generation && parsed.vehicle?.engine ? { engine: parsed.vehicle.engine } : {}),
    },
  };
  const listing = await loadListing(category, filters);
  if (listing.listing.total === 0 && filterDimensions(filters) === 1) notFound();
  const basePath = landingPath(kategorija, marka, model);
  const crumbs: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
    { label: category.category.name, href: ROUTES.category(kategorija) },
  ];
  if (model) crumbs.push({ label: vehicle.brand.name, href: landingPath(kategorija, marka) });
  crumbs.push({ label: model && vehicle.model ? vehicle.model.name : vehicle.brand.name });

  const copy = copyInput(data);
  const faq = copy ? landingFaq(copy) : [];
  const vehicleName = copy ? vehicleText(copy) : vehicle.brand.name;
  const title = `${category.category.name} za ${vehicleName}`;
  const vehicleHref = vehicle.model
    ? ROUTES.vehicleModel(marka, vehicle.model.slug)
    : ROUTES.vehicleBrand(marka);

  return (
    <CategoryListingView
      category={category}
      filters={filters}
      data={listing}
      basePath={basePath}
      title={title}
      crumbs={crumbs}
      intro={category.intro}
      listName={title}
      jsonLd={faq.length ? [faqJsonLd(faq)] : []}
      lead={
        copy ? (
          <RevealText as="p" className="max-w-[72ch] type-lead text-ink-2">
            {landingIntro(copy)}
          </RevealText>
        ) : undefined
      }
    >
      {stats && stats.generations.length > 0 ? (
        <section aria-labelledby="generations-title" className="mt-16 border-t border-line pt-8">
          <h2 id="generations-title" className="type-h3 text-ink-1">
            {model ? `${category.category.name} po generaciji` : `Najviše delova za modele`}
          </h2>
          <ul className="mt-4 grid gap-x-(--gutter) gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {stats.generations.slice(0, 12).map((g) => {
              const href = model
                ? `${basePath}${catalogQuery({ ...filters, vehicle: { brand: marka, model, generation: g.slug }, page: 1 })}`
                : ROUTES.vehicleGeneration(marka, g.modelSlug, g.slug);
              return (
                <li
                  key={`${g.modelSlug}-${g.slug}`}
                  className="flex items-baseline justify-between gap-3 border-b border-line py-2.5"
                >
                  <Link href={href} variant="standalone">
                    {g.name}
                  </Link>
                  <span className="type-body-s tabular-nums text-ink-3" data-reveal="off">
                    {yearsText(g.yearFrom, g.yearTo)} · {formatNumber(g.count)}{" "}
                    {pluralSr(g.count, ["artikal", "artikla", "artikala"])}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {faq.length > 0 ? (
        <section aria-labelledby="landing-faq-title" className="mt-16 border-t border-line pt-8">
          <h2 id="landing-faq-title" className="type-h3 text-ink-1">
            Pitanja o delovima za {vehicleName}
          </h2>
          <dl className="mt-4 grid max-w-[80ch] gap-6">
            {faq.map((f) => (
              <div key={f.question} className="flex flex-col gap-1.5">
                <dt className="type-body font-semibold text-ink-1">{f.question}</dt>
                <dd className="type-body text-ink-2">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {stats && (stats.siblings.length > 0 || stats.otherCategories.length > 0) ? (
        <nav
          aria-label="Srodne strane"
          className="mt-16 grid gap-10 border-t border-line pt-8 lg:grid-cols-2 lg:gap-x-(--gutter)"
        >
          {stats.siblings.length > 0 ? (
            <div>
              <h2 className="type-h3 text-ink-1">{category.category.name} za druge modele</h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {stats.siblings.map((l) => (
                  <li key={landingHref(l)}>
                    <Link href={landingHref(l)} variant="standalone">
                      {landingVehicle(l)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {stats.otherCategories.length > 0 ? (
            <div>
              <h2 className="type-h3 text-ink-1">Drugi delovi za {vehicleName}</h2>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {stats.otherCategories.map((l) => (
                  <li key={landingHref(l)}>
                    <Link href={landingHref(l)} variant="standalone" aria-label={landingLabel(l)}>
                      {l.categoryName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>
      ) : null}

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild variant="secondary" icon={<CarIcon size={20} />}>
          <Link href={vehicleHref} variant="unstyled">
            Svi delovi za {vehicleName}
          </Link>
        </Button>
        <Button asChild variant="ghost" icon={<ChatCircleTextIcon size={20} />}>
          <Link href={ROUTES.inquiryWith({ deo: kategorija })} variant="unstyled">
            Ne nalazite deo? Pošaljite upit
          </Link>
        </Button>
      </div>
    </CategoryListingView>
  );
}
