"use client";

import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import {
  AddressBookIcon,
  ChatCircleTextIcon,
  EnvelopeIcon,
  ListNumbersIcon,
  PhoneIcon,
  UserCircleIcon,
  WhatsappLogoIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";

import { isMechanicViewer, useViewer } from "@/lib/auth/useViewer";
import { Sheet } from "@/components/ui/Sheet";
import { NavLinks } from "@/components/shell/NavLinks";
import type { ContactLink } from "@/config/site";
import { ROUTES } from "@/constants/routes";

const CHANNEL_LABEL: Record<ContactLink["channel"], string> = {
  phone: "Pozovite",
  viber: "Viber",
  whatsapp: "WhatsApp",
  email: "E-pošta",
};

const CHANNEL_ICON = {
  phone: PhoneIcon,
  viber: ChatCircleTextIcon,
  whatsapp: WhatsappLogoIcon,
  email: EnvelopeIcon,
} as const;

/**
 * The mobile menu sheet (< 1024 px): primary navigation, account, every configured contact
 * channel and the contact page. Loaded on intent by `MobileNav` (PERF-01/PERF-11), so the
 * Sheet stack and the viewer query stay out of the first load.
 */
export function MobileNavPanel({
  contacts,
  open,
  onOpenChange,
}: {
  contacts: ContactLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);
  const viewer = useViewer();
  const mechanic = isMechanicViewer(viewer);
  const approved = mechanic && viewer?.mechanicStatus === "approved";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" size="sm" title="Meni">
      <nav aria-label="Glavna navigacija">
        <NavLinks layout="column" onNavigate={close} />
      </nav>
      {approved ? (
        <NextLink
          href={ROUTES.mechanicQuickOrderPage}
          onClick={close}
          className="mt-6 flex min-h-11 items-center gap-3 type-body font-semibold text-ink-1"
        >
          <ListNumbersIcon size={24} aria-hidden="true" className="text-accent" />
          Brza porudžbina
        </NextLink>
      ) : null}
      <NextLink
        href={mechanic ? ROUTES.mechanicPortal : ROUTES.account}
        onClick={close}
        className={`${approved ? "mt-1" : "mt-6"} flex min-h-11 items-center gap-3 type-body font-semibold text-ink-1`}
      >
        {mechanic ? (
          <WrenchIcon size={24} aria-hidden="true" className="text-ink-2" />
        ) : (
          <UserCircleIcon size={24} aria-hidden="true" className="text-ink-2" />
        )}
        {mechanic ? "Majstorski portal" : "Moj nalog"}
      </NextLink>
      <div className="mt-8 flex flex-col gap-1 border-t border-line pt-6">
        <p className="mb-2 type-label text-ink-3">Kontakt</p>
        {contacts.map((link) => {
          const Icon = CHANNEL_ICON[link.channel];
          return (
            <a
              key={link.channel}
              href={link.href}
              className="flex min-h-11 items-center gap-3 type-body text-ink-1"
            >
              <Icon size={20} aria-hidden="true" className="text-ink-2" />
              <span>
                {CHANNEL_LABEL[link.channel]}
                <span className="ml-2 type-body-s text-ink-3">{link.display}</span>
              </span>
            </a>
          );
        })}
        <NextLink
          href={ROUTES.inquiry}
          onClick={close}
          className="flex min-h-11 items-center gap-3 type-body text-ink-1"
        >
          <ChatCircleTextIcon size={20} aria-hidden="true" className="text-ink-2" />
          Pošaljite upit po broju šasije
        </NextLink>
        <NextLink
          href={ROUTES.contact}
          onClick={close}
          className="flex min-h-11 items-center gap-3 type-body text-ink-1"
        >
          <AddressBookIcon size={20} aria-hidden="true" className="text-ink-2" />
          Svi podaci za kontakt
        </NextLink>
      </div>
    </Sheet>
  );
}
