/**
 * Shared storefront wording (DESIGN-SYSTEM §3.6, §11): statuses, methods, CTAs and errors in
 * one place, so a second locale can replace this file later.
 */
import { formatDate } from "@/lib/format/date";

export type OrderStatus =
  | "nova"
  | "potvrdjena"
  | "ceka_deo"
  | "spremna_za_preuzimanje"
  | "poslata"
  | "preuzeta"
  | "isporucena"
  | "zavrsena"
  | "otkazana";

export type InquiryStatus =
  | "nov"
  | "u_obradi"
  | "ponuda_poslata"
  | "prihvacena"
  | "odbijena"
  | "istekla";

export const ORDER_STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  nova: "Primljena",
  potvrdjena: "Potvrđena",
  ceka_deo: "Čeka deo",
  spremna_za_preuzimanje: "Spremna za preuzimanje",
  poslata: "Poslata",
  preuzeta: "Preuzeta",
  isporucena: "Isporučena",
  zavrsena: "Završena",
  otkazana: "Otkazana",
};

export const ORDER_STATUS_TONE: Readonly<
  Record<OrderStatus, "info" | "success" | "warning" | "danger" | "neutral">
> = {
  nova: "info",
  potvrdjena: "info",
  ceka_deo: "warning",
  spremna_za_preuzimanje: "info",
  poslata: "info",
  preuzeta: "success",
  isporucena: "success",
  zavrsena: "neutral",
  otkazana: "danger",
};

export const INQUIRY_STATUS_LABEL: Readonly<Record<InquiryStatus, string>> = {
  nov: "Primljen",
  u_obradi: "U obradi",
  ponuda_poslata: "Ponuda poslata",
  prihvacena: "Prihvaćena",
  odbijena: "Odbijena",
  istekla: "Istekla",
};

export const INQUIRY_STATUS_TONE: Readonly<
  Record<InquiryStatus, "info" | "success" | "warning" | "danger" | "neutral">
> = {
  nov: "info",
  u_obradi: "info",
  ponuda_poslata: "info",
  prihvacena: "success",
  odbijena: "neutral",
  istekla: "warning",
};

export const DELIVERY_LABEL = {
  pickup: "Lično preuzimanje",
  courier: "Kurirska služba",
} as const;

export const PAYMENT_LABEL = {
  cod: "Pouzećem",
  pickup_cash: "Gotovinom pri preuzimanju",
  pickup_card: "Karticom pri preuzimanju",
  bank_transfer: "Virmanom uz predračun",
  deferred: "Odloženo plaćanje",
} as const;

export type PaymentCode = keyof typeof PAYMENT_LABEL;
export type DeliveryCode = keyof typeof DELIVERY_LABEL;

/** Reminder above „Pošalji porudžbinu“ (DS §9.12). */
export const PAYMENT_REMINDER: Readonly<Record<PaymentCode, string>> = {
  cod: "Plaćate pouzećem kuriru pri preuzimanju paketa.",
  pickup_cash: "Plaćate gotovinom u radnji kada preuzimate deo.",
  pickup_card: "Plaćate karticom u radnji kada preuzimate deo.",
  bank_transfer: "Posle potvrde šaljemo predračun; deo rezervišemo do uplate.",
  deferred: "Plaćate po dogovorenom roku za odloženo plaćanje.",
};

export const PREFERRED_CHANNEL_LABEL = {
  phone: "Telefonom",
  viber: "Viber",
  whatsapp: "WhatsApp",
  email: "E-poštom",
} as const;

/**
 * Glossary (COPY-09, DESIGN-SYSTEM §11.4): one term per concept in every form string.
 * The medium and the field label are „e-pošta“; in a sentence the value is „adresa e-pošte“;
 * catalog items are „artikli“.
 */
export const TERMS = {
  /** Field label („E-pošta“). */
  email: "E-pošta",
  /** Nominative in a sentence („Adresa e-pošte nije ispravna.“). */
  emailAddress: "adresa e-pošte",
  /** Accusative („Upišite adresu e-pošte.“). */
  emailAddressAcc: "adresu e-pošte",
  /** Catalog items (lists, search groups, headings). */
  items: "Artikli",
} as const;

export const ERRORS = {
  required: (what: string) => `Upišite ${what}.`,
  phone: "Broj telefona nije ispravan. Primer: 064 123 4567.",
  email: "Adresa e-pošte nije ispravna. Primer: ime@primer.rs.",
  emailRequired: `Upišite ${TERMS.emailAddressAcc}.`,
  /** PIB: empty, wrong number of digits, or the check digit does not match (FLOW-09). */
  pib: {
    required: "Upišite PIB.",
    length: "PIB ima 9 cifara.",
    checksum: "PIB nije ispravan — kontrolna cifra ne odgovara. Proverite broj sa rešenja.",
  },
  mb: {
    required: "Upišite matični broj.",
    length: "Matični broj ima 8 cifara.",
    checksum:
      "Matični broj nije ispravan — kontrolna cifra ne odgovara. Proverite broj sa rešenja.",
  },
  passwordIsEmail: `Lozinka ne sme biti ista kao ${TERMS.emailAddress}.`,
  vin: "Broj šasije ima 17 znakova (bez slova I, O i Q).",
  postalCode: "Poštanski broj ima 5 cifara.",
  rateLimit: "Previše pokušaja. Pokušajte ponovo za nekoliko minuta ili nas pozovite.",
  network: "Nema veze — pokušavamo ponovo.",
  server: "Nešto nije u redu na našoj strani. Pokušajte ponovo; porudžbina nije poslata.",
  /** Photo rejected before upload (FLOW-27): say which file and why. */
  uploadType: (fileName: string) => `${fileName} nije fotografija (JPG, PNG ili WebP).`,
  uploadSize: (fileName: string, sizeMb: string) =>
    `${fileName} ima ${sizeMb} MB — najviše 8 MB po fotografiji.`,
  upload: "Fotografija nije učitana. Pokušajte ponovo.",
  quoteExpired: (at: number) => `Ponuda je istekla ${formatDate(at)}`,
} as const;

/** Serbian message from a ConvexError payload, or a fallback. */
export function convexErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** Error code from a ConvexError payload (`RATE_LIMITED`, `OUT_OF_STOCK`, …). */
export function convexErrorCode(error: unknown): string | null {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "code" in data) {
    const code = (data as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Field path from a ConvexError INVALID payload (`contact.email`). */
export function convexErrorField(error: unknown): string | null {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "field" in data) {
    const field = (data as { field?: unknown }).field;
    return typeof field === "string" ? field : null;
  }
  return null;
}
