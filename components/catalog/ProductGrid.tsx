import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { ProductCardData } from "@/lib/catalog/types";
import { LiveOverlayProvider } from "@/components/catalog/LiveOverlay";
import { ProductCard, type CardFit } from "@/components/catalog/ProductCard";

/**
 * Card grid (§10.2): list cards on phones, 2 columns ≥ 480. Without the rail: 3 ≥ 1024,
 * 4 ≥ 1280, 5 ≥ 1920. Beside the 280 px filter rail the column count follows the space left
 * (`auto-fill`, 15rem minimum), so cards never shrink below 240 px on wide screens (VIS-05,
 * D260). One live subscription for the whole grid.
 */
export function ProductGrid({
  items,
  fitFor,
  withRail = false,
  preloadFirst = false,
  headingLevel = "h3",
  className,
  after,
}: {
  items: ProductCardData[];
  fitFor?: (card: ProductCardData) => CardFit;
  withRail?: boolean;
  /**
   * Preloads the first two card images. Below 480 px they are 104 px list thumbnails, and the
   * `sizes` of the responsive card says so, so phones preload the small candidate (PERF-03/21).
   */
  preloadFirst?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
  after?: ReactNode;
}) {
  return (
    <LiveOverlayProvider productIds={items.map((i) => i._id)}>
      <ul
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-(--gutter)",
          withRail
            ? "lg:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]"
            : "lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5",
          className,
        )}
      >
        {items.map((card, i) => (
          <li key={card._id} className="flex">
            <div className="flex w-full [&>article]:w-full">
              <ProductCard
                card={card}
                variant="responsive"
                fit={fitFor ? fitFor(card) : null}
                preloadImage={preloadFirst && i < 2}
                headingLevel={headingLevel}
              />
            </div>
          </li>
        ))}
      </ul>
      {after}
    </LiveOverlayProvider>
  );
}
