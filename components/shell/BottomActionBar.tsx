"use client";

/**
 * Mobile action bar (< 1024 px, DESIGN-SYSTEM §10.1): the four things a buyer reaches for with
 * a thumb — search, vehicle, cart, contact — docked at the bottom of every storefront page that
 * has no bottom bar of its own (product buy bar, cart total, checkout, mechanic portal).
 *
 * Server-rendered with the page. The space it takes (`--bottom-bar-h`) is declared by
 * `BottomBarSpace` at the very start of the shop layout, so it is known before any content:
 * the hero frame, toasts and the consent banner sit above the bar and nothing shifts. The
 * search dialog, vehicle picker, cart drawer and contact sheet it opens are the same lazy
 * chunks the header uses.
 *
 * It registers as a bottom inset (focused controls scroll clear of it, WCAG 2.4.11) and is
 * excluded from the reveal. Orange marks what is yours: a chosen vehicle and a filled cart.
 */
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  CarIcon,
  ChatCircleTextIcon,
  MagnifyingGlassIcon,
  ShoppingCartSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { countSr } from "@/lib/format/plural";
import { RouteLink } from "@/components/ui/RouteLink";
import { warmSearchPanel } from "@/components/shell/HeaderSearch";
import type { ContactLink } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { openCartDrawer } from "@/lib/cart/drawer";
import { useCartCount } from "@/lib/cart/guestCart";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { useLatched } from "@/lib/hooks/useLatched";
import { hasOwnBottomBar } from "@/lib/shell/bottomBar";
import { openSearchPanel } from "@/lib/search/panel";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { useSelectedVehicle, vehicleLabel } from "@/lib/vehicle/store";

const loadContactSheet = () => import("@/components/shell/ContactSheet");
const ContactSheet = dynamic(() => loadContactSheet().then((m) => m.ContactSheet), { ssr: false });
const warmContactSheet = () => void loadContactSheet();
/** The picker dialog is mounted by VehiclePickerLazy; this only warms its chunk on intent. */
const warmVehiclePicker = () => void import("@/components/vehicle/VehiclePickerDialog");

const item =
  "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm type-caption-s text-ink-2 transition-control hover:text-ink-1 active:bg-surface-2 active:text-ink-1 focus-ring-inset";

function ItemLabel({ children }: { children: ReactNode }) {
  return <span className="max-w-full truncate px-1">{children}</span>;
}

export function BottomActionBar({ contacts }: { contacts: ContactLink[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const hidden = hasOwnBottomBar(pathname);
  useBottomInset(ref, !hidden);

  const count = useCartCount();
  const vehicle = useSelectedVehicle();
  const [contactOpen, setContactOpen] = useState(false);
  const contactMounted = useLatched(contactOpen);

  if (hidden) return null;

  const onCart = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openCartDrawer();
  };
  const cartLabel =
    count > 0 ? `Korpa, ${countSr(count, ["artikal", "artikla", "artikala"])}` : "Korpa";

  return (
    <nav
      ref={ref}
      aria-label="Brze radnje"
      data-reveal="off"
      data-vt="bottom-bar"
      data-contact-location="bottom-bar"
      data-testid={TEST_IDS.bottomBar}
      className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-bg-raised/92 pb-[env(safe-area-inset-bottom)] shadow-rest backdrop-blur-header reduced-transparency:bg-bg-raised reduced-transparency:backdrop-blur-none lg:hidden print:hidden"
    >
      <ul className="flex h-15 items-stretch gap-1 px-2 py-1">
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={openSearchPanel}
            onPointerDown={warmSearchPanel}
            onFocus={warmSearchPanel}
            aria-haspopup="dialog"
            className={item}
          >
            <MagnifyingGlassIcon size={22} aria-hidden="true" />
            <ItemLabel>Pretraga</ItemLabel>
          </button>
        </li>
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={openVehiclePicker}
            onPointerDown={warmVehiclePicker}
            onFocus={warmVehiclePicker}
            data-testid={TEST_IDS.bottomBarVehicle}
            aria-haspopup="dialog"
            aria-label={vehicle ? `Vozilo: ${vehicleLabel(vehicle)}. Promeni vozilo` : undefined}
            className={cn(item, vehicle && "text-accent-text hover:text-accent-text")}
          >
            <CarIcon size={22} aria-hidden="true" weight={vehicle ? "fill" : "regular"} />
            <ItemLabel>{vehicle ? vehicleLabel(vehicle) : "Vozilo"}</ItemLabel>
          </button>
        </li>
        <li className="flex min-w-0 flex-1">
          <RouteLink href={ROUTES.cart} onClick={onCart} aria-label={cartLabel} className={item}>
            <span className="relative inline-flex">
              <ShoppingCartSimpleIcon size={22} aria-hidden="true" />
              {count > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-2.5 -top-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 font-ui text-[0.6875rem] font-bold tabular-nums leading-none text-on-accent"
                >
                  {count > 9 ? "9+" : count}
                </span>
              ) : null}
            </span>
            <ItemLabel>Korpa</ItemLabel>
          </RouteLink>
        </li>
        <li className="flex min-w-0 flex-1">
          {contacts.length > 0 ? (
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              onPointerDown={warmContactSheet}
              onFocus={warmContactSheet}
              aria-haspopup="dialog"
              aria-expanded={contactOpen}
              className={item}
            >
              <ChatCircleTextIcon size={22} aria-hidden="true" />
              <ItemLabel>Kontakt</ItemLabel>
            </button>
          ) : (
            // No phone, Viber or e-mail in settings yet: the inquiry is the way in.
            <RouteLink href={ROUTES.inquiry} className={item}>
              <ChatCircleTextIcon size={22} aria-hidden="true" />
              <ItemLabel>Upit</ItemLabel>
            </RouteLink>
          )}
        </li>
      </ul>
      {contactMounted ? (
        <ContactSheet contacts={contacts} open={contactOpen} onOpenChange={setContactOpen} />
      ) : null}
    </nav>
  );
}
