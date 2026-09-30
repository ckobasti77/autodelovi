import "server-only";

/**
 * The only `unstable_cache` user (ARCHITECTURE §G2, D2): anonymous Convex reads shared by all
 * visitors, with revalidation windows and tags from docs/ROUTES.md §B4. Role-aware prices and
 * live stock arrive later through client subscriptions (LiveOverlay), never through this cache.
 * React `cache` dedupes calls inside one request (metadata + page).
 */
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

import { api } from "@/convex/_generated/api";
import { fetchPublic } from "@/lib/server/convex";

type ListArgs = FunctionArgs<typeof api.catalog.products.listByCategory>;

function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  key: string,
  revalidate: number,
  tags: (...args: A) => string[],
): (...args: A) => Promise<R> {
  return cache((...args: A) =>
    unstable_cache(() => fn(...args), [key, JSON.stringify(args)], {
      revalidate,
      tags: tags(...args),
    })(),
  );
}

export type PublicSettings = FunctionReturnType<typeof api.settings.getPublic>;

export const getSettingsPublic = cached(
  () => fetchPublic(api.settings.getPublic, {}),
  "settings-public",
  900,
  () => ["settings"],
);

export const getCategoryTree = cached(
  () => fetchPublic(api.catalog.categories.tree, {}),
  "category-tree",
  900,
  () => ["categories"],
);

export const getCategory = cached(
  (slug: string) => fetchPublic(api.catalog.categories.bySlug, { slug }),
  "category",
  900,
  (slug) => ["categories", `category:${slug}`],
);

export const getCategoryListing = cached(
  (args: ListArgs) => fetchPublic(api.catalog.products.listByCategory, args),
  "category-listing",
  300,
  (args) => ["products", `category:${args.categorySlug}`],
);

export const getProductBySlug = cached(
  (slug: string) => fetchPublic(api.catalog.products.bySlug, { slug }),
  "product",
  300,
  (slug) => ["products", `product:${slug}`],
);

export const getRetiredProduct = cached(
  (slug: string) => fetchPublic(api.catalog.products.retired, { slug }),
  "product-retired",
  300,
  (slug) => ["products", `product:${slug}`],
);

export const getRelatedProducts = cached(
  (productId: FunctionArgs<typeof api.catalog.products.related>["productId"]) =>
    fetchPublic(api.catalog.products.related, { productId, limit: 8 }),
  "product-related",
  900,
  () => ["products"],
);

export const getVehicleTree = cached(
  () => fetchPublic(api.catalog.vehicles.tree, {}),
  "vehicle-tree",
  3600,
  () => ["vehicles"],
);

export const getVehicleEngines = cached(
  (generationId: FunctionArgs<typeof api.catalog.vehicles.engines>["generationId"]) =>
    fetchPublic(api.catalog.vehicles.engines, { generationId }),
  "vehicle-engines",
  3600,
  () => ["vehicles"],
);

export const resolveVehicle = cached(
  (args: FunctionArgs<typeof api.catalog.vehicles.resolve>) =>
    fetchPublic(api.catalog.vehicles.resolve, args),
  "vehicle-resolve",
  3600,
  () => ["vehicles"],
);

export const getVehicleParts = cached(
  (args: FunctionArgs<typeof api.catalog.products.forVehicle>) =>
    fetchPublic(api.catalog.products.forVehicle, args),
  "vehicle-parts",
  900,
  () => ["products", "vehicles"],
);

export const getManufacturers = cached(
  () => fetchPublic(api.catalog.manufacturers.list, {}),
  "manufacturers",
  3600,
  () => ["manufacturers"],
);

export const getContentPage = cached(
  (slug: string) => fetchPublic(api.content.pageBySlug, { slug }),
  "content-page",
  3600,
  (slug) => [`content:${slug}`],
);

export const getFaqs = cached(
  (scope: string) => fetchPublic(api.content.faqs, { scope }),
  "faqs",
  3600,
  () => ["faqs"],
);

export const getPublicTiers = cached(
  () => fetchPublic(api.pricing.publicTiers, {}),
  "public-tiers",
  900,
  () => ["tiers"],
);

/** Same OEM, other manufacturers („Isti deo, drugi proizvođači“) — exact/cross code hits. */
export const getSameOemProducts = cached(
  (oem: string) => fetchPublic(api.search.run, { q: oem, limit: 12 }),
  "same-oem",
  900,
  () => ["products"],
);

/** Search results (anonymous; the page logs the query separately). */
export const getSearchResults = cached(
  (q: string) => fetchPublic(api.search.run, { q }),
  "search",
  120,
  () => ["products"],
);

// Step 19 — SEO sources (sitemaps, feeds, landings, ads landings). ---------------------

export const getSitemapData = cached(
  () => fetchPublic(api.seo.sitemapData, {}),
  "sitemap-data",
  3600,
  () => ["sitemap", "products", "categories", "vehicles", "settings"],
);

type SitemapProduct = FunctionReturnType<typeof api.seo.sitemapProducts>["page"][number];

/** Product chunk `n` (1-based) of the product sitemaps: pages through Convex from the start. */
export const getSitemapProductChunk = cached(
  async (n: number, perFile: number): Promise<SitemapProduct[]> => {
    const skip = (n - 1) * perFile;
    const out: SitemapProduct[] = [];
    let seen = 0;
    let cursor: string | null = null;
    for (;;) {
      const page: FunctionReturnType<typeof api.seo.sitemapProducts> = await fetchPublic(
        api.seo.sitemapProducts,
        { paginationOpts: { numItems: 250, cursor } },
      );
      for (const row of page.page) {
        if (!row.listed) continue;
        if (seen >= skip && out.length < perFile) out.push(row);
        seen++;
      }
      if (page.isDone || out.length >= perFile) break;
      cursor = page.continueCursor;
    }
    return out;
  },
  "sitemap-products",
  3600,
  () => ["sitemap", "products"],
);

type FeedRow = FunctionReturnType<typeof api.seo.feedProducts>["page"][number];

/** Every feed row (active products with a public price), paged through Convex. */
export const getFeedRows = cached(
  async (includeDemo: boolean): Promise<{ pricesPublic: boolean; rows: FeedRow[] }> => {
    const rows: FeedRow[] = [];
    let cursor: string | null = null;
    let pricesPublic = true;
    for (;;) {
      const page: FunctionReturnType<typeof api.seo.feedProducts> = await fetchPublic(
        api.seo.feedProducts,
        { paginationOpts: { numItems: 200, cursor }, includeDemo },
      );
      pricesPublic = page.pricesPublic;
      rows.push(...page.page);
      if (page.isDone || !pricesPublic) break;
      cursor = page.continueCursor;
    }
    return { pricesPublic, rows };
  },
  "feed-rows",
  3600,
  () => ["feeds", "products", "settings"],
);

export const getLanding = cached(
  (args: FunctionArgs<typeof api.seo.landing>) => fetchPublic(api.seo.landing, args),
  "landing",
  900,
  (args) => ["products", "landings", `landing:${args.categorySlug}:${args.brandSlug}`],
);

export const getCategoryLandings = cached(
  (categorySlug: string) => fetchPublic(api.seo.categoryLandings, { categorySlug, limit: 12 }),
  "category-landings",
  900,
  (categorySlug) => ["landings", `category:${categorySlug}`],
);

export const getVehicleLandings = cached(
  (brandSlug: string, modelSlug?: string) =>
    fetchPublic(api.seo.vehicleLandings, { brandSlug, ...(modelSlug ? { modelSlug } : {}) }),
  "vehicle-landings",
  900,
  () => ["landings", "vehicles"],
);

export const getProductLandings = cached(
  (productId: FunctionArgs<typeof api.seo.productLandings>["productId"]) =>
    fetchPublic(api.seo.productLandings, { productId }),
  "product-landings",
  900,
  () => ["landings", "products"],
);

export const getAdLanding = cached(
  (slug: string) => fetchPublic(api.seo.adLanding, { slug }),
  "ad-landing",
  300,
  (slug) => ["adLandings", `adLanding:${slug}`, "products"],
);

export const getProductImage = cached(
  (args: FunctionArgs<typeof api.seo.productImage>) => fetchPublic(api.seo.productImage, args),
  "product-image",
  3600,
  (args) => ["products", `product:${args.slug}`],
);
