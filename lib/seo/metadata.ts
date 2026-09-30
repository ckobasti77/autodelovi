/**
 * Page metadata builder (SEO-ADS §J1, ROUTES §B4): keyword-first titles with the settings
 * suffix, absolute canonicals without tracking parameters, robots per route rule. Step 19
 * extends it (OG images per template); the call sites stay the same.
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
  type?: "website" | "article";
};

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/** Trims at a word boundary with an ellipsis. */
export function clampText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}

export function pageTitle(title: string, suffix = ` | ${site.brand.name}`): string {
  const room = Math.max(20, TITLE_MAX - suffix.length);
  return `${clampText(title, room)}${suffix}`;
}

export function buildMetadata(input: PageMetaInput): Metadata {
  const title = pageTitle(input.title, input.titleSuffix);
  const description = clampText(input.description, DESCRIPTION_MAX);
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
      ...(input.ogImage ? { images: [input.ogImage] } : {}),
    },
    twitter: { card: input.ogImage ? "summary_large_image" : "summary", title, description },
  };
}

/** Private pages (cart, checkout, account, tokens): never indexed, links still followed. */
export function privateMetadata(title: string): Metadata {
  return { title: { absolute: pageTitle(title) }, robots: { index: false, follow: true } };
}
