/**
 * Serbian company identifiers and document numbers (docs/ARCHITECTURE.md §E9). Pure.
 *
 * - PIB: 9 digits, ISO 7064 MOD 11,10 check digit.
 * - MB (matični broj pravnog lica): 8 digits, weights 2,7,6,5,4,3,2 on digits 1–7,
 *   k = 11 − (sum mod 11), k > 9 → 0, must equal digit 8.
 * - Order / inquiry numbers: `<PREFIX>-<YEAR>-<6-digit seq>` (`SK-2026-000123`).
 */

/** ISO 7064 MOD 11,10 over the first 8 digits; returns the expected 9th digit. */
export function pibCheckDigit(first8: string): number {
  let s = 10;
  for (const ch of first8) {
    s = (s + Number(ch)) % 10;
    s = ((s === 0 ? 10 : s) * 2) % 11;
  }
  return (11 - s) % 10;
}

export function normalizePib(input: string): string {
  return input.replace(/[\s.\-]/g, "");
}

export function isValidPib(input: string): boolean {
  const pib = normalizePib(input);
  if (!/^\d{9}$/.test(pib)) return false;
  // 100000001 … 999999999: PIBs never start with 0.
  if (pib.startsWith("0")) return false;
  return pibCheckDigit(pib.slice(0, 8)) === Number(pib[8]);
}

const MB_WEIGHTS = [2, 7, 6, 5, 4, 3, 2];

export function mbCheckDigit(first7: string): number {
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * MB_WEIGHTS[i];
  const k = 11 - (sum % 11);
  return k > 9 ? 0 : k;
}

export function normalizeMb(input: string): string {
  return input.replace(/[\s.\-]/g, "");
}

export function isValidMb(input: string): boolean {
  const mb = normalizeMb(input);
  if (!/^\d{8}$/.test(mb)) return false;
  return mbCheckDigit(mb.slice(0, 7)) === Number(mb[7]);
}

export function isValidPostalCode(input: string): boolean {
  return /^\d{5}$/.test(input.trim());
}

/** Pragmatic e-mail check (the address is confirmed by the customer's reply anyway). */
export function isValidEmail(input: string): boolean {
  const email = input.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function formatDocumentNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

/** „Poziv na broj“ for bank transfers: model 97-free reference = the digits of the number. */
export function paymentReference(documentNumber: string): string {
  return documentNumber.replace(/\D/g, "");
}
