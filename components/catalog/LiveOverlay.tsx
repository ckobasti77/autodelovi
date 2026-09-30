"use client";

/**
 * Live overlay (ARCHITECTURE §G2): one `catalog.products.liveState` subscription for every
 * product on the page. Server HTML (cached, anonymous) renders first; after idle time the
 * overlay swaps in live stock and — for approved mechanics — „Vaša cena“.
 */
import { useConvexAuth, useQuery } from "convex/react";
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
  // Signed-in viewers (mechanics above all) get their own prices at once; anonymous visitors
  // wait for the first interaction so the subscription stays out of the load window.
  const { isAuthenticated } = useConvexAuth();
  const live = enabled || isAuthenticated;
  useEffect(() => {
    // Keep the subscription out of the load window (TBT): the cached SSR stock is at most a few
    // minutes old, so the live values arrive on the first interaction or after a quiet moment.
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    let timer = 0;
    const start = () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, start);
      setEnabled(true);
    };
    for (const e of events) window.addEventListener(e, start, { once: true, passive: true });
    timer = window.setTimeout(start, 6000);
    return () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, start);
    };
  }, []);
  const ids = useMemo(() => [...new Set(productIds)].slice(0, MAX_IDS), [productIds]);
  const rows = useQuery(
    api.catalog.products.liveState,
    live && ids.length > 0 ? { productIds: ids as Id<"products">[] } : "skip",
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
