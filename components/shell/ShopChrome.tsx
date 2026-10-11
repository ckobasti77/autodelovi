"use client";

/**
 * Client chrome of the storefront, mounted once in the shop layout: the cart drawer (its chunk
 * loads on first open), attribution capture, guest-cart merge after sign-in, the offline
 * notice, the polite live region add-to-cart announces into and the mobile action bar
 * (search, vehicle, cart, contact — it replaces the scroll-up contact bar of FLOW-12).
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";

import { captureAttribution } from "@/lib/analytics/attribution";
import { track, type ContactChannel } from "@/lib/analytics/track";
import { useMergeGuestCartOnSignIn } from "@/lib/cart/guestCart";
import { useCartDrawer } from "@/lib/cart/drawer";
import { useLatched } from "@/lib/hooks/useLatched";
import type { DeliveryInfo } from "@/components/cart/CartView";
import { BottomActionBar } from "@/components/shell/BottomActionBar";
import type { ContactLink } from "@/config/site";

const loadDrawer = () => import("@/components/cart/CartDrawer");
const CartDrawer = dynamic(() => loadDrawer().then((m) => m.CartDrawer), { ssr: false });

/** Contact channel of a link (`tel:`, `viber:`, WhatsApp, `mailto:`), or null. */
function contactChannel(href: string): ContactChannel | null {
  if (href.startsWith("tel:")) return "phone";
  if (href.startsWith("viber:")) return "viber";
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href) || href.startsWith("whatsapp:")) {
    return "whatsapp";
  }
  if (href.startsWith("mailto:")) return "email";
  return null;
}

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
        <div className="fixed inset-x-0 bottom-bar-offset z-toast flex items-center justify-center gap-2 border-t border-line-strong bg-surface-3 px-4 py-3 type-body-s text-ink-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <WifiSlashIcon size={18} aria-hidden="true" className="text-warning" />
          Nema veze — pokušavamo ponovo. Korpa i uneti podaci ostaju sačuvani.
        </div>
      ) : null}
    </div>
  );
}

export function ShopChrome({
  delivery,
  contacts = [],
}: {
  delivery: DeliveryInfo;
  /** Contact channels from settings for the mobile action bar's contact sheet. */
  contacts?: ContactLink[];
}) {
  const open = useCartDrawer((s) => s.open);
  const mounted = useLatched(open);
  useMergeGuestCartOnSignIn();

  useEffect(() => {
    captureAttribution();
    // Header/footer contact links are server-rendered anchors: one delegated listener tracks
    // them (`ContactActions` tracks its own links and marks them `data-contact-tracked`).
    const onContactClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-contact-tracked")) return;
      const channel = contactChannel(a.getAttribute("href") ?? "");
      if (!channel) return;
      const location =
        a.closest("[data-contact-location]")?.getAttribute("data-contact-location") ??
        (a.closest("header") ? "header" : a.closest("footer") ? "footer" : "page");
      track({ name: "contact_click", channel, location });
    };
    document.addEventListener("click", onContactClick, true);
    // Warm the drawer chunk on the first sign of intent, never during page load (TBT).
    const warm = () => void loadDrawer();
    const button = document.querySelector("[data-testid='cart-button']");
    button?.addEventListener("pointerenter", warm, { once: true });
    button?.addEventListener("focus", warm, { once: true });
    return () => {
      document.removeEventListener("click", onContactClick, true);
      button?.removeEventListener("pointerenter", warm);
      button?.removeEventListener("focus", warm);
    };
  }, []);

  return (
    <>
      <p id="cart-live" className="sr-only" aria-live="polite" data-reveal="off" />
      {mounted ? <CartDrawer delivery={delivery} /> : null}
      <BottomActionBar contacts={contacts} />
      <OfflineNotice />
    </>
  );
}
