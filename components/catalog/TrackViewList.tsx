"use client";

import { useEffect } from "react";

import { analyticsItem, track } from "@/lib/analytics/track";
import type { ProductCardData } from "@/lib/catalog/types";

/** `view_item_list` once per rendered list (no-op sink until step 19). */
export function TrackViewList({
  listId,
  listName,
  items,
}: {
  listId: string;
  listName: string;
  items: Pick<
    ProductCardData,
    "sku" | "name" | "manufacturerName" | "systemSlug" | "categorySlug" | "retailPricePara"
  >[];
}) {
  const key = `${listId}:${items.map((i) => i.sku).join(",")}`;
  useEffect(() => {
    if (items.length === 0) return;
    track({
      name: "view_item_list",
      listId,
      listName,
      items: items.map((i) =>
        analyticsItem({
          sku: i.sku,
          name: i.name,
          manufacturerName: i.manufacturerName,
          systemSlug: i.systemSlug,
          categorySlug: i.categorySlug,
          pricePara: i.retailPricePara,
        }),
      ),
    });
    // Track once per distinct list content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
