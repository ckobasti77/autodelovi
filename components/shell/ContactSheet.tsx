"use client";

import {
  AddressBookIcon,
  CaretRightIcon,
  ChatCircleTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  QuestionIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { RouteLink } from "@/components/ui/RouteLink";
import { Sheet } from "@/components/ui/Sheet";
import type { ContactLink } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { track } from "@/lib/analytics/track";

const CHANNEL = {
  phone: { label: "Pozovite", Icon: PhoneIcon },
  viber: { label: "Viber", Icon: ChatCircleTextIcon },
  whatsapp: { label: "WhatsApp", Icon: WhatsappLogoIcon },
  email: { label: "E-pošta", Icon: EnvelopeIcon },
} as const;

const row =
  "flex min-h-14 items-center gap-3 rounded-sm px-3 text-ink-1 transition-control hover:bg-surface-4 active:bg-surface-4";

/**
 * Contact sheet of the mobile action bar: every channel that exists in settings as a one-tap
 * row, then the inquiry and the contact page. Loaded on the first tap (the Sheet stack is not
 * part of the first load). Nothing is invented: a channel without data is not shown.
 */
export function ContactSheet({
  contacts,
  open,
  onOpenChange,
}: {
  contacts: ContactLink[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      initialSnap="peek"
      title="Kontakt"
      testId={TEST_IDS.contactSheet}
    >
      <ul className="-mx-3 flex flex-col gap-1" data-contact-location="contact-sheet">
        {contacts.map((link) => {
          const { label, Icon } = CHANNEL[link.channel];
          return (
            <li key={link.channel}>
              <a
                href={link.href}
                data-contact-tracked=""
                onClick={() => {
                  track({ name: "contact_click", channel: link.channel, location: "contact-sheet" });
                  close();
                }}
                className={row}
                {...(link.channel === "whatsapp"
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <Icon size={22} aria-hidden="true" className="shrink-0 text-ink-2" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="type-body font-semibold">{label}</span>
                  <span className="truncate type-body-s text-ink-3">{link.display}</span>
                </span>
                {link.channel === "whatsapp" ? (
                  <span className="sr-only">(otvara se u novom prozoru)</span>
                ) : null}
              </a>
            </li>
          );
        })}
        <li className="mt-2 border-t border-line pt-2">
          <RouteLink href={ROUTES.inquiry} onClick={close} className={row}>
            <QuestionIcon size={22} aria-hidden="true" className="shrink-0 text-ink-2" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="type-body font-semibold">Pošaljite upit</span>
              <span className="type-body-s text-ink-3">Broj šasije i šta vam treba</span>
            </span>
            <CaretRightIcon size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
          </RouteLink>
        </li>
        <li>
          <RouteLink href={ROUTES.contact} onClick={close} className={row}>
            <AddressBookIcon size={22} aria-hidden="true" className="shrink-0 text-ink-2" />
            <span className="min-w-0 flex-1 type-body font-semibold">Svi podaci za kontakt</span>
            <CaretRightIcon size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
          </RouteLink>
        </li>
      </ul>
    </Sheet>
  );
}
