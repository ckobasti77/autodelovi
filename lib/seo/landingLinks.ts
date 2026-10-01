/**
 * Internal links to programmatic landings (SEO-ADS §J5): URL and anchor text from a landing
 * link row (`seo.categoryLandings` / `vehicleLandings` / `productLandings` / `landing`).
 */
import { accusativeSr, shortBrandName } from "@/lib/seo/templates";

export type LandingLinkData = {
  categorySlug: string;
  categoryName: string;
  brandSlug: string;
  brandName: string;
  modelSlug: string | null;
  modelName: string | null;
  productCount: number;
  indexable: boolean;
};

export function landingPath(categorySlug: string, brandSlug: string, modelSlug?: string | null) {
  return `/delovi/${categorySlug}/${brandSlug}${modelSlug ? `/${modelSlug}` : ""}`;
}

export const landingHref = (l: LandingLinkData) =>
  landingPath(l.categorySlug, l.brandSlug, l.modelSlug);

/** Vehicle part of the anchor: „VW Golf“ / „Škoda“. */
export const landingVehicle = (l: Pick<LandingLinkData, "brandName" | "modelName">) =>
  l.modelName ? `${shortBrandName(l.brandName)} ${l.modelName}` : l.brandName;

/** Full descriptive anchor: „Kočione pločice za VW Golf“, „… za Škodu Octaviju“ (COPY-05). */
export const landingLabel = (l: LandingLinkData) =>
  `${l.categoryName} za ${accusativeSr(landingVehicle(l))}`;
