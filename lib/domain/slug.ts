/**
 * URL slugs for Serbian content: lowercase ASCII, words joined by single dashes.
 *
 * č/ć → c, š → s, ž → z, đ → dj; Serbian Cyrillic is transliterated (љ → lj, њ → nj,
 * џ → dz, ђ → dj, …); other Latin diacritics are stripped via NFD; `&` becomes „i“.
 * Pure — shared by Next and Convex.
 */

// prettier-ignore
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "dj", е: "e", ж: "z", з: "z", и: "i",
  ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r",
  с: "s", т: "t", ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
};

/** Letters NFD does not decompose into base + combining mark. */
// prettier-ignore
const SPECIAL_LATIN: Record<string, string> = {
  đ: "dj", ß: "ss", æ: "ae", ø: "o", œ: "oe", ł: "l", þ: "th", ð: "d", ı: "i",
};

const CYRILLIC = /[\u0400-\u04ff]/g;
const SPECIAL = /[đßæøœłþðı]/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

export const DEFAULT_SLUG_MAX_LENGTH = 80;

export type SlugOptions = {
  /** Maximum length (default 80); the slug is cut at a dash boundary, never mid-word unless unavoidable. */
  maxLength?: number;
};

export function slugifySr(input: string, opts: SlugOptions = {}): string {
  const maxLength = opts.maxLength ?? DEFAULT_SLUG_MAX_LENGTH;
  const slug = input
    .toLowerCase()
    .replace(CYRILLIC, (char) => CYRILLIC_TO_LATIN[char] ?? " ")
    .replace(SPECIAL, (char) => SPECIAL_LATIN[char] ?? " ")
    .replace(/&/g, " i ")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return truncateSlug(slug, maxLength);
}

function truncateSlug(slug: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  if (slug.charAt(maxLength) === "-") return cut.replace(/-+$/, "");
  const lastDash = cut.lastIndexOf("-");
  // A single word longer than the limit is hard-cut rather than dropped.
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}
