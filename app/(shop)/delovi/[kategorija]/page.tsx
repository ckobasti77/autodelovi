import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listingIndexing, parseCatalogFilters } from "@/lib/catalog/filters";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  getCategory,
  getCategoryTree,
  getSettingsPublic,
} from "@/lib/server/catalog-cache";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { CategoryListingView, loadListing } from "@/components/catalog/CategoryListingView";
import { SystemHub } from "@/components/catalog/SystemHub";
import { ROUTES } from "@/constants/routes";

function crumbsFor(category: NonNullable<Awaited<ReturnType<typeof getCategory>>>): Crumb[] {
  const items: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
  ];
  if (category.system) items.push({ label: category.system.name, href: ROUTES.category(category.system.slug) });
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
    return buildMetadata({
      title: `${c.name} — delovi za VAG vozila`,
      description:
        category.seoDescription ??
        `${c.name}: delovi za Volkswagen, Audi, Škoda, SEAT i Cupra po kategorijama, sa cenama sa PDV-om i stanjem.`,
      path,
      titleSuffix: settings.seo.titleSuffix,
    });
  }
  const filters = parseCatalogFilters(await searchParams);
  const { canonical, index } = listingIndexing(path, filters);
  return buildMetadata({
    title: `${category.seoTitle ?? `${c.name} za VW, Audi, Škoda, SEAT`}${filters.page > 1 ? ` — strana ${filters.page}` : ""}`,
    description:
      category.seoDescription ??
      `${c.name} za VAG vozila: ${c.productCount} artikala, ${c.inStockCount} na stanju. Cene sa PDV-om, pouzeće i preuzimanje u radnji.`,
    path: canonical,
    noindex: !index,
    titleSuffix: settings.seo.titleSuffix,
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
  const data = await loadListing(category, filters);
  return (
    <CategoryListingView
      category={category}
      filters={filters}
      data={data}
      basePath={ROUTES.category(category.category.slug)}
      title={category.category.name}
      crumbs={crumbs}
      intro={category.intro}
    />
  );
}
