import {
  ArrowUpRightIcon,
  ChatCircleTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { ContactLink } from "@/config/site";

const CHANNEL = {
  phone: { label: "Pozovite", Icon: PhoneIcon },
  viber: { label: "Viber", Icon: ChatCircleTextIcon },
  whatsapp: { label: "WhatsApp", Icon: WhatsappLogoIcon },
  email: { label: "E-pošta", Icon: EnvelopeIcon },
} as const;

/**
 * The channels from settings as one-tap rows (the contact page): icon, what the row does, the
 * number or address, 64 px tall. Server-rendered anchors — the delegated listener of
 * `ShopChrome` reports `contact_click` with the `location` of the nearest
 * `data-contact-location`, so no client code is needed here. A channel without data is not in
 * `links` and has no row.
 */
export function ContactChannels({ links, location }: { links: ContactLink[]; location: string }) {
  return (
    <ul className="flex flex-col" data-contact-location={location} data-reveal="off">
      {links.map((link) => {
        const { label, Icon } = CHANNEL[link.channel];
        return (
          <li key={link.channel} className="border-t border-line-faint first:border-t-0">
            <a
              href={link.href}
              className="group flex min-h-16 items-center gap-4 px-4 py-3 transition-control hover:bg-surface-2 focus-ring-inset sm:px-5"
              {...(link.channel === "whatsapp"
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center panel-inset text-ink-2"
              >
                <Icon size={20} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="type-body font-semibold text-ink-1">{label}</span>
                <span className="truncate type-body-s tabular-nums text-ink-2">
                  {link.display}
                </span>
              </span>
              <ArrowUpRightIcon
                size={16}
                aria-hidden="true"
                className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
              />
              {link.channel === "whatsapp" ? (
                <span className="sr-only">(otvara se u novom prozoru)</span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
