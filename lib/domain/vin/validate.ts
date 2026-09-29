/**
 * VIN (ISO 3779) validation. A VIN is 17 characters of A–Z / 0–9 without I, O and Q.
 *
 * The position-9 check digit (North-American transliteration and weights) is computed and
 * reported, but never fails validation: European VAG VINs usually carry `Z` or another
 * filler there. It is marked `applicable` only for North-American WMIs (first char 1–5).
 */

export const VIN_LENGTH = 17;

const VIN_CHAR = /^[A-HJ-NPR-Z0-9]$/;

// prettier-ignore
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;

export type VinError = "empty" | "length" | "chars";

export type VinValidation = {
  valid: boolean;
  normalized: string;
  errors: VinError[];
  /** Distinct forbidden characters in order of appearance. */
  invalidChars: string[];
  /** Present when I/O/Q were typed and swapping them (O,Q → 0, I → 1) yields a valid VIN. */
  suggestion?: string;
  checkDigit: {
    /** True only for North-American VINs (WMI starting 1–5), where the digit is mandatory. */
    applicable: boolean;
    /** `null` when the VIN is too malformed to compute it. */
    valid: boolean | null;
  };
};

/** Uppercase; strips spaces (incl. NBSP), dashes and dots. */
export function normalizeVin(input: string): string {
  return input.toUpperCase().replace(/[\s.\-\u2010-\u2015\u2212]/g, "");
}

function isVinChars(vin: string): boolean {
  return [...vin].every((char) => VIN_CHAR.test(char));
}

/** Expected check character (`0`–`9` or `X`) for a 17-char VIN, or `null` if it cannot be computed. */
export function computeVinCheckDigit(input: string): string | null {
  const vin = normalizeVin(input);
  if (vin.length !== VIN_LENGTH || !isVinChars(vin)) return null;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const char = vin.charAt(i);
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char];
    sum += value * WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function validateVin(input: string): VinValidation {
  const normalized = normalizeVin(input);
  const errors: VinError[] = [];
  const invalidChars: string[] = [];

  if (!normalized) errors.push("empty");
  else if (normalized.length !== VIN_LENGTH) errors.push("length");

  for (const char of normalized) {
    if (!VIN_CHAR.test(char) && !invalidChars.includes(char)) invalidChars.push(char);
  }
  if (invalidChars.length > 0) errors.push("chars");

  let suggestion: string | undefined;
  if (/[IOQ]/.test(normalized)) {
    const swapped = normalized.replace(/[OQ]/g, "0").replace(/I/g, "1");
    if (swapped.length === VIN_LENGTH && isVinChars(swapped)) suggestion = swapped;
  }

  const expected = computeVinCheckDigit(normalized);
  const result: VinValidation = {
    valid: errors.length === 0,
    normalized,
    errors,
    invalidChars,
    checkDigit: {
      applicable: /^[1-5]/.test(normalized),
      valid: expected === null ? null : normalized.charAt(8) === expected,
    },
  };
  if (suggestion) result.suggestion = suggestion;
  return result;
}
