/**
 * Shared catalog wording (DESIGN-SYSTEM §3.6, §9.6): product quality and stock labels in one
 * place for the part panel, cards and later the catalog pages.
 */
import { countSr } from "@/lib/format/plural";
import type { StockStatus } from "@/components/ui/StockBadge";

export type Quality = "original" | "oem" | "aftermarket";
export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "on_order";

export const QUALITY_LABEL: Readonly<Record<Quality, string>> = {
  original: "Original VAG",
  oem: "OEM kvalitet",
  aftermarket: "Aftermarket",
};

const STOCK_STATUS: Readonly<Record<StockState, StockStatus>> = {
  in_stock: "in_stock",
  low_stock: "low",
  on_order: "on_order",
  out_of_stock: "out",
};

export function stockStatusOf(state: StockState): StockStatus {
  return STOCK_STATUS[state];
}

/** „3 dana“ lead time for „Po porudžbini“. */
export function leadTimeLabel(days: number | null): string | undefined {
  return days && days > 0 ? countSr(days, ["dan", "dana", "dana"]) : undefined;
}

export const ARTICLE_FORMS = ["artikal", "artikla", "artikala"] as const;
