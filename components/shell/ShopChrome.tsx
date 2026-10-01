"use client";

/**
 * Client chrome of the storefront, mounted once in the shop layout: the cart drawer (its chunk
 * loads on first open), attribution capture, guest-cart merge after sign-in, the offline
 * notice, the polite live region add-to-cart announces into and the mobile contact bar
 * (FLOW-12: decided here, its chunk loads on the first scroll-up).
 */
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";

import { captureAttribution } from "@/lib/analytics/attribution";
import { track, type ContactChannel } from "@/lib/analytics/track";
import { useMergeGuestCartOnSignIn } from "@/lib/cart/guestCart";
import { useCartDrawer } from "@/lib/cart/drawer";
import { useLatched } from "@/lib/hooks/useLatched";
import { useConsent } from "@/lib/analytics/consentStore";
import { ROUTES } from "@/constants/routes";
import type { DeliveryInfo } from "@/components/cart/CartView";
import type { StickyContactChannel } from "@/components/shell/StickyContactBar";

const loadDrawer = () => import("@/components/cart/CartDrawer");
const CartDrawer = dynamic(() => loadDrawer().then((m) => m.CartDrawer), { ssr: false });
const StickyContactBar = dynamic(
  () => import("@/components/shell/StickyContactBar").then((m) => m.StickyContactBar),
  { ssr: false },
);

/** Routes with their own bottom bar (buy bar, cart total, checkout, mechanic portal). */
const OWN_BOTTOM_BAR = ["/deo/", ROUTES.cart, ROUTES.checkout, ROUTES.mechanicPortal];
/** Scroll distance before the bar may appear, and the movement that counts as a direction. */
const SHOW_AFTER_PX = 480;
const DIRECTION_PX = 24;

/** True while the visitor scrolls back up, past the first screen (phones only). */
function useScrollUpIntent(enabled: boolean): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const narrow = window.matchMedia("(max-width: 63.999rem)");
    let anchor = window.scrollY;
    let first = true;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      // (Re)enabled: start hidden; only a scroll-up from here shows the bar.
      if (first || !narrow.matches || y < SHOW_AFTER_PX) {
        first = false;
        anchor = y;
        setUp(false);
        return;
      }
      if (y < anchor - DIRECTION_PX) {
        anchor = y;
        setUp(true);
      } else if (y > anchor + DIRECTION_PX) {
        anchor = y;
        setUp(false);
      }
      // Smaller moves keep the anchor, so a slow scroll still adds up to a direction.
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return up;
}

function ContactBarSlot({ channels }: { channels: StickyContactChannel[] }) {
  const pathname = usePathname();
  const bannerOpen = useConsent((s) => !s.initialised || s.open);
  const allowed =
    channels.length > 0 &&
    !bannerOpen &&
    !OWN_BOTTOM_BAR.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  const visible = useScrollUpIntent(allowed) && allowed;
  const mounted = useLatched(visible);
  return mounted ? <StickyContactBar channels={channels} visible={visible} /> : null;
}

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
        <div className="fixed inset-x-0 bottom-0 z-toast flex items-center justify-center gap-2 border-t border-line-strong bg-surface-3 px-4 py-3 type-body-s text-ink-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <WifiSlashIcon size={18} aria-hidden="true" className="text-warning" />
          Nema veze — pokušavamo ponovo. Korpa i uneti podaci ostaju sačuvani.
        </div>
      ) : null}
    </div>
  );
}

export function ShopChrome({
  delivery,
  contactChannels = [],
}: {
  delivery: DeliveryInfo;
  /** Phone / Viber from settings for the mobile contact bar (none ⇒ no bar). */
  contactChannels?: StickyContactChannel[];
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
      <ContactBarSlot channels={contactChannels} />
      <OfflineNotice />
    </>
  );
}
