"use client";

import { useEffect } from "react";

import { googleUserData, type RawUserData } from "@/lib/analytics/hash";
import { analyticsItem, track } from "@/lib/analytics/track";

/**
 * `purchase` once per order (SEO-ADS §J7): sessionStorage guard `sk_tracked_<order>` so a
 * reload of the thank-you page never counts twice; event id = order number (CAPI dedup).
 * Enhanced Conversions data is hashed here and reaches Google only with ads consent.
 */
export function PurchaseTracker({
  orderNumber,
  valuePara,
  shippingPara,
  taxPara,
  items,
  userData,
}: {
  orderNumber: string;
  valuePara: number;
  shippingPara: number;
  taxPara: number;
  items: {
    sku: string;
    name: string;
    manufacturerName: string;
    unitPricePara: number;
    quantity: number;
  }[];
  userData?: RawUserData;
}) {
  useEffect(() => {
    const key = `sk_tracked_${orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Without storage the event may repeat on reload; acceptable.
    }
    let cancelled = false;
    void (async () => {
      const hashed = userData ? await googleUserData(userData).catch(() => null) : null;
      if (cancelled) return;
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
          ...(hashed ? { userData: hashed } : {}),
        },
        { eventId: orderNumber },
      );
    })();
    return () => {
      cancelled = true;
    };
    // Once per order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);
  return null;
}
