/**
 * Serbian typographic no-break spaces (U+00A0) for copy and data strings:
 * numbers stay with their units, one-letter words stay with the next word, and a dash
 * never starts a line. Only ordinary spaces/tabs are replaced; line breaks are kept.
 */
const NBSP = "\u00a0";

const UNIT_AFTER_NUMBER = /(\d)[ \t]+(RSD|kom\.?|mm|cm|kg|kW|KS|%|dana|din\.?)(?![\p{L}\p{N}])/gu;

const ONE_LETTER_WORD = /(?<![\p{L}\p{N}_])([iuskoaIUSKOA])[ \t]+(?=\S)/gu;

const SPACED_DASH = /[ \t]+([\u2013\u2014])(?=\s|$)/g;

/** `12.990 RSD` → `12.990\u00a0RSD`; units: RSD, kom., mm, cm, kg, kW, KS, %, dana, din. */
export function nbspUnits(text: string): string {
  return text.replace(UNIT_AFTER_NUMBER, `$1${NBSP}$2`);
}

/** Binds the one-letter words i, u, s, k, o, a (and capitals) to the following word. */
export function nbspShortWords(text: string): string {
  return text.replace(ONE_LETTER_WORD, `$1${NBSP}`);
}

/** `Delovi — odmah` → `Delovi\u00a0— odmah` (also for the en dash), so no line starts with a dash. */
export function noDashAtLineStart(text: string): string {
  return text.replace(SPACED_DASH, `${NBSP}$1`);
}

/** All of the above, in a safe order. */
export function typographer(text: string): string {
  return noDashAtLineStart(nbspShortWords(nbspUnits(text)));
}
