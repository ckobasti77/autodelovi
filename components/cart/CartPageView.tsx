"use client";

import { MagnifyingGlassIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { useRef } from "react";

import { useCart } from "@/lib/cart/guestCart";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { formatRSD } from "@/lib/format/money";
import { useMediaQuery } from "@/components/ui/motion";
import { MEDIA } from "@/constants/motion";
import { CART_EMPTY_ATTR } from "@/lib/cart/lineFocus";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { CartLines, CartSummary, type DeliveryInfo } from "@/components/cart/CartView";
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
      <SkeletonRegion label="Učitava se korpa" className="grid gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-56 lg:col-span-4" />
      </SkeletonRegion>
    );
  }
  if (cart === null || cart.lines.length === 0) {
    return (
      // Removing the last line moves focus to this heading (A11Y-09, lib/cart/lineFocus).
      <div {...{ [CART_EMPTY_ATTR]: "" }}>
        <EmptyState
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
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <div className="lg:col-span-8">
        <CartLines cart={cart} />
      </div>
      <aside aria-label="Ukupno" className="lg:col-span-4">
        <div className="flex flex-col gap-5 rounded-sm border border-line bg-surface-1 p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <CartSummary cart={cart} delivery={delivery} />
          {isDesktop ? <CheckoutButton /> : null}
          <p className="type-caption font-normal text-ink-3">
            Bez plaćanja karticom na sajtu. Plaćate pouzećem, pri preuzimanju ili virmanom.
          </p>
          <Link href={ROUTES.parts} variant="standalone" className="type-body-s">
            Nastavi kupovinu
          </Link>
        </div>
      </aside>
      {isDesktop ? null : <MobileCheckoutBar itemsPara={cart.itemsPara} />}
    </div>
  );
}
