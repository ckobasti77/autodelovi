/** Lookups in the cached vehicle tree for the `/vozila…` hubs (pure). */
import type { VehicleTree } from "@/lib/catalog/types";
import { ROUTES } from "@/constants/routes";

export type TreeBrand = VehicleTree[number];
export type TreeModel = TreeBrand["models"][number];
export type TreeGeneration = TreeModel["generations"][number];

export function findBrand(tree: VehicleTree, slug: string): TreeBrand | null {
  return tree.find((b) => b.brand.slug === slug) ?? null;
}

export function findModel(brand: TreeBrand, slug: string): TreeModel | null {
  return brand.models.find((m) => m.model.slug === slug) ?? null;
}

export function findGeneration(model: TreeModel, slug: string): TreeGeneration | null {
  return model.generations.find((g) => g.slug === slug) ?? null;
}

export function yearsLabel(g: { yearFrom: number; yearTo: number | null }): string {
  return `${g.yearFrom}–${g.yearTo ?? ""}`;
}

/** „VW Golf VII“ style short brand for sentences. */
export function shortBrand(brand: { slug: string; name: string }): string {
  return brand.slug === "volkswagen" ? "VW" : brand.name;
}

/**
 * Link to a model: its hub, or straight to the generation when the model has only one — the
 * hub URL of such a model is a 308 to that generation (SEO-04), and links should not hop.
 */
export function modelHref(
  brandSlug: string,
  model: { model: { slug: string }; generations: { slug: string }[] },
): string {
  const only = model.generations.length === 1 ? model.generations[0] : undefined;
  return only
    ? ROUTES.vehicleGeneration(brandSlug, model.model.slug, only.slug)
    : ROUTES.vehicleModel(brandSlug, model.model.slug);
}
