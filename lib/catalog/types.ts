/** Read-model types derived from the Convex API (one source of truth for shapes). */
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";

export type ProductCardData = NonNullable<
  FunctionReturnType<typeof api.catalog.products.listByCategory>
>["items"][number];

export type CategoryListing = NonNullable<
  FunctionReturnType<typeof api.catalog.products.listByCategory>
>;

export type ProductDetail = NonNullable<FunctionReturnType<typeof api.catalog.products.bySlug>>;

export type CategoryDetail = NonNullable<FunctionReturnType<typeof api.catalog.categories.bySlug>>;

export type CategorySummary = CategoryDetail["category"];

export type CategoryTree = FunctionReturnType<typeof api.catalog.categories.tree>;

export type VehicleTree = FunctionReturnType<typeof api.catalog.vehicles.tree>;

export type SearchResult = FunctionReturnType<typeof api.search.run>;

export type FitmentRow = ProductDetail["fitments"][number];

/** Category render used until real photos exist (`public/images/parts/<slug>.webp`). */
export function categoryImage(slug: string): string {
  return `/images/parts/${slug}.webp`;
}

/** Products of a category including its subcategories (parents like `filteri` hold none). */
export function categoryProductCount(tree: CategoryTree, category: CategorySummary): number {
  const children = tree.subcategories.filter((c) => c.parentId === category._id);
  return children.length ? children.reduce((n, c) => n + c.productCount, 0) : category.productCount;
}

/** Every product in the catalog (leaf categories and subcategories). */
export function catalogProductCount(tree: CategoryTree): { all: number; inStock: number } {
  const leaves = [...tree.categories, ...tree.subcategories];
  return {
    all: leaves.reduce((n, c) => n + c.productCount, 0),
    inStock: leaves.reduce((n, c) => n + c.inStockCount, 0),
  };
}
