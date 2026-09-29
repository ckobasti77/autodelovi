/**
 * Money is stored as integer **para** (1 dinar = 100 para, docs/DECISIONS.md D5) and shown as
 * `12.990 RSD` / `12.990,50 RSD`: dot grouping, decimals only when the amount has para, and a
 * no-break space (U+00A0) before the unit so the amount never wraps away from „RSD“.
 *
 * Negative amounts use the real minus sign U+2212 (`−1.500 RSD`), same as `lib/format/number`.
 */
import { assertFinite, LOCALE, MINUS, NBSP } from "./number";

export const CURRENCY_UNIT = "RSD" as const;

const integerFormat = new Intl.NumberFormat(LOCALE, {
  useGrouping: "always",
  maximumFractionDigits: 0,
});

export type MoneyParts = {
  /** Signed, grouped amount without the unit: `12.990`, `12.990,50`, `−1.500`. */
  value: string;
  unit: typeof CURRENCY_UNIT;
};

/** Split form for a Price component that styles the amount and the unit separately. */
export function formatRSDParts(para: number): MoneyParts {
  assertFinite(para, "para");
  const rounded = Math.round(para);
  const magnitude = Math.abs(rounded);
  const dinars = Math.floor(magnitude / 100);
  const cents = magnitude % 100;
  let value = integerFormat.format(dinars);
  if (cents !== 0) value += `,${String(cents).padStart(2, "0")}`;
  if (rounded < 0) value = `${MINUS}${value}`;
  return { value, unit: CURRENCY_UNIT };
}

export type FormatRSDOptions = {
  /** `false` → amount only (`12.990`). Default `true`. */
  unit?: boolean;
};

/** `1299000` → `12.990 RSD`, `1299050` → `12.990,50 RSD` (U+00A0 before the unit). */
export function formatRSD(para: number, opts: FormatRSDOptions = {}): string {
  const { value, unit } = formatRSDParts(para);
  return opts.unit === false ? value : `${value}${NBSP}${unit}`;
}

/** Para → dinars as a plain number (for analytics / feeds that want `12990.5`). */
export function paraToDinars(para: number): number {
  assertFinite(para, "para");
  return Math.round(para) / 100;
}

/**
 * Dinars → integer para, rounding half away from zero on the exact decimal digits.
 *
 * Accepts numbers and the strings Serbian users actually type:
 * `"12.990,50"`, `"12990.50"`, `"12990,5"`, `"12 990"`, `"12.990"`, `"1,234.56"`,
 * `"12.990 RSD"`, `"12.990 din."`, `"-150"`, `"−150"`.
 *
 * Separator rules:
 * - both `.` and `,` present → the last one is the decimal separator, the other groups;
 * - only one kind, several times → grouping (`1.234.567`);
 * - only one kind, once, followed by exactly 3 digits and preceded by 1–3 digits not
 *   starting with 0 → grouping (`12.990` = 12 990 dinars — money never has 3 decimals);
 * - otherwise it is the decimal separator (`12,5`, `12.99`, `0.125`).
 *
 * Throws a RangeError for anything else (empty, letters, malformed grouping).
 */
export function dinarsToPara(input: number | string): number {
  if (typeof input === "number") {
    assertFinite(input, "dinars");
    const text = String(Math.abs(input));
    if (/e/i.test(text)) return signed(input < 0, Math.round(Math.abs(input) * 100));
    const [whole, fraction = ""] = text.split(".");
    return signed(input < 0, toPara(whole, fraction));
  }
  const parsed = parseDinarString(input);
  if (!parsed) throw new RangeError(`Cannot read an amount from "${input}"`);
  return signed(parsed.negative, toPara(parsed.whole, parsed.fraction));
}

type ParsedAmount = { negative: boolean; whole: string; fraction: string };

function parseDinarString(input: string): ParsedAmount | null {
  let text = input.replace(/(?:rsd|din)\.?/gi, "").replace(/[\s\u00a0\u2007\u2009\u202f']/g, "");
  let negative = false;
  const sign = text.charAt(0);
  if (sign === "-" || sign === MINUS || sign === "+") {
    negative = sign !== "+";
    text = text.slice(1);
  }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const dots = count(text, ".");
  const commas = count(text, ",");

  let groupSep: string | null = null;
  let decimalSep: string | null = null;
  if (dots > 0 && commas > 0) {
    decimalSep = lastDot > lastComma ? "." : ",";
    groupSep = decimalSep === "." ? "," : ".";
    if (count(text, decimalSep) !== 1) return null;
  } else if (dots > 0 || commas > 0) {
    const sep = dots > 0 ? "." : ",";
    const occurrences = dots > 0 ? dots : commas;
    if (occurrences > 1) {
      groupSep = sep;
    } else {
      const [before, after] = text.split(sep);
      const looksGrouped = after.length === 3 && /^[1-9]\d{0,2}$/.test(before);
      if (looksGrouped) groupSep = sep;
      else decimalSep = sep;
    }
  }

  let whole = text;
  let fraction = "";
  if (decimalSep) {
    const at = text.lastIndexOf(decimalSep);
    whole = text.slice(0, at);
    fraction = text.slice(at + 1);
  }
  if (groupSep) {
    const groupPattern = new RegExp(`^\\d{1,3}(?:\\${groupSep}\\d{3})*$`);
    if (!groupPattern.test(whole)) return null;
    whole = whole.split(groupSep).join("");
  }
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === "" && fraction === "") return null;
  return { negative, whole: whole || "0", fraction };
}

/** Exact decimal → para, half away from zero on the third decimal digit. */
function toPara(whole: string, fraction: string): number {
  const cents = Number((fraction + "00").slice(0, 2));
  const roundUp = Number(fraction.charAt(2) || "0") >= 5 ? 1 : 0;
  const para = Number(whole) * 100 + cents + roundUp;
  if (!Number.isSafeInteger(para)) throw new RangeError("Amount is too large");
  return para;
}

function signed(negative: boolean, para: number): number {
  return negative && para !== 0 ? -para : para;
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}
