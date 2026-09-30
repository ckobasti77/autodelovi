"use client";

import { Price, type PriceSize } from "@/components/ui/Price";
import { useLiveProduct } from "@/components/catalog/LiveOverlay";
import { TEST_IDS } from "@/constants/testIds";
import { PANEL_COPY } from "@/lib/i18n/sr/hero";

/**
 * Role-aware price (§3.7, §9.8): the SSR retail price, replaced live by „Vaša cena“ for
 * approved mechanics (computed in Convex, never in the cached HTML).
 */
export function ProductPrice({
  productId,
  retailPricePara,
  size = "m",
  align = "start",
  showDiscount = false,
  className,
}: {
  productId: string;
  retailPricePara: number | null;
  size?: PriceSize;
  align?: "start" | "end";
  showDiscount?: boolean;
  className?: string;
}) {
  const live = useLiveProduct(productId);
  const retail = live ? live.retailPricePara : retailPricePara;
  if (retail === null) {
    return (
      <span data-reveal="off" className="type-caption text-ink-3">
        {PANEL_COPY.signInForPrice}
      </span>
    );
  }
  const yours = live?.yourPricePara ?? null;
  if (yours !== null && yours < retail) {
    return (
      <div data-testid={TEST_IDS.productYourPrice} className={className}>
        <Price
          para={yours}
          retailPara={retail}
          variant="mechanic"
          size={size}
          align={align}
          discount={showDiscount ? 1 - yours / retail : undefined}
        />
      </div>
    );
  }
  return <Price para={retail} size={size} align={align} className={className} />;
}
