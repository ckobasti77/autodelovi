"use client";

/**
 * Call / Viber / WhatsApp / e-mail actions with `contact_click` tracking (SEO-ADS §J7).
 * Only channels present in settings render; nothing is invented.
 */
import {
  ChatCircleTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics/track";
import type { ContactLink } from "@/config/site";

const META = {
  phone: { label: "Pozovite", Icon: PhoneIcon },
  viber: { label: "Viber", Icon: ChatCircleTextIcon },
  whatsapp: { label: "WhatsApp", Icon: WhatsappLogoIcon },
  email: { label: "E-pošta", Icon: EnvelopeIcon },
} as const;

export function ContactActions({
  links,
  location,
  variant = "inline",
  showValue = false,
  className,
}: {
  links: ContactLink[];
  location: string;
  /** inline: text links with icons; buttons: quiet 44 px buttons. */
  variant?: "inline" | "buttons";
  showValue?: boolean;
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)} data-reveal="off">
      {links.map((link) => {
        const { label, Icon } = META[link.channel];
        return (
          <li key={link.channel}>
            <a
              href={link.href}
              onClick={() => track({ name: "contact_click", channel: link.channel, location })}
              className={cn(
                "inline-flex items-center gap-2 transition-control",
                variant === "buttons"
                  ? "h-11 rounded-xs border border-control bg-surface-2 px-3.5 type-button text-ink-1 hover:border-accent hover:bg-surface-3 active:translate-y-px"
                  : "min-h-11 type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 hover:decoration-accent",
              )}
              {...(link.channel === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <Icon size={20} aria-hidden="true" className="shrink-0 text-ink-2" />
              <span>
                {label}
                {showValue ? <span className="font-normal text-ink-2"> {link.display}</span> : null}
              </span>
              {link.channel === "whatsapp" ? (
                <span className="sr-only"> (otvara se u novom prozoru)</span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
