"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";

export type CategoryCount = { productCount: number; inStockCount: number };

/**
 * Product counts per category slug from the public category tree (one subscription). A parent
 * with subcategories (Filteri) counts its children — its own products live there.
 */
export function useCategoryCounts(enabled = true): Map<string, CategoryCount> | undefined {
  const tree = useQuery(api.catalog.categories.tree, enabled ? {} : "skip");
  return useMemo(() => {
    if (!tree) return undefined;
    const map = new Map<string, CategoryCount>();
    const byId = new Map<string, string>();
    for (const c of tree.categories) {
      map.set(c.slug, { productCount: c.productCount, inStockCount: c.inStockCount });
      byId.set(c._id, c.slug);
    }
    const childTotals = new Map<string, CategoryCount>();
    for (const s of tree.subcategories) {
      map.set(s.slug, { productCount: s.productCount, inStockCount: s.inStockCount });
      const parent = s.parentId ? byId.get(s.parentId) : undefined;
      if (!parent) continue;
      const sum = childTotals.get(parent) ?? { productCount: 0, inStockCount: 0 };
      sum.productCount += s.productCount;
      sum.inStockCount += s.inStockCount;
      childTotals.set(parent, sum);
    }
    for (const [slug, sum] of childTotals) {
      const own = map.get(slug) ?? { productCount: 0, inStockCount: 0 };
      map.set(slug, {
        productCount: own.productCount + sum.productCount,
        inStockCount: own.inStockCount + sum.inStockCount,
      });
    }
    return map;
  }, [tree]);
}
