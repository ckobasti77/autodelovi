import "server-only";

/**
 * Feed rows for `/feeds/*` (SEO-ADS §J9): Convex rows + the category tree → `FeedProduct`
 * (product_type path, Google category) and the courier shipping rule from settings.
 */
import type { FeedProduct, FeedShipping } from "@/lib/seo/feeds";
import { googleCategoryFor } from "@/lib/seo/googleCategories";
import { getCategoryTree, getFeedRows, getSettingsPublic } from "@/lib/server/catalog-cache";

export async function loadFeed(): Promise<{
  products: FeedProduct[];
  shipping: FeedShipping;
  storeName: string;
  pricesPublic: boolean;
}> {
  const [{ rows, pricesPublic }, tree, settings] = await Promise.all([
    getFeedRows(),
    getCategoryTree(),
    getSettingsPublic(),
  ]);
  const all = [...tree.systems, ...tree.categories, ...tree.subcategories];
  const byId = new Map(all.map((c) => [c._id as string, c]));
  const systemBySlug = new Map(tree.systems.map((s) => [s.slug, s]));
  const products: FeedProduct[] = rows.map((r) => {
    const category = byId.get(r.categoryId);
    const parent = category?.parentId ? byId.get(category.parentId) : undefined;
    const system = category ? systemBySlug.get(category.systemSlug) : undefined;
    const path = [
      system?.name,
      parent && parent.kind !== "system" ? parent.name : undefined,
      category?.name,
    ]
      .filter(Boolean)
      .join(" > ");
    return {
      ...r,
      productType: path || "Auto delovi",
      googleCategoryId: googleCategoryFor({
        categorySlug: r.categorySlug,
        parentSlug: parent?.slug ?? null,
        systemSlug: category?.systemSlug ?? "",
      }),
    };
  });
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  return {
    products,
    shipping: courier
      ? { pricePara: courier.pricePara, freeOverPara: courier.freeOverPara ?? null }
      : null,
    storeName: settings.company.displayName?.trim() || settings.brand.name,
    pricesPublic,
  };
}

export const FEED_CACHE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";
