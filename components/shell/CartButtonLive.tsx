"use client";

import type { MouseEvent } from "react";

import { useCartCount } from "@/lib/cart/guestCart";
import { openCartDrawer } from "@/lib/cart/drawer";
import { CartButton } from "@/components/shell/CartButton";

/**
 * Header cart entry with the live item count. With JS it opens the cart drawer; the link to
 * `/korpa` stays for new tabs and no-JS.
 */
export function CartButtonLive({ className }: { className?: string }) {
  const count = useCartCount();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openCartDrawer();
  };
  return <CartButton count={count} className={className} onClick={onClick} />;
}
