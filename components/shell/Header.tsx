import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import type { ReactNode } from "react";
import { ChatCircleTextIcon, PhoneIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList, contactLinks, resolveContact, type Contact } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { Wordmark } from "@/components/shell/BrandMark";
import { CartButton } from "@/components/shell/CartButton";
import { HeaderSearch } from "@/components/shell/HeaderSearch";
import { MobileNav } from "@/components/shell/MobileNav";
import { NavLinks } from "@/components/shell/NavLinks";

export type HeaderProps = {
  /** Vehicle picker chip (≥ 1280 px); the picker owns its state. */
  vehicleSlot?: ReactNode;
  cartCount?: number;
  /** Settings override for contact data (config fallback otherwise). */
  contact?: Partial<Contact> | null;
};

const iconLink =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1";
const textLink =
  "inline-flex h-11 items-center gap-2 rounded-xs px-2 text-[0.9375rem] font-medium text-ink-2 transition-control hover:text-ink-1";

/**
 * Site header (§10.1): 64 px (56 below 1024), bg at 88 % + 12 px blur (solid under reduced
 * transparency). [mark] SKLOP · nav · search · vehicle slot · contact · account · cart · menu.
 * Contact: text links ≥ 1440 px, icon buttons below; Viber moves into the menu below 640 px.
 * Excluded from the text reveal: chrome must be readable at once.
 */
export function Header({ vehicleSlot, cartCount = 0, contact }: HeaderProps) {
  const resolved = resolveContact(contact);
  const phone = contactLinks.tel(resolved.phone);
  const viber = contactLinks.viber(resolved.viber);

  return (
    <header
      data-reveal="off"
      data-testid={TEST_IDS.header}
      className="sticky top-0 z-header border-b border-line bg-bg/88 backdrop-blur-header reduced-transparency:bg-bg-raised reduced-transparency:backdrop-blur-none"
    >
      <div className="flex h-header items-center gap-1 px-page lg:gap-3">
        <Wordmark className="mr-2 lg:mr-4" />
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
                className={`${iconLink} min-[90rem]:hidden`}
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
          <NextLink
            href={ROUTES.signIn}
            aria-label="Prijava"
            data-testid={TEST_IDS.accountButton}
            className={`${iconLink} hidden sm:inline-flex`}
          >
            <UserCircleIcon size={24} aria-hidden="true" />
          </NextLink>
          <CartButton count={cartCount} />
          <MobileNav contacts={contactLinkList(resolved)} className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}
