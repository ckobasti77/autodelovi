/**
 * Inquiry / quote and mechanic-profile status machines (docs/DATA-MODEL.md §C7). Pure.
 */

export const INQUIRY_STATUSES = [
  "nov",
  "u_obradi",
  "ponuda_poslata",
  "prihvacena",
  "odbijena",
  "istekla",
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

const INQUIRY_TRANSITIONS: Readonly<Record<InquiryStatus, readonly InquiryStatus[]>> = {
  nov: ["u_obradi", "ponuda_poslata", "odbijena"],
  u_obradi: ["ponuda_poslata", "odbijena"],
  // Staff may send a revised quote (new version) while the previous one is out.
  ponuda_poslata: ["ponuda_poslata", "prihvacena", "odbijena", "istekla"],
  istekla: ["u_obradi", "ponuda_poslata", "odbijena"],
  prihvacena: [],
  odbijena: [],
};

export const OPEN_INQUIRY_STATUSES: readonly InquiryStatus[] = [
  "nov",
  "u_obradi",
  "ponuda_poslata",
];

export function canTransitionInquiry(from: InquiryStatus, to: InquiryStatus): boolean {
  return INQUIRY_TRANSITIONS[from].includes(to);
}

export function nextInquiryStatuses(from: InquiryStatus): InquiryStatus[] {
  return [...INQUIRY_TRANSITIONS[from]];
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "superseded";

export type QuoteAcceptCheck =
  | { ok: true }
  | { ok: false; error: "not_sent" | "expired" | "superseded" | "already_accepted" | "declined" };

/** The customer may accept only the current, sent, unexpired quote. */
export function checkQuoteAccept(
  quote: { status: QuoteStatus; validUntil: number },
  now: number,
): QuoteAcceptCheck {
  switch (quote.status) {
    case "accepted":
      return { ok: false, error: "already_accepted" };
    case "declined":
      return { ok: false, error: "declined" };
    case "superseded":
      return { ok: false, error: "superseded" };
    case "expired":
      return { ok: false, error: "expired" };
    case "draft":
      return { ok: false, error: "not_sent" };
    case "sent":
      return now > quote.validUntil ? { ok: false, error: "expired" } : { ok: true };
  }
}

export const QUOTE_ACCEPT_ERRORS_SR: Readonly<
  Record<Exclude<QuoteAcceptCheck, { ok: true }>["error"], string>
> = {
  not_sent: "Ponuda još nije poslata.",
  expired: "Ponuda je istekla. Zatražite obnovljenu ponudu.",
  superseded: "Ova ponuda je zamenjena novom.",
  already_accepted: "Ponuda je već prihvaćena.",
  declined: "Ponuda je odbijena.",
};

// Mechanic profiles ---------------------------------------------------------------------

export const MECHANIC_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type MechanicStatus = (typeof MECHANIC_STATUSES)[number];

const MECHANIC_TRANSITIONS: Readonly<Record<MechanicStatus, readonly MechanicStatus[]>> = {
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  suspended: ["approved"],
  rejected: ["pending"],
};

export function canTransitionMechanic(from: MechanicStatus, to: MechanicStatus): boolean {
  return MECHANIC_TRANSITIONS[from].includes(to);
}
