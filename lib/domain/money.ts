/**
 * Intl-free money formatting for server contexts that may lack ICU data (Convex runtime,
 * e-mail text). Same output as `lib/format/money` `formatRSD`: `12.990 RSD`, `12.990,50 RSD`
 * with a no-break space before the unit and U+2212 for negatives.
 */
const NBSP = "\u00a0";
const MINUS = "\u2212";

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatRsdPlain(para: number): string {
  const rounded = Math.round(para);
  const magnitude = Math.abs(rounded);
  let value = group(Math.floor(magnitude / 100));
  const cents = magnitude % 100;
  if (cents !== 0) value += `,${String(cents).padStart(2, "0")}`;
  return `${rounded < 0 ? MINUS : ""}${value}${NBSP}RSD`;
}
