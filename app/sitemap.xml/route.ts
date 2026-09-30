import { sitemapFileNames, sitemapIndexXml, XML_HEADERS } from "@/lib/seo/sitemap";
import { getSitemapData } from "@/lib/server/catalog-cache";

/**
 * Sitemap index (SEO-ADS §J3, ROUTES §B3). Data is cached for an hour in the Next data cache
 * (`catalog-cache`, tags `sitemap`/`products`); the response carries CDN cache headers.
 */
export async function GET() {
  const data = await getSitemapData();
  const newest = (dates: number[]) => (dates.length ? Math.max(...dates) : null);
  const files = sitemapFileNames(data.productCount).map((name) => ({
    name,
    lastModified:
      name === "kategorije"
        ? newest(data.categories.map((c) => c.updatedAt))
        : name === "landing"
          ? newest(data.landings.map((l) => l.updatedAt))
          : null,
  }));
  return new Response(sitemapIndexXml(files), { headers: XML_HEADERS });
}
