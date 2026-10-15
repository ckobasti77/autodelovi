/**
 * Brand naming rules (DECISIONS D307) — the one place the names are written down. Pure
 * constants, shared by Next (`config/site.ts`) and Convex (settings defaults, e-mail).
 *
 * - `BRAND_NAME` is the brand and the company's trading name: titles, `og:site_name`, JSON-LD
 *   `name`, the From name of e-mails.
 * - `BRAND_ALTERNATE_NAME` is the shop name people know. It is the JSON-LD `alternateName` and
 *   closes SEO titles where there is room; it never replaces the brand name.
 * - `BRAND_LOCKUP_NAME` is what a logo that shows both names says (EUROMOTORS PLUS over OEM
 *   Parts) — its accessible name and alt text, and the manifest `name`.
 *
 * Admin → Podešavanja overrides the name and the alternate name at runtime; the legal name,
 * address and contact data always come from settings.
 */
export const BRAND_NAME = "Euromotors Plus";
export const BRAND_ALTERNATE_NAME = "OEM Parts";
/** Home-screen label (web manifest `short_name`): at most 12 characters are shown. */
export const BRAND_SHORT_NAME = "Euromotors";

/** Separator between the brand name and the alternate name in a title suffix. */
export const TITLE_ALTERNATE_SEPARATOR = " · ";
export const BRAND_LOCKUP_NAME = `${BRAND_NAME}${TITLE_ALTERNATE_SEPARATOR}${BRAND_ALTERNATE_NAME}`;

/** „ | Euromotors Plus · OEM Parts“ — the part after the separator is dropped first when a title is long. */
export function titleSuffixFor(name: string, alternateName?: string | null): string {
  const main = name.trim();
  const alt = alternateName?.trim();
  return ` | ${main}${alt ? `${TITLE_ALTERNATE_SEPARATOR}${alt}` : ""}`;
}

export const DEFAULT_TITLE_SUFFIX = titleSuffixFor(BRAND_NAME, BRAND_ALTERNATE_NAME);

/**
 * The suffix and its shorter form: „ | Euromotors Plus · OEM Parts“ → „ | Euromotors Plus“.
 * A suffix without the separator has no shorter form.
 */
export function titleSuffixTiers(suffix: string): string[] {
  const at = suffix.indexOf(TITLE_ALTERNATE_SEPARATOR);
  if (at <= 0) return [suffix];
  const short = suffix.slice(0, at).trimEnd();
  return short.trim().length > 1 ? [suffix, short] : [suffix];
}
