/** Join class names, skipping falsy values. Components keep their own classes conflict-free,
 * so callers pass only layout classes (margin, width, grid placement). */
export function cn(...values: Array<string | false | null | undefined | 0>): string {
  return values.filter(Boolean).join(" ");
}
