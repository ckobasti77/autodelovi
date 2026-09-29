"use client";

import { useCartCount } from "@/lib/cart/guestCart";
import { CartButton } from "@/components/shell/CartButton";

/** Header cart entry with the live item count (no subscription until a cart exists). */
export function CartButtonLive({ className }: { className?: string }) {
  const count = useCartCount();
  return <CartButton count={count} className={className} />;
}
