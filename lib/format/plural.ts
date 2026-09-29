/**
 * Serbian plural forms (CLDR rules for `sr`): one (1, 21, 31 … but not 11), few (2–4, 22–24 …
 * but not 12–14), other. `pluralSr(3, ["broj", "broja", "brojeva"])` → „broja“.
 */
export function pluralSr(
  count: number,
  forms: readonly [one: string, few: string, other: string],
): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** `countSr(3, ["artikal", "artikla", "artikala"])` → „3 artikla“ (no-break space). */
export function countSr(
  count: number,
  forms: readonly [one: string, few: string, other: string],
): string {
  return `${count} ${pluralSr(count, forms)}`;
}
