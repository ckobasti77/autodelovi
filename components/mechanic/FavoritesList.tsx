"use client";

/**
 * `/majstor/omiljeno` (and reusable elsewhere): parts the mechanic orders often, list rows
 * with the viewer's own price, stock, a quantity stepper and „U korpu“ (§9.8 list variant).
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { CheckIcon, ShoppingCartSimpleIcon, StarIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAddToCart } from "@/lib/cart/guestCart";
import { openCartDrawer } from "@/lib/cart/drawer";
import { canOrderQuantity } from "@/lib/domain/stock";
import { leadTimeLabel, stockStatusOf } from "@/lib/i18n/sr/catalog";
import { QUALITY_LABEL } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { Price } from "@/components/ui/Price";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StockBadge } from "@/components/ui/StockBadge";
import { toast } from "@/components/ui/Toast";
import { ProductThumb } from "@/components/catalog/ProductThumb";
import { ROUTES } from "@/constants/routes";

type Favorite = FunctionReturnType<typeof api.account.favorites>[number];

function Row({ fav }: { fav: Favorite }) {
  const add = useAddToCart("catalog");
  const toggle = useMutation(api.account.toggleFavorite);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const card = fav.card;
  const check = canOrderQuantity(
    { stockQty: card.stockQty, allowBackorder: card.allowBackorder, ...(card.leadTimeDays !== null ? { leadTimeDays: card.leadTimeDays } : {}) },
    qty,
  );
  const max = card.allowBackorder || (card.leadTimeDays ?? 0) > 0 ? 999 : Math.max(1, card.stockQty);
  const retail = card.retailPricePara ?? fav.unitPricePara;

  const onAdd = async () => {
    setState("busy");
    try {
      await add(card._id, qty);
      setState("done");
      toast.success(`${card.name} je u korpi.`, { action: { label: "Pogledaj korpu", onClick: openCartDrawer } });
      window.setTimeout(() => setState("idle"), 1600);
    } catch (error) {
      setState("idle");
      toast.error(convexErrorMessage(error, "Artikal nije dodat."));
    }
  };

  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
      <ProductThumb
        imageUrl={card.imageUrl}
        categorySlug={card.categorySlug}
        alt=""
        sizes="104px"
        className="aspect-square w-full rounded-xs"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <RouteLink
          href={ROUTES.product(card.slug)}
          className="type-body font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-accent"
        >
          {card.name}
        </RouteLink>
        <span className="flex flex-wrap gap-x-3 gap-y-1 type-caption text-ink-3">
          <span>{card.manufacturerName}</span>
          <span>{QUALITY_LABEL[card.quality]}</span>
          {card.oemPrimary ? <span className="type-code-s">OEM {card.oemPrimary}</span> : null}
        </span>
        {fav.listed ? (
          <StockBadge status={stockStatusOf(card.stockState)} quantity={card.stockQty} leadTime={leadTimeLabel(card.leadTimeDays)} />
        ) : (
          <span className="type-caption text-ink-3">Artikal više nije u ponudi.</span>
        )}
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
        <Price
          para={fav.unitPricePara}
          {...(fav.unitPricePara < retail ? { retailPara: retail, variant: "mechanic" as const } : {})}
          size="s"
          align="end"
          vatNote={false}
          className="max-sm:order-2 max-sm:w-full max-sm:items-start max-sm:text-left"
        />
        <div className="flex items-center gap-2 max-sm:order-1">
          {fav.listed ? (
            <>
              <QuantityStepper size="sm" value={qty} max={max} onChange={setQty} label={`Količina: ${card.name}`} />
              <Button
                size="sm"
                icon={state === "done" ? <CheckIcon size={16} /> : <ShoppingCartSimpleIcon size={16} />}
                loading={state === "busy"}
                disabled={!check.ok}
                onClick={() => void onAdd()}
              >
                {state === "done" ? "Dodato" : "U korpu"}
              </Button>
            </>
          ) : null}
          <IconButton
            label={`Ukloni iz omiljenog: ${card.name}`}
            icon={<XIcon size={18} />}
            variant="ghost"
            onClick={() =>
              toggle({ productId: card._id as Id<"products"> }).catch((e) =>
                toast.error(convexErrorMessage(e, "Izmena nije sačuvana.")),
              )
            }
          />
        </div>
      </div>
    </li>
  );
}

export function FavoritesList() {
  const favorites = useQuery(api.account.favorites, {});
  if (favorites === undefined) {
    return (
      <SkeletonRegion>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </SkeletonRegion>
    );
  }
  if (favorites.length === 0) {
    return (
      <EmptyState
        icon={<StarIcon size={40} />}
        action={
          <Button asChild variant="secondary">
            <Link href={ROUTES.parts} variant="unstyled">
              Pretražite delove
            </Link>
          </Button>
        }
      >
        Ovde čuvate delove koje često poručujete. Na strani artikla izaberite „Sačuvaj u omiljeno“.
      </EmptyState>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line" data-reveal="off">
      {favorites.map((fav) => (
        <Row key={fav.productId} fav={fav} />
      ))}
    </ul>
  );
}
