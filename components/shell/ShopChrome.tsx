"use client";

/**
 * Client chrome of the storefront, mounted once in the shop layout: the cart drawer (its chunk
 * loads on first open), attribution capture, guest-cart merge after sign-in, the offline
 * notice and the polite live region add-to-cart announces into.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";

import { captureAttribution } from "@/lib/analytics/attribution";
import { useMergeGuestCartOnSignIn } from "@/lib/cart/guestCart";
import { useCartDrawer } from "@/lib/cart/drawer";
import { useLatched } from "@/lib/hooks/useLatched";
import type { DeliveryInfo } from "@/components/cart/CartView";

const loadDrawer = () => import("@/components/cart/CartDrawer");
const CartDrawer = dynamic(() => loadDrawer().then((m) => m.CartDrawer), { ssr: false });

function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" data-reveal="off">
      {offline ? (
        <div className="fixed inset-x-0 bottom-0 z-toast flex items-center justify-center gap-2 border-t border-line-strong bg-surface-3 px-4 py-3 type-body-s text-ink-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <WifiSlashIcon size={18} aria-hidden="true" className="text-warning" />
          Nema veze — pokušavamo ponovo. Korpa i uneti podaci ostaju sačuvani.
        </div>
      ) : null}
    </div>
  );
}

export function ShopChrome({ delivery }: { delivery: DeliveryInfo }) {
  const open = useCartDrawer((s) => s.open);
  const mounted = useLatched(open);
  useMergeGuestCartOnSignIn();

  useEffect(() => {
    captureAttribution();
    const warm = () => void loadDrawer();
    if (document.readyState === "complete") window.setTimeout(warm, 2500);
    else window.addEventListener("load", () => window.setTimeout(warm, 2500), { once: true });
  }, []);

  return (
    <>
      <p id="cart-live" className="sr-only" aria-live="polite" data-reveal="off" />
      {mounted ? <CartDrawer delivery={delivery} /> : null}
      <OfflineNotice />
    </>
  );
}
