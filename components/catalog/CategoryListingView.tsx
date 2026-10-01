import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  CarIcon,
  ChatCircleTextIcon,
  ListMagnifyingGlassIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { Id } from "@/convex/_generated/dataModel";
import { catalogQuery, type CatalogFilters } from "@/lib/catalog/filters";
import type { CategoryDetail, ProductCardData } from "@/lib/catalog/types";
import { breadcrumbJsonLd, itemListJsonLd, type JsonLd as JsonLdData } from "@/lib/seo/jsonld";
import { getCategoryListing, getManufacturers, resolveVehicle } from "@/lib/server/catalog-cache";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Pagination } from "@/components/ui/Pagination";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  CatalogResults,
  CatalogShell,
  CatalogToolbar,
  FilterRail,
  VehicleUrlSync,
  type CatalogFacets,
} from "@/components/catalog/CatalogControls";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { TrackViewList } from "@/components/catalog/TrackViewList";
import { ROUTES } from "@/constants/routes";

export type ResolvedVehicle = Awaited<ReturnType<typeof resolveVehicle>>;

/** Resolve URL vehicle slugs to Convex ids + a label (null when the slugs are unknown). */
export async function vehicleForFilters(filters: CatalogFilters) {
  if (!filters.vehicle) return { resolved: null, ids: undefined };
  const resolved = await resolveVehicle({
    brandSlug: filters.vehicle.brand,
    ...(filters.vehicle.model ? { modelSlug: filters.vehicle.model } : {}),
    ...(filters.vehicle.generation ? { generationSlug: filters.vehicle.generation } : {}),
    ...(filters.vehicle.engine ? { engineSlug: filters.vehicle.engine } : {}),
  });
  if (!resolved) return { resolved: null, ids: undefined };
  return {
    resolved,
    ids: {
      brandId: resolved.brand._id,
      ...(resolved.model ? { modelId: resolved.model._id } : {}),
      ...(resolved.generation ? { generationId: resolved.generation._id } : {}),
      ...(resolved.engine ? { engineId: resolved.engine._id } : {}),
    },
  };
}

/** Short vehicle name for sentences („Golf VII 2.0 TDI“ / „VW Golf“). */
export function vehicleSentenceName(resolved: NonNullable<ResolvedVehicle>): string {
  const brand = resolved.brand.slug === "volkswagen" ? "VW" : resolved.brand.name;
  const base =
    resolved.generation?.name ??
    (resolved.model ? `${brand} ${resolved.model.name}` : resolved.brand.name);
  return resolved.engine ? `${base} ${resolved.engine.name}` : base;
}

export async function loadListing(category: CategoryDetail, filters: CatalogFilters) {
  const [{ resolved, ids }, manufacturers] = await Promise.all([
    vehicleForFilters(filters),
    getManufacturers(),
  ]);
  const bySlug = new Map(manufacturers.map((m) => [m.slug, m]));
  const byId = new Map(manufacturers.map((m) => [m._id as string, m]));
  const manufacturerIds = filters.manufacturers
    .map((s) => bySlug.get(s)?._id)
    .filter((id): id is Id<"manufacturers"> => Boolean(id));
  const listing = await getCategoryListing({
    categorySlug: category.category.slug,
    ...(ids ? { vehicle: ids } : {}),
    ...(manufacturerIds.length ? { manufacturerIds } : {}),
    ...(filters.qualities.length ? { qualities: filters.qualities } : {}),
    availability: filters.inStock ? "in_stock" : "all",
    ...(filters.priceMin !== null ? { priceMinPara: filters.priceMin * 100 } : {}),
    ...(filters.priceMax !== null ? { priceMaxPara: filters.priceMax * 100 + 99 } : {}),
    sort: filters.sort,
    page: filters.page,
    pageSize: 24,
  });
  if (!listing) notFound();
  const facets: CatalogFacets = {
    manufacturers: listing.facets.manufacturers
      .map((m) => ({ slug: byId.get(m.id)?.slug ?? "", name: m.name, count: m.count }))
      .filter((m) => m.slug),
    qualities: listing.facets.qualities,
    inStockCount: listing.facets.inStockCount,
    allCount: listing.facets.allCount,
    price: listing.facets.price
      ? {
          minDinars: Math.floor(listing.facets.price.minPara / 100),
          maxDinars: Math.ceil(listing.facets.price.maxPara / 100),
        }
      : null,
  };
  const manufacturerNames = Object.fromEntries(manufacturers.map((m) => [m.slug, m.name]));
  return { listing, facets, resolved, manufacturerNames };
}

type Listing = Awaited<ReturnType<typeof loadListing>>;

function splitIntro(intro: string): [string, string] {
  const sentences = intro.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [intro];
  const first = sentences.slice(0, 2).join("").trim();
  return [first, intro.slice(first.length).trim()];
}

/**
 * Category listing (§10.2): breadcrumbs, H1 (display caps), SEO intro, vehicle notice,
 * filter rail + toolbar + grid + pagination, related categories, JSON-LD.
 */
export function CategoryListingView({
  category,
  filters,
  data,
  basePath,
  title,
  crumbs,
  intro,
  lead,
  listName,
  jsonLd = [],
  children,
}: {
  category: CategoryDetail;
  filters: CatalogFilters;
  data: Listing;
  basePath: string;
  title: string;
  crumbs: Crumb[];
  intro: string | null;
  /** Replaces the category intro under the H1 (landings: data-driven intro). */
  lead?: ReactNode;
  /** ItemList name in JSON-LD. */
  listName?: string;
  /** Extra JSON-LD nodes (e.g. the landing FAQ). */
  jsonLd?: JsonLdData[];
  /** Sections after the results (landing generations, FAQ, internal links). */
  children?: ReactNode;
}) {
  const { listing, facets, resolved, manufacturerNames } = data;
  const vehicleName = resolved ? vehicleSentenceName(resolved) : null;
  const fitFor = (card: ProductCardData) => {
    if (!resolved || !resolved.generation || !vehicleName) return null;
    if (card.universal) return { kind: "universal" as const, vehicle: vehicleName };
    return resolved.engine
      ? { kind: "fits" as const, vehicle: vehicleName }
      : { kind: "generation_only" as const, vehicle: vehicleName };
  };
  const [introLead, introRest] = intro ? splitIntro(intro) : ["", ""];
  const name = category.category.name;
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const categoryPath = ROUTES.category(category.category.slug);
  const hrefFor = (page: number) =>
    basePath !== categoryPath && page === 1
      ? basePath
      : `${categoryPath}${catalogQuery({ ...filters, page })}`;
  const inquiryHref = ROUTES.inquiryWith({ deo: category.category.slug });

  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          itemListJsonLd(
            listing.items.map((i) => ({ name: i.name, slug: i.slug })),
            listName ?? title,
          ),
          ...jsonLd,
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 grid gap-4 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <RevealText as="h1" className="type-display-l text-ink-1 uppercase">
            {title}
          </RevealText>
          {lead ? (
            lead
          ) : introLead ? (
            <RevealText as="p" className="max-w-[72ch] type-lead text-ink-2">
              {introLead}
            </RevealText>
          ) : null}
          {!lead && introRest ? (
            <Disclosure
              className="group max-w-[72ch]"
              summaryClassName="inline-flex min-h-11 items-center gap-1 type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent"
              summary={
                <>
                  <span className="group-open:hidden">Više o kategoriji</span>
                  <span className="hidden group-open:inline">Manje</span>
                </>
              }
            >
              <p className="pt-2 type-body text-ink-2">{introRest}</p>
            </Disclosure>
          ) : null}
        </div>
      </header>

      <CatalogShell navigateBase={categoryPath}>
        <VehicleUrlSync filters={filters} />
        <div className="mt-8 grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-(--gutter)">
          <FilterRail filters={filters} facets={facets} vehicleLabel={resolved?.label ?? null} />
          <div className="flex min-w-0 flex-col gap-5">
            <CatalogToolbar
              filters={filters}
              facets={facets}
              total={listing.total}
              vehicleLabel={resolved?.label ?? null}
              manufacturerNames={manufacturerNames}
            />
            <CatalogResults>
              {listing.items.length > 0 ? (
                <>
                  <h2 className="sr-only">Artikli</h2>
                  <TrackViewList
                    listId={`category:${category.category.slug}`}
                    listName={name}
                    items={listing.items}
                  />
                  <ProductGrid items={listing.items} fitFor={fitFor} withRail preloadFirst />
                  {listing.pageCount > 1 ? (
                    <Pagination
                      page={listing.page}
                      pageCount={listing.pageCount}
                      hrefFor={hrefFor}
                      className="mt-10"
                    />
                  ) : null}
                  {listing.truncated ? (
                    <p className="mt-6 type-caption font-normal text-ink-3">
                      Prikazan je deo ponude. Izaberite vozilo ili proizvođača za tačniji spisak.
                    </p>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  icon={<ListMagnifyingGlassIcon size={44} />}
                  as="h2"
                  title={
                    vehicleName ? `Nema delova za ${vehicleName}` : "Nema artikala za ovaj izbor"
                  }
                  action={
                    <>
                      <Button asChild variant="primary" icon={<ChatCircleTextIcon size={20} />}>
                        <Link href={inquiryHref} variant="unstyled">
                          Pošaljite upit
                        </Link>
                      </Button>
                      {filters.vehicle ? (
                        <Button asChild variant="secondary" icon={<CarIcon size={20} />}>
                          <Link
                            href={`${basePath}${catalogQuery({ ...filters, vehicle: null, page: 1 })}`}
                            variant="unstyled"
                          >
                            Prikaži za sva vozila
                          </Link>
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  {vehicleName
                    ? `Za ${vehicleName} trenutno nemamo ${lower} na stanju. Pošaljite upit — proverićemo kod dobavljača i javiti vam se u toku radnog dana.`
                    : "Promenite filtere ili pošaljite upit — proverićemo kod dobavljača."}
                </EmptyState>
              )}
            </CatalogResults>
          </div>
        </div>
      </CatalogShell>

      {children}

      {category.related.length > 0 ? (
        <nav aria-labelledby="related-title" className="mt-16 border-t border-line pt-8">
          <h2 id="related-title" className="type-h3 text-ink-1">
            Povezani delovi
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {category.related.map((r) => (
              <li key={r.slug}>
                <Link href={ROUTES.category(r.slug)} variant="standalone">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
