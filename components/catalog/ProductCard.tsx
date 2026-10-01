import { CheckCircleIcon, QuestionIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { typographer } from "@/lib/format/nbsp";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import type { ProductCardData } from "@/lib/catalog/types";
import { RouteLink } from "@/components/ui/RouteLink";
import { AddToCartButton, type CartProduct } from "@/components/catalog/AddToCartButton";
import { ProductPrice } from "@/components/catalog/ProductPrice";
import { ProductStock } from "@/components/catalog/ProductStock";
import { ProductThumb } from "@/components/catalog/ProductThumb";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type CardFit = { kind: "fits" | "generation_only" | "universal"; vehicle: string } | null;

function FitLine({ fit }: { fit: CardFit }) {
  if (!fit) return null;
  if (fit.kind === "generation_only") {
    return (
      <span className="inline-flex items-start gap-1.5 type-caption text-warning">
        <QuestionIcon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        Odgovara za {fit.vehicle}&nbsp;— proverite motor
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5 type-caption text-success">
      <CheckCircleIcon size={14} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
      {fit.kind === "universal" ? "Univerzalni deo" : `Odgovara za ${fit.vehicle}`}
    </span>
  );
}

/** Only what the add-to-cart island needs, so the card data is not serialised twice (PERF-17). */
function cartProduct(card: ProductCardData): CartProduct {
  return {
    _id: card._id,
    slug: card.slug,
    sku: card.sku,
    name: card.name,
    manufacturerName: card.manufacturerName,
    systemSlug: card.systemSlug,
    categorySlug: card.categorySlug,
    retailPricePara: card.retailPricePara,
    stockState: card.stockState,
    stockQty: card.stockQty,
    allowBackorder: card.allowBackorder,
  };
}

/** Image candidates per layout (PERF-21): 104 px list thumbnail below 480 px (`sm`). */
const SIZES = {
  grid: "(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 100vw",
  responsive: "(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 104px",
  list: "104px",
} as const;

/**
 * Product card (§9.7). Grid: 4:3 render (the top row is kept free for the quality chip, so the
 * chip never sits on the render), maker, name (the whole card is one link via the name's
 * `::after`, focus ring around the card; up to 3 lines in the grid, never clamped in the list),
 * OEM (wraps, never truncated), fitment, stock, footer rule, price + action. List (phones,
 * search): 104 px thumbnail column and a full-width labelled button. The footer measures the
 * body column, not the card: below 17rem the price and a full-width button stack, so nothing
 * is clipped at 320 px (WCAG 1.4.10). Price and stock are live values over the cached HTML.
 */
export function ProductCard({
  card,
  variant = "grid",
  fit = null,
  preloadImage = false,
  headingLevel = "h3",
}: {
  card: ProductCardData;
  variant?: "grid" | "list" | "responsive";
  fit?: CardFit;
  preloadImage?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const href = ROUTES.product(card.slug);
  const layout =
    variant === "list"
      ? "grid-cols-[6.5rem_minmax(0,1fr)]"
      : variant === "responsive"
        ? "grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-1"
        : "grid-cols-1";
  const thumb =
    variant === "list"
      ? "h-full min-h-[6.5rem]"
      : variant === "responsive"
        ? "h-full min-h-[6.5rem] sm:aspect-[4/3] sm:h-auto sm:min-h-0"
        : "aspect-[4/3]";
  const chipVisible = variant === "grid" ? "flex" : variant === "responsive" ? "hidden sm:flex" : "hidden";
  // Reserve the chip row (top 10 px + 24 px chip + 2 px) above the render.
  const chipRow = variant === "grid" ? "pt-9" : variant === "responsive" ? "sm:pt-9" : "";
  const nameClamp = variant === "grid" ? "line-clamp-3" : variant === "responsive" ? "sm:line-clamp-3" : "";

  return (
    <article
      data-testid={TEST_IDS.productCard}
      data-product-slug={card.slug}
      className={cn(
        "group relative grid overflow-hidden rounded-sm border border-line-strong bg-surface-1 transition-control hover:border-ink-4 sm:border-line sm:hover:border-line-strong",
        "has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-focus",
        layout,
      )}
    >
      <div className="relative">
        <ProductThumb
          imageUrl={card.imageUrl}
          categorySlug={card.categorySlug}
          alt=""
          sizes={SIZES[variant]}
          preload={preloadImage}
          className={thumb}
          imageClassName={cn("hover-hover:group-hover:scale-[1.03]", chipRow)}
        />
        <span
          className={cn(
            "absolute top-2.5 left-2.5 h-6 items-center rounded-xs border border-line-strong bg-bg/80 px-2 type-caption-s text-ink-2",
            chipVisible,
          )}
        >
          {QUALITY_LABEL[card.quality]}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 p-3 sm:p-4">
        <p className="type-caption text-ink-3">
          {card.manufacturerName}
          <span className={variant === "grid" ? "hidden" : variant === "responsive" ? "sm:hidden" : ""}>
            {" · "}
            {QUALITY_LABEL[card.quality]}
          </span>
        </p>
        <Heading className="type-h4 text-ink-1">
          <RouteLink
            href={href}
            data-card-link=""
            className={cn(
              "outline-none after:absolute after:inset-0 after:content-[''] hover:underline hover:decoration-accent hover:underline-offset-4",
              nameClamp,
            )}
          >
            {typographer(card.name)}
          </RouteLink>
        </Heading>
        {card.oemPrimary ? (
          <p className="break-words type-caption text-ink-3">
            OEM <span className="type-code text-ink-2">{card.oemPrimary}</span>
          </p>
        ) : null}
        <FitLine fit={fit} />
        <ProductStock
          productId={card._id}
          stockState={card.stockState}
          stockQty={card.stockQty}
          leadTimeDays={card.leadTimeDays}
        />
        {/* The size container wraps only the footer: container-type implies layout containment,
            which would make it the containing block of the name link's card-wide `::after`. */}
        <div className="@container mt-auto">
          <div className="flex flex-col gap-3 border-t border-line pt-3 @min-[17rem]:flex-row @min-[17rem]:items-end @min-[17rem]:justify-between">
            <ProductPrice productId={card._id} retailPricePara={card.retailPricePara} />
            <div className="@min-[17rem]:w-auto @min-[17rem]:min-w-[7.5rem]">
              <AddToCartButton product={cartProduct(card)} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
