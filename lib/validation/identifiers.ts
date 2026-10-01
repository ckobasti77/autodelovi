/**
 * Field-level problem messages shared by the zod schemas and the plain forms (sign-up, reset,
 * back-in-stock) — no zod here, so the plain forms stay light.
 *
 * PIB / MB messages by case (FLOW-09): empty → „Upišite …“, wrong number of digits → the
 * length rule, right length but a failed check digit → the checksum message. One function per
 * identifier so the checkout and the mechanic registration schemas say exactly the same thing.
 */
import {
  isValidEmail,
  isValidMb,
  isValidPib,
  normalizeEmail,
  normalizeMb,
  normalizePib,
} from "@/lib/domain/identifiers";
import { ERRORS } from "@/lib/i18n/sr/shop";

/** Problem with a PIB, or null when it is valid. */
export function pibProblem(input: string): string | null {
  const pib = normalizePib(input.trim());
  if (!pib) return ERRORS.pib.required;
  if (!/^\d{9}$/.test(pib)) return ERRORS.pib.length;
  return isValidPib(pib) ? null : ERRORS.pib.checksum;
}

/** Problem with a matični broj, or null when it is valid. */
export function mbProblem(input: string): string | null {
  const mb = normalizeMb(input.trim());
  if (!mb) return ERRORS.mb.required;
  if (!/^\d{8}$/.test(mb)) return ERRORS.mb.length;
  return isValidMb(mb) ? null : ERRORS.mb.checksum;
}

/** Password rules (SECURITY §D1); `email` → the password may not repeat the account address. */
export function passwordProblem(password: string, email?: string): string | null {
  if (!password) return ERRORS.required("lozinku");
  if (password.length < 10) return "Lozinka mora imati najmanje 10 znakova.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password))
    return "Lozinka mora sadržati bar jedno slovo i jednu cifru.";
  if (email && normalizeEmail(password) === normalizeEmail(email)) return ERRORS.passwordIsEmail;
  return null;
}

/** Required first, then the format (COPY-13): an empty field is not „invalid“. */
export function emailProblem(email: string): string | null {
  const value = email.trim();
  if (!value) return ERRORS.emailRequired;
  return isValidEmail(normalizeEmail(value)) ? null : ERRORS.email;
}
