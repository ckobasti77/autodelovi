import type { ReactNode } from "react";
import { ChatCircleTextIcon, PhoneIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList, contactLinks, resolveContact, type Contact } from "@/config/site";
import { TEST_IDS } from "@/constants/testIds";
import { AccountLink } from "@/components/shell/AccountLink";
import { BrandLink } from "@/components/brand/BrandLink";
import { CartButton } from "@/components/shell/CartButton";
import { CartButtonLive } from "@/components/shell/CartButtonLive";
import { HeaderSearch } from "@/components/shell/HeaderSearch";
import { MobileNav } from "@/components/shell/MobileNav";
import { NavLinks } from "@/components/shell/NavLinks";

export type HeaderProps = {
  /** Vehicle picker chip (≥ 1280 px); the picker owns its state. */
  vehicleSlot?: ReactNode;
  /** Fixed count (styleguide); omitted → live count from the cart. */
  cartCount?: number;
  /** Settings override for contact data (config fallback otherwise). */
  contact?: Partial<Contact> | null;
};

/**
 * Link looks without a display utility: every use adds its own (`hidden sm:inline-flex`, …).
 * A display class in a shared style would collide with `hidden` (both unprefixed), and
 * Tailwind's output order — not the class order — would decide which one wins (VIS-03).
 */
const iconLink =
  "size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
const textLink =
  "h-11 shrink-0 items-center gap-2 rounded-xs px-2 text-[0.9375rem] font-medium text-ink-2 transition-control hover:text-ink-1";

/**
 * Site header (§10.1): 64 px (56 below 1024), bg at 88 % + 12 px blur (solid under reduced
 * transparency). [logo] · nav · search · vehicle slot · contact · account · cart · menu.
 * Contact: text links ≥ 1440 px, icon buttons from 480 px. Below 480 px the bar holds only the
 * mark, search, cart and menu (the header lockup replaces the mark from 640 px); phone, Viber and the account/mechanic links live in MobileNav.
 * Excluded from the text reveal: chrome must be readable at once.
 */
export function Header({ vehicleSlot, cartCount, contact }: HeaderProps) {
  const resolved = resolveContact(contact);
  const phone = contactLinks.tel(resolved.phone);
  const viber = contactLinks.viber(resolved.viber);

  return (
    <header
      data-reveal="off"
      data-sticky-header=""
      data-testid={TEST_IDS.header}
      className="sticky top-0 z-header border-b print:hidden border-line bg-bg/88 backdrop-blur-header reduced-transparency:bg-bg-raised reduced-transparency:backdrop-blur-none"
    >
      <div className="flex h-header items-center gap-1 px-page lg:gap-3">
        <BrandLink compact="phone" className="mr-2 lg:mr-4" />
        <nav aria-label="Glavna navigacija" className="hidden lg:block">
          <NavLinks />
        </nav>
        <div className="ml-auto flex items-center gap-0.5 lg:gap-2">
          <HeaderSearch />
          {vehicleSlot ? <div className="hidden xl:block">{vehicleSlot}</div> : null}
          {phone ? (
            <>
              <a href={phone.href} className={`${textLink} hidden min-[90rem]:inline-flex`}>
                <PhoneIcon size={20} aria-hidden="true" />
                Pozovite
              </a>
              <a
                href={phone.href}
                aria-label={`Pozovite ${phone.display}`}
                className={`${iconLink} hidden sm:inline-flex min-[90rem]:hidden`}
              >
                <PhoneIcon size={24} aria-hidden="true" />
              </a>
            </>
          ) : null}
          {viber ? (
            <>
              <a href={viber.href} className={`${textLink} hidden min-[90rem]:inline-flex`}>
                <ChatCircleTextIcon size={20} aria-hidden="true" />
                Viber
              </a>
              <a
                href={viber.href}
                aria-label={`Viber ${viber.display}`}
                className={`${iconLink} hidden sm:inline-flex min-[90rem]:hidden`}
              >
                <ChatCircleTextIcon size={24} aria-hidden="true" />
              </a>
            </>
          ) : null}
          <AccountLink className={`${iconLink} hidden sm:inline-flex`} />
          {cartCount === undefined ? <CartButtonLive /> : <CartButton count={cartCount} />}
          <MobileNav contacts={contactLinkList(resolved)} className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}
