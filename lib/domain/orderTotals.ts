/**
 * Order totals (docs/DATA-MODEL.md §C6 totals invariants). Pure, integer para.
 *
 *   itemsPara = Σ lineTotalPara · discountPara = itemsRetailPara − itemsPara
 *   deliveryPara from the delivery method (free-over rule applied to itemsPara)
 *   totalPara = itemsPara + deliveryPara · vatPara = round(totalPara × vat / (10000 + vat))
 */

export type TotalsLine = { quantity: number; unitRetailPara: number; unitPricePara: number };

export type DeliveryPricing = { pricePara: number; freeOverPara?: number };

export type OrderTotals = {
  itemsRetailPara: number;
  discountPara: number;
  itemsPara: number;
  deliveryPara: number;
  totalPara: number;
  vatPara: number;
  currency: "RSD";
};

export function lineTotalPara(line: Pick<TotalsLine, "quantity" | "unitPricePara">): number {
  return line.quantity * line.unitPricePara;
}

export function deliveryPricePara(itemsPara: number, delivery: DeliveryPricing): number {
  if (delivery.freeOverPara !== undefined && itemsPara >= delivery.freeOverPara) return 0;
  return delivery.pricePara;
}

/** VAT contained in a gross amount (prices include PDV). */
export function vatIncludedPara(grossPara: number, vatRateBp: number): number {
  return Math.round((grossPara * vatRateBp) / (10_000 + vatRateBp));
}

export function computeOrderTotals(
  lines: readonly TotalsLine[],
  delivery: DeliveryPricing,
  vatRateBp: number,
): OrderTotals {
  let itemsRetailPara = 0;
  let itemsPara = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new RangeError(`quantity must be a positive integer, got ${line.quantity}`);
    }
    itemsRetailPara += line.quantity * line.unitRetailPara;
    itemsPara += lineTotalPara(line);
  }
  const deliveryPara = deliveryPricePara(itemsPara, delivery);
  const totalPara = itemsPara + deliveryPara;
  return {
    itemsRetailPara,
    discountPara: itemsRetailPara - itemsPara,
    itemsPara,
    deliveryPara,
    totalPara,
    vatPara: vatIncludedPara(totalPara, vatRateBp),
    currency: "RSD",
  };
}
