import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { filterDimensions, parseCatalogFilters, type SearchParamsInput } from "@/lib/catalog/filters";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCategory, getSettingsPublic, resolveVehicle } from "@/lib/server/catalog-cache";
import type { Crumb } from "@/components/ui/Breadcrumbs";
import { CategoryListingView, loadListing } from "@/components/catalog/CategoryListingView";
import { ROUTES } from "@/constants/routes";

/**
 * Programmatic landings `/delovi/[kategorija]/[marka](/[model])` (ROUTES §B1, SEO-ADS §J4):
 * the category listing locked to a make or model. Until step 19 computes `landingStats`
 * (thin-content guard) every landing is `noindex, follow`; zero products → 404.
 */
async function load(kategorija: string, marka: string, model: string | undefined) {
  const category = await getCategory(kategorija);
  if (!category || category.category.kind === "system") return null;
  const vehicle = await resolveVehicle({ brandSlug: marka, ...(model ? { modelSlug: model } : {}) });
  if (!vehicle || (model && !vehicle.model)) return null;
  return { category, vehicle };
}

function landingTitle(categoryName: string, vehicle: NonNullable<Awaited<ReturnType<typeof resolveVehicle>>>) {
  const brand = vehicle.brand.slug === "volkswagen" ? "VW" : vehicle.brand.name;
  return vehicle.model ? `${categoryName} za ${brand} ${vehicle.model.name}` : `${categoryName} za ${vehicle.brand.name}`;
}

export async function landingMetadata(
  kategorija: string,
  marka: string,
  model: string | undefined,
): Promise<Metadata> {
  const [data, settings] = await Promise.all([load(kategorija, marka, model), getSettingsPublic()]);
  if (!data) return {};
  const path = model
    ? `${ROUTES.category(kategorija)}/${marka}/${model}`
    : `${ROUTES.category(kategorija)}/${marka}`;
  const title = landingTitle(data.category.category.name, data.vehicle);
  return buildMetadata({
    title: model ? title : `${title} — cene i stanje`,
    description: `${title}: delovi po OEM broju, kompatibilnost po generaciji i motoru, cene sa PDV-om i stanje. Pouzeće ili preuzimanje u radnji.`,
    path,
    noindex: true,
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
  const { category, vehicle } = data;
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
  const basePath = model
    ? `${ROUTES.category(kategorija)}/${marka}/${model}`
    : `${ROUTES.category(kategorija)}/${marka}`;
  const crumbs: Crumb[] = [
    { label: "Početna", href: ROUTES.home },
    { label: "Delovi", href: ROUTES.parts },
    { label: category.category.name, href: ROUTES.category(kategorija) },
  ];
  if (model) crumbs.push({ label: vehicle.brand.name, href: `${ROUTES.category(kategorija)}/${marka}` });
  crumbs.push({ label: model && vehicle.model ? vehicle.model.name : vehicle.brand.name });
  return (
    <CategoryListingView
      category={category}
      filters={filters}
      data={listing}
      basePath={basePath}
      title={landingTitle(category.category.name, vehicle)}
      crumbs={crumbs}
      intro={category.intro}
    />
  );
}
