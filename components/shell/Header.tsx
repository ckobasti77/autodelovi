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
  "size-11 shrink-0 items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
const textLink =
  "h-11 shrink-0 items-center gap-2 rounded-sm px-2 text-[0.9375rem] font-medium text-ink-2 transition-control hover:text-ink-1";

/**
 * Site header (§10.1). Sticky; at the top of a page it is taller and sits on the page without
 * an edge, and over the first 96 px of scroll it condenses to `--header-h` (64 px, 56 below
 * 1024) and takes its surface: the field at 84 % with a 14 px blur and a hairline (solid under
 * reduced transparency). The condense is a CSS scroll timeline on `--header-p` (`site-header`
 * in globals.css): no script, no layout change — the sticky offset is negative by the extra
 * height. Browsers without scroll timelines, and reduced motion, get the condensed bar.
 *
 * [logo] · nav · search (the primary action: the widest control) · vehicle slot · contact ·
 * account · cart · menu. Below 1024 px: mark · search field · cart · menu, with phone, Viber
 * and account as icons from 480 px; everything else is in MobileNav and the bottom action bar.
 * Excluded from the reveal: chrome must be readable at once.
 */
export function Header({ vehicleSlot, cartCount, contact }: HeaderProps) {
  const resolved = resolveContact(contact);
  const phone = contactLinks.tel(resolved.phone);
  const viber = contactLinks.viber(resolved.viber);

  return (
    <header
      data-reveal="off"
      data-sticky-header=""
      data-vt="header"
      data-testid={TEST_IDS.header}
      className="site-header z-header print:hidden"
    >
      <div aria-hidden="true" className="site-header-surface" />
      <div className="site-header-row relative flex items-center gap-2 px-page lg:gap-3">
        <BrandLink compact="phone" className="site-header-logo mr-4 lg:mr-6" />
        <nav aria-label="Glavna navigacija" className="hidden lg:block">
          <NavLinks />
        </nav>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 xl:gap-2">
          <HeaderSearch className="flex-1 lg:max-w-64 xl:max-w-72 2xl:max-w-80" />
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
