"use client";

import { useEffect } from "react";

import { analyticsItem, track } from "@/lib/analytics/track";

/** `view_item` once per product page view. */
export function ProductViewTracker(props: {
  sku: string;
  name: string;
  manufacturerName: string;
  systemSlug: string;
  categorySlug: string;
  pricePara: number | null;
}) {
  useEffect(() => {
    track({ name: "view_item", item: analyticsItem(props) });
    // Once per product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sku]);
  return null;
}
