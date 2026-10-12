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
    leadTimeDays: card.leadTimeDays,
  };
}

/** Image candidates per layout (PERF-21): an 88 px list thumbnail below 480 px (`sm`). */
const SIZES = {
  grid: "(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 100vw",
  responsive:
    "(min-width: 1920px) 360px, (min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 88px",
  list: "88px",
} as const;

/**
 * Product card (§9.7, UI-BOOST §7.2). Three rows of one grid: picture, facts, footer.
 *
 * Grid (from 480 px): the 4:3 render fills its frame (a category render is a square with air
 * around the part, so it takes the whole height and the quality chip sits on its empty
 * corner), maker, name (the whole card is one link via the name's `::after`,
 * focus ring around the card; two lines are reserved so the rows of a grid line up, a third is
 * allowed), OEM (wraps, never truncated), fitment, stock, then the footer rule with the price
 * and the action. The facts row takes the slack, so footers line up along a row of cards.
 *
 * List (phones, search): an 88 px thumbnail beside the facts and the footer across the whole
 * card — price left, labelled 44 px button right — so a card is about 190 px tall instead of
 * 250. The footer measures itself: below 15rem the price and a full-width button stack, so
 * nothing is clipped in a narrow grid column or at 320 px (WCAG 1.4.10). Price and stock are
 * live values over the cached HTML.
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
      ? "grid-cols-[5.5rem_minmax(0,1fr)]"
      : variant === "responsive"
        ? "grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-1 sm:grid-rows-[auto_1fr_auto]"
        : "grid-cols-1 grid-rows-[auto_1fr_auto]";
  // List: an inset 88 px tile (6 px, concentric with the card). Grid: full-bleed 4:3.
  const LIST_FRAME = "mt-3 ml-3 self-start";
  const LIST_THUMB = "size-22 rounded-sm";
  const frame =
    variant === "list"
      ? LIST_FRAME
      : variant === "responsive"
        ? `${LIST_FRAME} sm:m-0 sm:self-auto`
        : "";
  const thumb =
    variant === "list"
      ? LIST_THUMB
      : variant === "responsive"
        ? `${LIST_THUMB} sm:aspect-[4/3] sm:size-auto sm:rounded-none`
        : "aspect-[4/3]";
  const chipVisible =
    variant === "grid" ? "flex" : variant === "responsive" ? "hidden sm:flex" : "hidden";
  // Fine pointers: the picture steps 4 % closer inside its mask (grid layouts only).
  const renderScale =
    variant === "list"
      ? ""
      : variant === "responsive"
        ? "hover-hover:sm:group-hover:scale-[1.04]"
        : "hover-hover:group-hover:scale-[1.04]";
  const nameClamp =
    variant === "grid" ? "line-clamp-3" : variant === "responsive" ? "sm:line-clamp-3" : "";
  const bodyPad =
    variant === "list" ? "p-3" : variant === "responsive" ? "p-3 sm:p-4 sm:pb-3" : "p-4 pb-3";
  const footerPad =
    variant === "list"
      ? "col-span-2 px-3 pb-3"
      : variant === "responsive"
        ? "col-span-2 px-3 pb-3 sm:col-span-1 sm:px-4 sm:pb-4"
        : "px-4 pb-4";

  return (
    <article
      data-testid={TEST_IDS.productCard}
      data-product-slug={card.slug}
      className={cn(
        // Panel + hover step (surface, edge, 1 px lift); the firmer edge on phones is for glare.
        "group relative grid overflow-hidden panel card-interactive max-sm:border-line-strong",
        "has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-focus",
        layout,
      )}
    >
      <div className={cn("relative", frame)}>
        <ProductThumb
          imageUrl={card.imageUrl}
          categorySlug={card.categorySlug}
          alt=""
          sizes={SIZES[variant]}
          preload={preloadImage}
          className={thumb}
          bleed
          imageClassName={renderScale}
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
      <div className={cn("flex min-w-0 flex-col gap-1.5", bodyPad)}>
        <p className="type-caption text-ink-3">
          {card.manufacturerName}
          <span
            className={variant === "grid" ? "hidden" : variant === "responsive" ? "sm:hidden" : ""}
          >
            {" · "}
            {QUALITY_LABEL[card.quality]}
          </span>
        </p>
        <Heading className="min-h-[2lh] type-h4 text-ink-1">
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
      </div>
      {/* The footer is a row of the card, not of the facts column: on phones it runs under the
          thumbnail too. It is its own size container (container-type implies layout containment,
          which would make an ancestor of the name link the containing block of its card-wide
          `::after` — a sibling is safe). */}
      <div className={cn("@container", footerPad)}>
        <div className="flex flex-col gap-3 border-t border-line pt-3 @min-[15rem]:flex-row @min-[15rem]:items-end @min-[15rem]:justify-between">
          <ProductPrice productId={card._id} retailPricePara={card.retailPricePara} />
          <div className="@min-[15rem]:w-auto @min-[15rem]:min-w-[7.5rem]">
            <AddToCartButton product={cartProduct(card)} />
          </div>
        </div>
      </div>
    </article>
  );
}
