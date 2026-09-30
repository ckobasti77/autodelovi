import type { StockState } from "@/lib/i18n/sr/catalog";

/** Can a product go into the cart right now (in stock, or backorder allowed)? */
export function isOrderable(state: StockState, allowBackorder: boolean): boolean {
  return (
    state === "in_stock" ||
    state === "low_stock" ||
    ((state === "on_order" || state === "out_of_stock") && allowBackorder)
  );
}
