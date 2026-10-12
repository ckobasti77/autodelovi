"use client";

import { MagnifyingGlassIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { useRef } from "react";

import { useCart } from "@/lib/cart/guestCart";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { formatRSD } from "@/lib/format/money";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { MEDIA } from "@/constants/motion";
import { CART_EMPTY_ATTR } from "@/lib/cart/lineFocus";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { CartLines, CartSummary, type DeliveryInfo } from "@/components/cart/CartView";
import { Reveal } from "@/components/reveal/Reveal";
import { ROUTES } from "@/constants/routes";

function CheckoutButton() {
  return (
    <Button asChild variant="primary" size="lg" fullWidth>
      <Link href={ROUTES.checkout} variant="unstyled" data-testid="cart-checkout">
        Nastavi na porudžbinu
      </Link>
    </Button>
  );
}

/**
 * Phones and tablets (VIS-23): subtotal and „Nastavi na porudžbinu“ stay on screen while the
 * lines scroll, and the bar comes to rest under the summary card. It is the only checkout
 * button below lg, so the page never shows two.
 */
function MobileCheckoutBar({ itemsPara }: { itemsPara: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useBottomInset(ref);
  return (
    <div
      ref={ref}
      data-reveal="off"
      className="sticky bottom-0 z-sticky -mx-page -mt-4 flex items-center gap-4 border-t border-line-strong bg-bg-raised/95 px-page pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-header before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:from-bg before:to-transparent"
    >
      <p className="flex shrink-0 flex-col">
        <span className="type-caption text-ink-3">Međuzbir</span>
        <span className="type-numeral-m tabular-nums text-ink-1">{formatRSD(itemsPara)}</span>
      </p>
      <div className="min-w-0 flex-1">
        <CheckoutButton />
      </div>
    </div>
  );
}

export function CartPageView({ delivery }: { delivery: DeliveryInfo }) {
  const cart = useCart();
  const isDesktop = useMediaQuery(MEDIA.desktop);
  if (cart === undefined) {
    return (
      // The cart's own geometry: lines in one panel (thumbnail, three bars, stepper, total),
      // the summary panel beside it from lg.
      <SkeletonRegion
        label="Učitava se korpa"
        className="grid gap-6 lg:grid-cols-12 lg:gap-x-(--gutter)"
      >
        <div className="panel px-4 sm:px-5 lg:col-span-8">
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-line py-4 last:border-b-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center"
            >
              <Skeleton className="size-16 sm:size-20" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="col-start-2 flex items-center justify-between gap-5 sm:col-start-3">
                <Skeleton className="h-11 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 panel p-5 lg:col-span-4 lg:self-start">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="hidden h-13 w-full lg:block" />
          <Skeleton className="h-3 w-full" />
        </div>
      </SkeletonRegion>
    );
  }
  if (cart === null || cart.lines.length === 0) {
    return (
      // Removing the last line moves focus to this heading (A11Y-09, lib/cart/lineFocus).
      <div {...{ [CART_EMPTY_ATTR]: "" }}>
        <EmptyState
          align="start"
          className="pt-2"
          icon={<ShoppingCartSimpleIcon size={44} />}
          as="h2"
          title="Korpa je prazna"
          action={
            <Button asChild variant="primary" icon={<MagnifyingGlassIcon size={20} />}>
              <Link href={ROUTES.search} variant="unstyled">
                Pretražite po broju dela
              </Link>
            </Button>
          }
        >
          Dodajte delove iz kataloga ili pretražite po OEM broju.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-12 lg:gap-x-(--gutter)">
      {/* One panel holds every line; the summary floats one level above it. Both arrive with
          the cart (it loads after the page), from a visible frame. */}
      <Reveal eager className="panel px-4 sm:px-5 lg:col-span-8 lg:self-start">
        <CartLines cart={cart} />
      </Reveal>
      <aside aria-label="Ukupno" className="lg:col-span-4">
        <Reveal
          eager
          index={1}
          className="flex flex-col gap-5 panel-raised p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"
        >
          <CartSummary cart={cart} delivery={delivery} subtotalFromLg />
          {isDesktop ? <CheckoutButton /> : null}
          <p className="type-caption font-normal text-ink-3">
            Bez plaćanja karticom na sajtu. Plaćate pouzećem, pri preuzimanju ili virmanom.
          </p>
          <Link href={ROUTES.parts} variant="standalone" className="type-body-s">
            Nastavi kupovinu
          </Link>
        </Reveal>
      </aside>
      {isDesktop ? null : <MobileCheckoutBar itemsPara={cart.itemsPara} />}
    </div>
  );
}
