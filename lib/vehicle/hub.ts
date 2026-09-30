/** Lookups in the cached vehicle tree for the `/vozila…` hubs (pure). */
import type { VehicleTree } from "@/lib/catalog/types";

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
