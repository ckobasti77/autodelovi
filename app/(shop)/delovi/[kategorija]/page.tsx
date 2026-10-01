import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  filterDimensions,
  listingIndexing,
  parseCatalogFilters,
  type CatalogFilters,
} from "@/lib/catalog/filters";
import { landingPath } from "@/lib/seo/landingLinks";
import { buildMetadata } from "@/lib/seo/metadata";
import type { LandingLinkData } from "@/lib/seo/landingLinks";
import { categoryMeta, pageSuffix, systemMeta } from "@/lib/seo/templates";
import type { CategoryDetail, CategoryTree, ProductCardData } from "@/lib/catalog/types";
import {
  getCategory,
  getCategoryLandings,
  getCategoryListing,
  getCategoryTree,
  getLanding,
  getSettingsPublic,
} from "@/lib/server/catalog-cache";
import { LandingLinks } from "@/components/seo/LandingLinks";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { CategoryListingView, loadListing } from "@/components/catalog/CategoryListingView";
import { SystemHub, systemChildren } from "@/components/catalog/SystemHub";
import { ROUTES } from "@/constants/routes";

function crumbsFor(category: NonNullable<Awaited<ReturnType<typeof getCategory>>>): Crumb[] {
  const items: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
  ];
  if (category.system)
    items.push({ label: category.system.name, href: ROUTES.category(category.system.slug) });
  if (category.parent && category.parent.kind !== "system")
    items.push({ label: category.parent.name, href: ROUTES.category(category.parent.slug) });
  items.push({ label: category.category.name });
  return items;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/delovi/[kategorija]">): Promise<Metadata> {
  const { kategorija } = await params;
  const [category, settings] = await Promise.all([getCategory(kategorija), getSettingsPublic()]);
  // Resolved before the page streams, so a missing category is a real 404 (FLOW-05).
  if (!category) notFound();
  const path = ROUTES.category(category.category.slug);
  const c = category.category;
  if (c.kind === "system") {
    const tree = await getCategoryTree();
    const text = systemMeta({
      name: c.name,
      categories: systemChildren(category, tree).map((x) => ({
        name: x.category.name,
        count: x.count,
      })),
    });
    return buildMetadata({
      title: category.seoTitle ?? text.title,
      description: category.seoDescription ?? text.description,
      path,
      titleSuffix: settings.seo.titleSuffix,
      ogFile: true,
    });
  }
  const filters = parseCatalogFilters(await searchParams);
  const { listing } = await loadListing(category, filters);
  // A page past the last one is not a copy of page 1 (SEO-02).
  if (filters.page > listing.pageCount) notFound();
  const { canonical, index } = listingIndexing(path, filters);
  const counts = categoryCounts(category);
  const text = categoryMeta({
    name: c.name,
    productCount: counts.productCount,
    inStockCount: counts.inStockCount,
    page: filters.page,
    // Facts of the unfiltered category only: a filtered view is canonicalised away anyway.
    ...(filterDimensions(filters) === 0
      ? {
          minPricePara: listing.facets.price?.minPara ?? null,
          manufacturers: [...listing.facets.manufacturers]
            .sort((a, b) => b.count - a.count)
            .map((m) => m.name),
        }
      : {}),
  });
  // An owner-written SEO title is kept, but the page number always survives shortening.
  const page = pageSuffix(filters.page);
  const title = category.seoTitle
    ? { title: `${category.seoTitle}${page}`, ...(page ? { titleKeep: page } : {}) }
    : { title: text.title, ...(text.titleKeep ? { titleKeep: text.titleKeep } : {}) };
  return buildMetadata({
    ...title,
    description: category.seoDescription ?? text.description,
    path: (await landingCanonical(c.slug, filters)) ?? canonical,
    // Empty categories stay reachable but out of the index (no thin pages).
    noindex: !index || counts.productCount === 0,
    titleSuffix: settings.seo.titleSuffix,
    ogFile: true,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/delovi/[kategorija]">) {
  const { kategorija } = await params;
  const category = await getCategory(kategorija);
  if (!category) notFound();
  const crumbs = crumbsFor(category);
  if (category.category.kind === "system") {
    const tree = await getCategoryTree();
    const { topProducts, landings } = await loadSystemHub(category, tree);
    return (
      <SystemHub
        category={category}
        tree={tree}
        crumbs={crumbs}
        topProducts={topProducts}
        landings={landings}
      />
    );
  }
  const filters = parseCatalogFilters(await searchParams);
  const [data, landings] = await Promise.all([
    loadListing(category, filters),
    getCategoryLandings(category.category.slug),
  ]);
  if (filters.page > data.listing.pageCount) notFound();
  return (
    <CategoryListingView
      category={category}
      filters={filters}
      data={data}
      basePath={ROUTES.category(category.category.slug)}
      title={category.category.name}
      crumbs={crumbs}
      intro={category.intro}
    >
      <LandingLinks
        id="landings-title"
        title={`${category.category.name} po vozilu`}
        links={landings}
        show="vehicle"
      />
    </CategoryListingView>
  );
}

const HUB_TOP_PRODUCTS = 8;
const HUB_LANDINGS = 12;

/**
 * Content of a system hub (SEO-04): the most popular parts of each child category taken in
 * turn (so one big category does not fill the row) and the largest indexable landings.
 */
async function loadSystemHub(
  category: CategoryDetail,
  tree: CategoryTree,
): Promise<{ topProducts: ProductCardData[]; landings: LandingLinkData[] }> {
  const children = systemChildren(category, tree).filter((c) => c.count > 0);
  const [listings, landingLists] = await Promise.all([
    Promise.all(
      children.map((c) =>
        getCategoryListing({
          categorySlug: c.category.slug,
          availability: "all",
          sort: "popular",
          page: 1,
          pageSize: 4,
        }),
      ),
    ),
    Promise.all(children.map((c) => getCategoryLandings(c.category.slug))),
  ]);
  const topProducts: ProductCardData[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < 4 && topProducts.length < HUB_TOP_PRODUCTS; round += 1) {
    for (const l of listings) {
      const item = l?.items[round];
      if (!item || seen.has(item.slug) || topProducts.length >= HUB_TOP_PRODUCTS) continue;
      seen.add(item.slug);
      topProducts.push(item);
    }
  }
  const landings = landingLists
    .flat()
    .filter((l) => l.indexable)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, HUB_LANDINGS);
  return { topProducts, landings };
}

/** Product counts of a category, merging its subcategories (parents such as „Filteri“). */
function categoryCounts(category: NonNullable<Awaited<ReturnType<typeof getCategory>>>) {
  const own = category.category;
  if (own.productCount > 0 || category.children.length === 0) {
    return { productCount: own.productCount, inStockCount: own.inStockCount };
  }
  return {
    productCount: category.children.reduce((n, x) => n + x.productCount, 0),
    inStockCount: category.children.reduce((n, x) => n + x.inStockCount, 0),
  };
}

/**
 * A listing filtered only by make (or make + model) has an indexable landing twin: point the
 * canonical there instead of at the unfiltered category (ROUTES §B1).
 */
async function landingCanonical(
  categorySlug: string,
  filters: CatalogFilters,
): Promise<string | null> {
  const v = filters.vehicle;
  if (
    !v ||
    v.generation ||
    v.engine ||
    filterDimensions(filters) !== 1 ||
    filters.sort !== "popular"
  ) {
    return null;
  }
  const landing = await getLanding({
    categorySlug,
    brandSlug: v.brand,
    ...(v.model ? { modelSlug: v.model } : {}),
  });
  return landing?.indexable ? landingPath(categorySlug, v.brand, v.model) : null;
}
