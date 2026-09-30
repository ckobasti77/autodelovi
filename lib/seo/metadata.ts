/**
 * Page metadata builder (SEO-ADS §J1, ROUTES §B4): keyword-first titles with the settings
 * suffix (≤ 60 characters in total), descriptions ≤ 155 characters, absolute canonicals
 * without tracking parameters, robots per route rule, OpenGraph/Twitter from the same values.
 * OG images come from the `opengraph-image` file conventions (default, product, category,
 * landing) unless a page passes one explicitly.
 */
import type { Metadata } from "next";

import { site } from "@/config/site";

export type PageMetaInput = {
  title: string;
  description: string;
  /** Canonical path (no host), e.g. `/delovi/kocioni-diskovi`. */
  path: string;
  /** `noindex, follow` (the page stays crawlable so the directive is seen). */
  noindex?: boolean;
  /** Title suffix from settings (`" | SKLOP"`); defaults to the config brand. */
  titleSuffix?: string;
  ogImage?: { url: string; width: number; height: number; alt: string };
  /** The title already carries (or deliberately drops) the suffix — used as is (≤ 60). */
  titleIsFinal?: boolean;
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

export function defaultTitleSuffix(): string {
  return ` | ${site.brand.name}`;
}

/**
 * Keyword-first title with the brand suffix. When the suffix would push the title past
 * 60 characters, the keyword part is shortened first; a keyword part that cannot fit in 20
 * characters drops the suffix instead of losing its meaning.
 */
export function pageTitle(title: string, suffix: string = defaultTitleSuffix()): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length + suffix.length <= TITLE_MAX) return `${clean}${suffix}`;
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
    : pageTitle(input.title, input.titleSuffix);
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
