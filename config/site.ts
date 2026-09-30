/**
 * Brand and business configuration — the single source for everything brand-related.
 *
 * Convex `settings` (admin → Podešavanja, step 05+) override these values at runtime via
 * `resolveContact()` / `resolveCompany()`; this file is the fallback used before settings
 * exist and in places that cannot read settings (build time, OG images, manifest).
 *
 * Contact and company fields are intentionally empty until the owner supplies real data
 * (docs/HUMAN-TODO.md §1). Every consumer must treat an empty value as "not available" and
 * hide the channel instead of rendering a placeholder.
 */
import { formatPhone, normalizePhone, telHref, viberHref, whatsappHref } from "@/lib/format/phone";

const env = (value: string | undefined): string => value?.trim() ?? "";

export type Address = {
  street: string;
  postalCode: string;
  city: string;
  /** Link to a map (Google Maps / OpenStreetMap), empty when unknown. */
  mapUrl: string;
};

export type Contact = {
  /** Phone as the owner typed it; normalised on use. */
  phone: string;
  viber: string;
  whatsapp: string;
  email: string;
  address: Address;
  /** Working hours in plain Serbian, e.g. „Pon–pet 8–17, sub 8–14“. */
  hours: string;
};

export type Company = {
  legalName: string;
  pib: string;
  mb: string;
  /** Registry line, e.g. „APR, BD 12345/2020“. */
  registry: string;
  seat: string;
};

export const site = {
  brand: {
    name: "SKLOP",
    tagline: "Rasklopi auto. Nađi deo.",
    description:
      "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra vozila. Pretraga po OEM broju, izbor po vozilu i poručivanje bez plaćanja unapred.",
    /** Brands served — nominative use only (no logos). */
    makes: ["Volkswagen", "Audi", "Škoda", "SEAT", "Cupra"] as const,
  },
  locale: "sr-Latn-RS",
  language: "sr",
  country: "RS",
  currency: "RSD",
  /** VAT (PDV) rate applied to retail prices, which are always shown VAT-inclusive. */
  vatRate: 0.2,
  timeZone: "Europe/Belgrade",
  /** Canonical origin. Set NEXT_PUBLIC_SITE_URL in production. */
  url: env(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000",
  /** Browser UI colour — mirrors `--color-bg` (night) in app/globals.css. */
  themeColor: "#0D0F11",
  contact: {
    phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE),
    viber: env(process.env.NEXT_PUBLIC_CONTACT_VIBER),
    whatsapp: env(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP),
    email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
    address: { street: "", postalCode: "", city: "", mapUrl: "" },
    hours: "",
  } satisfies Contact,
  company: {
    legalName: "",
    pib: "",
    mb: "",
    registry: "",
    seat: "",
  } satisfies Company,
} as const;

export type Site = typeof site;

/** Metadata base for absolute URLs (canonicals, OG). */
export function siteUrl(): URL {
  return new URL(site.url);
}

/** Merge runtime settings over the config fallback; empty override values never erase config values. */
export function resolveContact(overrides?: Partial<Contact> | null): Contact {
  const base = site.contact;
  const pick = (a: string | undefined, b: string) => (a && a.trim() ? a.trim() : b);
  return {
    phone: pick(overrides?.phone, base.phone),
    viber: pick(overrides?.viber, base.viber),
    whatsapp: pick(overrides?.whatsapp, base.whatsapp),
    email: pick(overrides?.email, base.email),
    hours: pick(overrides?.hours, base.hours),
    address: {
      street: pick(overrides?.address?.street, base.address.street),
      postalCode: pick(overrides?.address?.postalCode, base.address.postalCode),
      city: pick(overrides?.address?.city, base.address.city),
      mapUrl: pick(overrides?.address?.mapUrl, base.address.mapUrl),
    },
  };
}

export function resolveCompany(overrides?: Partial<Company> | null): Company {
  const base = site.company;
  const pick = (a: string | undefined, b: string) => (a && a.trim() ? a.trim() : b);
  return {
    legalName: pick(overrides?.legalName, base.legalName),
    pib: pick(overrides?.pib, base.pib),
    mb: pick(overrides?.mb, base.mb),
    registry: pick(overrides?.registry, base.registry),
    seat: pick(overrides?.seat, base.seat),
  };
}

export type ContactChannel = "phone" | "viber" | "whatsapp" | "email";

export type ContactLink = {
  channel: ContactChannel;
  href: string;
  /** Human-readable value („+381 64 123 4567“, „prodaja@…“). */
  display: string;
};

/**
 * Link builders. Each returns `null` when the value is missing or invalid, so callers can
 * simply skip the channel („graceful empty state“).
 */
export const contactLinks = {
  tel(phone: string | null | undefined): ContactLink | null {
    const e164 = normalizePhone(phone);
    return e164 ? { channel: "phone", href: telHref(e164), display: formatPhone(e164) } : null;
  },
  viber(phone: string | null | undefined): ContactLink | null {
    const e164 = normalizePhone(phone);
    return e164 ? { channel: "viber", href: viberHref(e164), display: formatPhone(e164) } : null;
  },
  whatsapp(phone: string | null | undefined, text?: string): ContactLink | null {
    const e164 = normalizePhone(phone);
    return e164
      ? { channel: "whatsapp", href: whatsappHref(e164, text), display: formatPhone(e164) }
      : null;
  },
  email(address: string | null | undefined, subject?: string): ContactLink | null {
    const value = address?.trim() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return { channel: "email", href: `mailto:${value}${query}`, display: value };
  },
};

/**
 * All available contact links for a contact record, in display order (phone, Viber, WhatsApp,
 * e-mail). `topic` (e.g. „Porudžbina SK-2026-000187“) pre-fills the WhatsApp message and the
 * e-mail subject so the question arrives with its number.
 */
export function contactLinkList(contact: Contact, topic?: string): ContactLink[] {
  return [
    contactLinks.tel(contact.phone),
    contactLinks.viber(contact.viber),
    contactLinks.whatsapp(contact.whatsapp, topic),
    contactLinks.email(contact.email, topic),
  ].filter((link): link is ContactLink => link !== null);
}
