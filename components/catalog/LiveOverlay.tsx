"use client";

/**
 * Live overlay (ARCHITECTURE §G2): one `catalog.products.liveState` subscription for every
 * product on the page. Server HTML (cached, anonymous) renders first; after idle time the
 * overlay swaps in live stock and — for approved mechanics — „Vaša cena“.
 */
import { useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type LiveRow = {
  active: boolean;
  stockState: "in_stock" | "low_stock" | "out_of_stock" | "on_order";
  stockQty: number;
  retailPricePara: number | null;
  yourPricePara: number | null;
};

const LiveContext = createContext<ReadonlyMap<string, LiveRow> | null>(null);
const MAX_IDS = 60;

export function LiveOverlayProvider({
  productIds,
  children,
}: {
  productIds: string[];
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    // Keep the subscription out of the hydration window (TBT); stock is fresh enough in SSR.
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => setEnabled(true));
    return () => cancel(handle as number);
  }, []);
  const ids = useMemo(() => [...new Set(productIds)].slice(0, MAX_IDS), [productIds]);
  const rows = useQuery(
    api.catalog.products.liveState,
    enabled && ids.length > 0 ? { productIds: ids as Id<"products">[] } : "skip",
  );
  const map = useMemo(() => {
    const m = new Map<string, LiveRow>();
    for (const row of rows ?? []) m.set(row.productId, row);
    return m;
  }, [rows]);
  return <LiveContext.Provider value={map}>{children}</LiveContext.Provider>;
}

/** Live row for a product (null before the subscription answers or outside a provider). */
export function useLiveProduct(productId: string): LiveRow | null {
  return useContext(LiveContext)?.get(productId) ?? null;
}
