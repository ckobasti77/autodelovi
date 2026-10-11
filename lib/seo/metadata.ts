/**
 * Page metadata builder (SEO-ADS §J1, ROUTES §B4): keyword-first titles with the settings
 * suffix (≤ 60 characters in total), descriptions ≤ 155 characters, absolute canonicals
 * without tracking parameters, robots per route rule, OpenGraph/Twitter from the same values.
 * OG images come from the `opengraph-image` file conventions (default, product, category,
 * landing) unless a page passes one explicitly.
 */
import type { Metadata } from "next";

import { site } from "@/config/site";
import { titleSuffixFor, titleSuffixTiers } from "@/lib/domain/brand";

export type PageMetaInput = {
  title: string;
  description: string;
  /** Canonical path (no host), e.g. `/delovi/kocioni-diskovi`. */
  path: string;
  /** `noindex, follow` (the page stays crawlable so the directive is seen). */
  noindex?: boolean;
  /** Title suffix from settings (`" | Euromotors Plus · OEM Parts"`); defaults to the config brand. */
  titleSuffix?: string;
  ogImage?: { url: string; width: number; height: number; alt: string };
  /** The title already carries (or deliberately drops) the suffix — used as is (≤ 60). */
  titleIsFinal?: boolean;
  /**
   * The end of `title` that must survive shortening — the vehicle („ za Škodu Octaviju“) or
   * the page number („ — strana 2“). Only the part before it is shortened (D253).
   */
  titleKeep?: string;
  /**
   * The route segment has its own `opengraph-image` file (product, category, landings):
   * no image is set here, because a config image would replace the generated one.
   */
  ogFile?: boolean;
  type?: "website" | "article";
};

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** Trims at a word boundary with an ellipsis (the result is at most `max` characters). */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}

/** „ | Euromotors Plus · OEM Parts“ — brand first, the known shop name after it (D307). */
export function defaultTitleSuffix(): string {
  return titleSuffixFor(site.brand.name, site.brand.alternateName);
}

/** Words a shortened title must not end with („… SEAT i“, „… 312 ×“, „… za“). */
const DANGLING_WORD = /\s+(?:i|ili|a|u|za|sa|od|do|na|po|×|x|[-–—/+&])$/i;

/**
 * Shortens a title fragment to whole words without an ellipsis (titles are labels, not
 * truncated prose): a parenthetical qualifier goes first („Senzori (lambda, parking,
 * temperatura)“ → „Senzori“), then words from the end; trailing punctuation, an unclosed
 * bracket and a dangling conjunction or preposition are removed. May return "" when not
 * even one word fits.
 */
export function shortenWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const bare = clean.replace(/\s*\([^)]*\)/g, "").trim();
  if (bare.length <= max) return bare;
  let cut = bare.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  cut = space > 0 ? cut.slice(0, space) : "";
  for (;;) {
    const next = cut
      .replace(/\s*\([^)]*$/, "")
      .replace(/[\s,.;:]+$/, "")
      .replace(DANGLING_WORD, "");
    if (next === cut) return cut;
    cut = next;
  }
}

/**
 * `title` with the longest form of `suffix` that keeps the whole within 60 characters:
 * „ | Euromotors Plus · OEM Parts“, then „ | Euromotors Plus“. `null` when neither fits.
 */
export function fitTitleSuffix(title: string, suffix: string): string | null {
  for (const tier of titleSuffixTiers(suffix)) {
    if (title.length + tier.length <= TITLE_MAX) return `${title}${tier}`;
  }
  return null;
}

/**
 * Keyword-first title with the brand suffix. The suffix has two forms — the full one with the
 * known shop name („ | Euromotors Plus · OEM Parts“) and the brand alone („ | Euromotors Plus“):
 * the full form is used when the whole title fits in 60 characters, otherwise the short one
 * takes its place, and a title that fits on its own is never cut to make room for either (D308).
 *
 * A title longer than 60 characters is shortened: to make room for the short suffix when that
 * costs at most 18 characters and leaves at least 20, otherwise to 60 without a suffix.
 *
 * With `keep` (the end of the title that carries the vehicle or the page number) the order
 * is the one of D253: drop the suffix, then shorten only the part before `keep` — so
 * „— strana 2“ and the model name are never cut away.
 */
export function pageTitle(
  title: string,
  suffix: string = defaultTitleSuffix(),
  keep?: string,
): string {
  const clean = title.replace(/\s+/g, " ").trim();
  const fitted = fitTitleSuffix(clean, suffix);
  if (fitted) return fitted;
  if (clean.length <= TITLE_MAX) return clean;
  // Too long on its own: only the shortest form of the suffix is still considered.
  const tiers = titleSuffixTiers(suffix);
  suffix = tiers[tiers.length - 1] ?? suffix;
  const k = keep?.replace(/\s+/g, " ").trim();
  if (k && clean.length > k.length && clean.endsWith(k)) {
    const head = clean.slice(0, -k.length);
    const sep = /\s$/.test(head) ? " " : "";
    const short = shortenWords(head, TITLE_MAX - k.length - sep.length);
    if (short) return `${short}${sep}${k}`;
  }
  const room = TITLE_MAX - suffix.length;
  if (room >= 20 && clean.length - room <= 18) return `${clampText(clean, room)}${suffix}`;
  return clampText(clean, TITLE_MAX);
}

export function pageDescription(description: string): string {
  return clampText(description, DESCRIPTION_MAX);
}

/**
 * The site-wide OG image (`app/opengraph-image.tsx`). A page that sets `openGraph` replaces
 * the parent's file-based image, so the default is referenced explicitly — except in segments
 * with their own `opengraph-image` file (`ogFile`), where a config image would win.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${site.brand.name} — delovi za Volkswagen, Audi, Škoda, SEAT i Cupra`,
} as const;

export function buildMetadata(input: PageMetaInput): Metadata {
  const title = input.titleIsFinal
    ? clampText(input.title, TITLE_MAX)
    : pageTitle(input.title, input.titleSuffix, input.titleKeep);
  const description = pageDescription(input.description);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: input.path },
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: input.type ?? "website",
      title,
      description,
      url: input.path,
      siteName: site.brand.name,
      locale: "sr_RS",
      ...(input.ogFile && !input.ogImage ? {} : { images: [input.ogImage ?? DEFAULT_OG_IMAGE] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // Without twitter:image, X/Twitter uses og:image (so segment OG files apply there too).
      ...(input.ogImage ? { images: [input.ogImage.url] } : {}),
    },
  };
}

/** Private pages (cart, checkout, account, tokens): never indexed, links still followed. */
export function privateMetadata(title: string): Metadata {
  return { title: { absolute: pageTitle(title) }, robots: { index: false, follow: true } };
}

/**
 * Capability-token pages (order/inquiry status): private, and no Referer at all, so the
 * token in the URL never reaches another site (SECURITY §L2).
 */
export function tokenPageMetadata(title: string): Metadata {
  return { ...privateMetadata(title), referrer: "no-referrer" };
}
