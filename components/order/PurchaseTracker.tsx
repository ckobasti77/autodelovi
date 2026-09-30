"use client";

import { useEffect } from "react";

import { analyticsItem, track } from "@/lib/analytics/track";

/**
 * `purchase` once per order (SEO-ADS §J7): sessionStorage guard `sk_tracked_<order>` so a
 * reload of the thank-you page never counts twice; event id = order number (CAPI dedup).
 */
export function PurchaseTracker({
  orderNumber,
  valuePara,
  shippingPara,
  taxPara,
  items,
}: {
  orderNumber: string;
  valuePara: number;
  shippingPara: number;
  taxPara: number;
  items: { sku: string; name: string; manufacturerName: string; unitPricePara: number; quantity: number }[];
}) {
  useEffect(() => {
    const key = `sk_tracked_${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Without storage the event may repeat on reload; acceptable.
    }
    track(
      {
        name: "purchase",
        orderNumber,
        valuePara,
        shippingPara,
        taxPara,
        items: items.map((i) =>
          analyticsItem({
            sku: i.sku,
            name: i.name,
            manufacturerName: i.manufacturerName,
            systemSlug: "",
            pricePara: i.unitPricePara,
            quantity: i.quantity,
          }),
        ),
      },
      { eventId: orderNumber },
    );
    // Once per order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);
  return null;
}
