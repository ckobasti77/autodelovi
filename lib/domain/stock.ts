/**
 * Stock state derivation (docs/DATA-MODEL.md §C4 catalog invariants). Pure.
 *
 * qty 0 → `on_order` when the product can be ordered in (lead time or backorder), else
 * `out_of_stock`; qty ≤ threshold → `low_stock`; otherwise `in_stock`.
 */

export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "on_order";

export type StockInput = {
  stockQty: number;
  lowStockThreshold?: number;
  leadTimeDays?: number;
  allowBackorder: boolean;
};

export function deriveStockState(input: StockInput, defaultLowStock: number): StockState {
  const qty = Math.max(0, Math.floor(input.stockQty));
  if (qty === 0) {
    return input.allowBackorder || (input.leadTimeDays ?? 0) > 0 ? "on_order" : "out_of_stock";
  }
  const threshold = input.lowStockThreshold ?? defaultLowStock;
  return qty <= threshold ? "low_stock" : "in_stock";
}

/** Whether a quantity may be ordered: from stock, or as a backorder / lead-time item. */
export function canOrderQuantity(
  input: StockInput,
  quantity: number,
): {
  ok: boolean;
  backorder: boolean;
  available: number;
} {
  const available = Math.max(0, Math.floor(input.stockQty));
  if (quantity <= available) return { ok: true, backorder: false, available };
  const orderable = input.allowBackorder || (input.leadTimeDays ?? 0) > 0;
  return { ok: orderable, backorder: orderable, available };
}

/** States the storefront treats as purchasable right now. */
export function isAvailableNow(state: StockState): boolean {
  return state === "in_stock" || state === "low_stock";
}

/** Sort key: in stock first, then low stock, on order, out of stock. */
export const STOCK_STATE_RANK: Readonly<Record<StockState, number>> = {
  in_stock: 0,
  low_stock: 1,
  on_order: 2,
  out_of_stock: 3,
};
