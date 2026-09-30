"use client";

import { MagnifyingGlassIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { useCart } from "@/lib/cart/guestCart";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { CartLines, CartSummary, type DeliveryInfo } from "@/components/cart/CartView";
import { ROUTES } from "@/constants/routes";

export function CartPageView({ delivery }: { delivery: DeliveryInfo }) {
  const cart = useCart();
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
          <Button asChild variant="primary" size="lg" fullWidth>
            <Link href={ROUTES.checkout} variant="unstyled" data-testid="cart-checkout">
              Nastavi na porudžbinu
            </Link>
          </Button>
          <p className="type-caption font-normal text-ink-3">
            Bez plaćanja karticom na sajtu. Plaćate pouzećem, pri preuzimanju ili virmanom.
          </p>
          <Link href={ROUTES.parts} variant="standalone" className="type-body-s">
            Nastavi kupovinu
          </Link>
        </div>
      </aside>
    </div>
  );
}
