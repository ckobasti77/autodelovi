/**
 * Number formatting for Serbian Latin (`sr-Latn-RS`): dot for grouping, comma for decimals.
 *
 * Decisions:
 * - Grouping is always on (`useGrouping: "always"`), so 4-digit values group too (`4.290`).
 * - Negative values use the real minus sign U+2212 (`−1.250`), not the hyphen Intl emits,
 *   so the sign never looks like a dash or breaks a line differently across engines.
 * - Non-finite input throws a RangeError — a NaN price or quantity is a bug, not a display case.
 * - No Intl (PERF-01): the first Intl formatter a page builds initialises ICU (~30 ms of a
 *   throttled phone's main thread), and prices and quantities are formatted while every
 *   listing page hydrates. The digits are produced here with the exact output of
 *   `Intl.NumberFormat("sr-Latn-RS", { useGrouping: "always", minimumFractionDigits,
 *   maximumFractionDigits })`: rounding half away from zero on the shortest decimal form of the
 *   number, as ICU does (`1.005` → `1,01`). tests/unit/format/number.test.ts checks parity.
 */

export const LOCALE = "sr-Latn-RS";

/** U+00A0 NO-BREAK SPACE. */
export const NBSP = "\u00a0";

/** U+2212 MINUS SIGN. */
export const MINUS = "\u2212";

export function assertFinite(value: number, what = "value"): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`Expected a finite number for ${what}, got ${String(value)}`);
  }
}

/** Shortest decimal form of a non-negative finite number as plain digits (no exponent). */
function plainDigits(magnitude: number): { whole: string; fraction: string } {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(magnitude));
  if (!match) throw new RangeError(`Cannot format ${String(magnitude)}`);
  const [, intPart, fracPart = "", expPart] = match;
  const digits = intPart + fracPart;
  const point = intPart.length + Number(expPart ?? 0);
  const whole = point <= 0 ? "0" : digits.slice(0, point).padEnd(point, "0");
  const fraction = point <= 0 ? "0".repeat(-point) + digits : digits.slice(point);
  return { whole: whole.replace(/^0+(?=\d)/, ""), fraction };
}

/** Rounds the decimal `whole.fraction` to `decimals` places, half away from zero. */
function roundDecimal(
  whole: string,
  fraction: string,
  decimals: number,
): { whole: string; fraction: string } {
  if (fraction.length <= decimals) return { whole, fraction };
  const kept = fraction.slice(0, decimals);
  if (fraction.charAt(decimals) < "5") return { whole, fraction: kept };
  const digits = (whole + kept).split("");
  let i = digits.length - 1;
  while (i >= 0 && digits[i] === "9") digits[i--] = "0";
  if (i < 0) digits.unshift("1");
  else digits[i] = String(Number(digits[i]) + 1);
  const all = digits.join("");
  return {
    whole: all.slice(0, all.length - decimals),
    fraction: all.slice(all.length - decimals),
  };
}

/**
 * Formats a non-negative magnitude and prefixes U+2212 when `negative`. Values that round to
 * zero never carry a sign (`-0.001` with 2 decimals → `0`).
 */
export function formatSigned(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number,
): string {
  const { whole, fraction } = plainDigits(Math.abs(value));
  const rounded = roundDecimal(whole, fraction, maxFractionDigits);
  let decimals = rounded.fraction;
  while (decimals.length > minFractionDigits && decimals.endsWith("0")) {
    decimals = decimals.slice(0, -1);
  }
  decimals = decimals.padEnd(minFractionDigits, "0");
  const grouped = rounded.whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const magnitude = decimals ? `${grouped},${decimals}` : grouped;
  const isZero = /^[0.,]*$/.test(magnitude);
  return value < 0 && !isZero ? `${MINUS}${magnitude}` : magnitude;
}

export type FormatNumberOptions = {
  /** Exact number of decimals. Default: 0–2 decimals, trailing zeros dropped. */
  decimals?: number;
};

/** `1250` → `1.250`, `1250.5` → `1.250,5`, `{ decimals: 2 }` → `1.250,50`. */
export function formatNumber(value: number, opts: FormatNumberOptions = {}): string {
  assertFinite(value);
  if (opts.decimals !== undefined) {
    const decimals = clampDecimals(opts.decimals);
    return formatSigned(value, decimals, decimals);
  }
  return formatSigned(value, 0, 2);
}

export type FormatPercentOptions = {
  /** Maximum decimals of the percentage (default 1): 0.155 → `15,5 %`. */
  decimals?: number;
};

/** Ratio → percent with a no-break space before the sign: `0.15` → `15 %`. */
export function formatPercent(ratio: number, opts: FormatPercentOptions = {}): string {
  assertFinite(ratio, "ratio");
  const decimals = clampDecimals(opts.decimals ?? 1);
  // Round in decimal space first so 0.15 * 100 = 15.000000000000002 does not leak through.
  const percent = Number((ratio * 100).toFixed(decimals + 2));
  return `${formatSigned(percent, 0, decimals)}${NBSP}%`;
}

/** Piece count: `4` → `4 kom.` (no-break space). */
export function formatQuantity(count: number): string {
  assertFinite(count, "count");
  return `${formatSigned(count, 0, 2)}${NBSP}kom.`;
}

function clampDecimals(decimals: number): number {
  assertFinite(decimals, "decimals");
  return Math.min(20, Math.max(0, Math.trunc(decimals)));
}
