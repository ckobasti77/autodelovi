/**
 * Model year from VIN position 10. The code repeats every 30 years (A = 1980 / 2010,
 * 1 = 2001 / 2031), so it is a hint that needs a reference date to resolve.
 * Letters I, O, Q, U, Z and the digit 0 are never used.
 */
import { normalizeVin } from "./validate";

const LETTER_CODES = "ABCDEFGHJKLMNPRSTVWXY"; // 1980 … 2000
const DIGIT_CODES = "123456789"; // 2001 … 2009
const CYCLE = 30;

/** First (1980–2009) year of each position-10 code. */
export const MODEL_YEAR_BASE: Readonly<Record<string, number>> = Object.fromEntries([
  ...[...LETTER_CODES].map((code, i) => [code, 1980 + i] as const),
  ...[...DIGIT_CODES].map((code, i) => [code, 2001 + i] as const),
]);

/** Both years a position-10 code can mean, oldest first: `F` → [1985, 2015]. */
export function modelYearCandidates(vin: string): number[] {
  const code = normalizeVin(vin).charAt(9);
  const base = code ? MODEL_YEAR_BASE[code] : undefined;
  return base === undefined ? [] : [base, base + CYCLE];
}

export type DecodeModelYearOptions = {
  /** Reference date (default: now). Candidates later than its year + 1 are discarded. */
  now?: Date;
};

/**
 * The most recent candidate not later than the reference year + 1 (a 2027 model can be
 * sold in 2026), or `null` for a missing / invalid code.
 */
export function decodeModelYear(vin: string, opts: DecodeModelYearOptions = {}): number | null {
  const latest = (opts.now ?? new Date()).getUTCFullYear() + 1;
  const candidates = modelYearCandidates(vin).filter((year) => year <= latest);
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}
