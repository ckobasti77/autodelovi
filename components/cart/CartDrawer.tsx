"use client";

/**
 * Cart drawer (§9.11): right drawer 420 px with scrim; lines, summary, „Nastavi na
 * porudžbinu“ and „Nastavi kupovinu“. Opened from the header cart button and the add-to-cart
 * toast; `/korpa` stays the no-JS and deep-link fallback.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { MagnifyingGlassIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { useCart } from "@/lib/cart/guestCart";
import { useCartDrawer } from "@/lib/cart/drawer";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { CartLines, CartSummary, type DeliveryInfo } from "@/components/cart/CartView";
import { ROUTES } from "@/constants/routes";

function focusHeaderSearch() {
  document.querySelector<HTMLButtonElement>("[data-testid='header-search-trigger']")?.click();
}

export function CartDrawer({ delivery }: { delivery: DeliveryInfo }) {
  const open = useCartDrawer((s) => s.open);
  const setOpen = useCartDrawer((s) => s.setOpen);
  const cart = useCart();
  const pathname = usePathname();

  // Navigating away (checkout, a product) closes the drawer — not the first render, which is
  // the very open that mounted this lazy chunk.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setOpen(false);
  }, [pathname, setOpen]);

  const count = cart?.itemCount ?? 0;
  const empty = cart === null || (cart !== undefined && cart.lines.length === 0);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      side="right"
      size="sm"
      modal
      title={count > 0 ? `Korpa (${count})` : "Korpa"}
      testId="cart-drawer"
      footer={
        cart && cart.lines.length > 0 ? (
          <div className="flex flex-col gap-4">
            <CartSummary cart={cart} delivery={delivery} />
            <div className="flex flex-col gap-2">
              <Button asChild variant="primary" size="lg" fullWidth>
                <Link href={ROUTES.checkout} variant="unstyled" data-testid="cart-checkout">
                  Nastavi na porudžbinu
                </Link>
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setOpen(false)}>
                Nastavi kupovinu
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {cart === undefined ? (
        <SkeletonRegion label="Učitava se korpa">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="grid grid-cols-[4rem_1fr] gap-3 border-b border-line py-4">
              <Skeleton className="size-16" />
              <span className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-[80%]" />
                <Skeleton className="h-3 w-[50%]" />
                <Skeleton className="h-9 w-32" />
              </span>
            </div>
          ))}
        </SkeletonRegion>
      ) : empty ? (
        <EmptyState
          icon={<ShoppingCartSimpleIcon size={40} />}
          action={
            <Button
              variant="primary"
              icon={<MagnifyingGlassIcon size={20} />}
              onClick={() => {
                setOpen(false);
                window.setTimeout(focusHeaderSearch, 260);
              }}
            >
              Pretražite po broju dela
            </Button>
          }
        >
          Korpa je prazna.
        </EmptyState>
      ) : (
        <CartLines cart={cart} compact />
      )}
    </Sheet>
  );
}
