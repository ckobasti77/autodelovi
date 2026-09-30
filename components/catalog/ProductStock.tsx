"use client";

import { StockBadge } from "@/components/ui/StockBadge";
import { useLiveProduct } from "@/components/catalog/LiveOverlay";
import { leadTimeLabel, stockStatusOf, type StockState } from "@/lib/i18n/sr/catalog";

/** Stock line (§3.6, §9.9) with the live value swapped in when it arrives. */
export function ProductStock({
  productId,
  stockState,
  stockQty,
  leadTimeDays,
  variant = "inline",
  className,
}: {
  productId: string;
  stockState: StockState;
  stockQty: number;
  leadTimeDays: number | null;
  variant?: "inline" | "chip";
  className?: string;
}) {
  const live = useLiveProduct(productId);
  const state = live?.stockState ?? stockState;
  const qty = live?.stockQty ?? stockQty;
  return (
    <StockBadge
      status={stockStatusOf(state)}
      quantity={qty}
      leadTime={leadTimeLabel(leadTimeDays)}
      variant={variant}
      className={className}
    />
  );
}
