/**
 * Phone numbers: normalisation to E.164, display grouping and link builders.
 *
 * Serbian numbers (+381) are validated pragmatically:
 * - mobile: `6X` + 6–7 digits (060–069),
 * - landline: 2-digit area code 10–39 + 6–7 digits, or a 3-digit area code
 *   (230, 280, 290, 390) + 5–6 digits — i.e. an 8–9 digit national number starting with 1–3.
 * Accepted input shapes: `064 123 4567`, `064/123-4567`, `+381 64 123 4567`, `00381641234567`,
 * `381641234567`, `0641234567`, `64 123 4567`, `011 123 4567`, `(011) 123-45-67`,
 * `+381 (0) 64 1234567`, `+381 064 123 4567`.
 *
 * Foreign numbers written with `+` (or `00`) and 8–15 digits pass through cleaned.
 */
const NBSP = "\u00a0";

const SERBIA = "381";

/** 3-digit Serbian area codes; every other landline code is 2 digits (10–39). */
const THREE_DIGIT_AREA_CODES = new Set(["230", "280", "290", "390"]);

/**
 * ITU-T E.164 country codes that are 2 digits long; `1` and `7` are 1 digit, all other
 * assigned codes are 3 digits. Used only to put a space after the country code.
 */
const TWO_DIGIT_COUNTRY_CODES = new Set(
  (
    "20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 " +
    "60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98"
  ).split(" "),
);

const ALLOWED_CHARS = /^\+?[\d\s\u00a0\u202f()./-]+$/;

function isSerbianNationalNumber(nsn: string): boolean {
  return /^6\d{7,8}$/.test(nsn) || /^[1-3]\d{7,8}$/.test(nsn);
}

/**
 * Normalises a phone number to E.164 (`+381641234567`). Returns `null` for empty or invalid
 * input so callers can hide the channel.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  // Drop the „(0)“ trunk hint people write after the country code: +381 (0) 64 …
  const text = input.trim().replace(/\(\s*0\s*\)/g, " ");
  if (!text || !ALLOWED_CHARS.test(text)) return null;

  const hasPlus = text.startsWith("+");
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;

  let international: string | null = null;
  let national: string | null = null;
  if (hasPlus) international = digits;
  else if (digits.startsWith("00")) international = digits.slice(2);
  else if (digits.startsWith(SERBIA) && (digits.length === 11 || digits.length === 12)) {
    international = digits;
  } else if (digits.startsWith("0")) national = digits.slice(1);
  else if (/^6\d{7,8}$/.test(digits)) national = digits; // mobile typed without the 0

  if (international !== null) {
    if (international.startsWith(SERBIA)) {
      // Tolerate a stray trunk zero: +381 064 …
      national = international.slice(SERBIA.length).replace(/^0/, "");
    } else {
      return /^[1-9]\d{7,14}$/.test(international) ? `+${international}` : null;
    }
  }

  if (national === null || !isSerbianNationalNumber(national)) return null;
  return `+${SERBIA}${national}`;
}

function groupSubscriber(subscriber: string): string[] {
  return subscriber.length > 3 ? [subscriber.slice(0, 3), subscriber.slice(3)] : [subscriber];
}

/**
 * Display form with no-break spaces (U+00A0) so a number never wraps:
 * `+381 64 123 4567`, `+381 63 123 456`, `+381 11 123 4567`, `+381 230 123 45`.
 * Foreign numbers get a space after the country code only (`+49 15112345678`).
 * Input that cannot be normalised is returned trimmed, unchanged.
 */
export function formatPhone(e164: string): string {
  const normalized = normalizePhone(e164);
  if (!normalized) return e164.trim();
  const digits = normalized.slice(1);

  if (digits.startsWith(SERBIA)) {
    const national = digits.slice(SERBIA.length);
    const areaLength =
      !national.startsWith("6") && THREE_DIGIT_AREA_CODES.has(national.slice(0, 3)) ? 3 : 2;
    const groups = [
      `+${SERBIA}`,
      national.slice(0, areaLength),
      ...groupSubscriber(national.slice(areaLength)),
    ];
    return groups.join(NBSP);
  }

  const ccLength =
    digits.startsWith("1") || digits.startsWith("7")
      ? 1
      : TWO_DIGIT_COUNTRY_CODES.has(digits.slice(0, 2))
        ? 2
        : 3;
  return `+${digits.slice(0, ccLength)}${NBSP}${digits.slice(ccLength)}`;
}

/** Digits of an E.164 number without the plus. */
function e164Digits(e164: string): string {
  return (normalizePhone(e164) ?? e164).replace(/\D/g, "");
}

/** `tel:+381641234567` */
export function telHref(e164: string): string {
  return `tel:+${e164Digits(e164)}`;
}

/** `viber://chat?number=%2B381641234567` */
export function viberHref(e164: string): string {
  return `viber://chat?number=${encodeURIComponent(`+${e164Digits(e164)}`)}`;
}

/** `https://wa.me/381641234567`, with `?text=` (URL-encoded) when a message is given. */
export function whatsappHref(e164: string, text?: string): string {
  const base = `https://wa.me/${e164Digits(e164)}`;
  return text && text.trim() ? `${base}?text=${encodeURIComponent(text)}` : base;
}
