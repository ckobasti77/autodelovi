/**
 * Descriptive product image URLs (image SEO): Convex storage URLs are opaque, so product
 * photos are also served as `/slike/deo/<slug>-<n>-<v>.<ext>` by a caching route handler.
 * `<v>` is taken from the storage id, so a replaced photo gets a new URL (immutable caching)
 * and a stale link never shows a different photo. Pure — shared by Convex and Next.
 */

export const PRODUCT_IMAGE_PREFIX = "/slike/deo/";

const EXT_BY_TYPE: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Version token of a storage id (last 6 alphanumerics, lowercase). */
export function imageToken(storageId: string): string {
  return storageId
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toLowerCase();
}

/** `/slike/deo/kocioni-disk-brembo-09-a820-11-1-k3x9qa.jpg` (1-based index). */
export function productImagePath(
  slug: string,
  index: number,
  storageId: string,
  contentType?: string | null,
): string {
  const ext = (contentType && EXT_BY_TYPE[contentType]) || "jpg";
  return `${PRODUCT_IMAGE_PREFIX}${slug}-${index}-${imageToken(storageId)}.${ext}`;
}

export type ParsedImageFile = { slug: string; index: number; token: string; ext: string };

/** Parses the file segment of a product image URL; null for anything else. */
export function parseProductImageFile(file: string): ParsedImageFile | null {
  const m = /^([a-z0-9][a-z0-9-]{0,118}[a-z0-9])-(\d{1,2})-([a-z0-9]{1,6})\.(jpg|png|webp)$/.exec(
    file,
  );
  if (!m) return null;
  const index = Number(m[2]);
  if (index < 1 || index > 12) return null;
  return { slug: m[1]!, index, token: m[3]!, ext: m[4]! };
}

/**
 * Serbian alt text for a product photo: the stored alt when it is meaningful, otherwise
 * „{naziv} — {proizvođač}, OEM {broj}“ (+ „, slika n“ after the first).
 */
export function productImageAlt(input: {
  alt?: string | null;
  name: string;
  manufacturer: string;
  oem?: string | null;
  index: number;
}): string {
  const stored = input.alt?.trim();
  if (stored && stored.length >= 8 && !/\.(jpe?g|png|webp|gif)$/i.test(stored)) return stored;
  const base = `${input.name} — ${input.manufacturer}${input.oem ? `, OEM ${input.oem}` : ""}`;
  return input.index > 1 ? `${base}, slika ${input.index}` : base;
}
