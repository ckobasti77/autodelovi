"use client";

import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { useState } from "react";
import {
  ChatCircleTextIcon,
  EnvelopeIcon,
  ListIcon,
  PhoneIcon,
  UserCircleIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { NavLinks } from "@/components/shell/NavLinks";
import type { ContactLink } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

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

/** Mobile menu (< 1024 px): primary navigation, account and every configured contact channel. */
export function MobileNav({
  contacts,
  className,
}: {
  contacts: ContactLink[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className={className}>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        side="right"
        size="sm"
        title="Meni"
        trigger={
          <IconButton
            label="Otvori meni"
            icon={<ListIcon size={24} />}
            data-testid={TEST_IDS.mobileMenuTrigger}
          />
        }
      >
        <nav aria-label="Glavna navigacija">
          <NavLinks layout="column" onNavigate={close} />
        </nav>
        <NextLink
          href={ROUTES.account}
          onClick={close}
          className="mt-6 flex min-h-11 items-center gap-3 type-body font-semibold text-ink-1"
        >
          <UserCircleIcon size={24} aria-hidden="true" className="text-ink-2" />
          Moj nalog
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
        </div>
      </Sheet>
    </div>
  );
}
