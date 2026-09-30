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
import { categoryMeta, systemMeta } from "@/lib/seo/templates";
import {
  getCategory,
  getCategoryLandings,
  getCategoryTree,
  getLanding,
  getSettingsPublic,
} from "@/lib/server/catalog-cache";
import { LandingLinks } from "@/components/seo/LandingLinks";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { CategoryListingView, loadListing } from "@/components/catalog/CategoryListingView";
import { SystemHub } from "@/components/catalog/SystemHub";
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
  if (!category) return {};
  const path = ROUTES.category(category.category.slug);
  const c = category.category;
  if (c.kind === "system") {
    const tree = await getCategoryTree();
    const text = systemMeta({
      name: c.name,
      categories: tree.categories.filter((x) => x.systemSlug === c.slug).map((x) => x.name),
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
  const { canonical, index } = listingIndexing(path, filters);
  const counts = categoryCounts(category);
  const text = categoryMeta({
    name: c.name,
    productCount: counts.productCount,
    inStockCount: counts.inStockCount,
    page: filters.page,
  });
  return buildMetadata({
    title: category.seoTitle
      ? `${category.seoTitle}${filters.page > 1 ? ` — strana ${filters.page}` : ""}`
      : text.title,
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
    return <SystemHub category={category} tree={await getCategoryTree()} crumbs={crumbs} />;
  }
  const filters = parseCatalogFilters(await searchParams);
  const [data, landings] = await Promise.all([
    loadListing(category, filters),
    getCategoryLandings(category.category.slug),
  ]);
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
