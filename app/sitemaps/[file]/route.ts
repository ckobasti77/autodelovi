import { ROUTES } from "@/constants/routes";
import {
  PRODUCTS_PER_SITEMAP,
  STATIC_SITEMAP_PATHS,
  XML_HEADERS,
  productSitemapIndex,
  urlsetXml,
  type SitemapUrl,
} from "@/lib/seo/sitemap";
import { normalizeCuratedQuery } from "@/lib/seo/templates";
import { getSitemapData, getSitemapProductChunk } from "@/lib/server/catalog-cache";

/**
 * Child sitemaps (SEO-ADS §J3): `staticne`, `kategorije`, `vozila`, `landing`,
 * `proizvodi-<n>`. Only indexable URLs — noindex pages never appear here.
 */
export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const { file } = await params;
  const name = file.replace(/\.xml$/, "");
  if (!file.endsWith(".xml")) return new Response("Not found", { status: 404 });
  const urls = await urlsFor(name);
  if (!urls) return new Response("Not found", { status: 404 });
  return new Response(urlsetXml(urls), { headers: XML_HEADERS });
}

async function urlsFor(name: string): Promise<SitemapUrl[] | null> {
  const productIndex = productSitemapIndex(name);
  if (productIndex !== null) {
    const data = await getSitemapData();
    if (productIndex > Math.max(1, Math.ceil(data.productCount / PRODUCTS_PER_SITEMAP)))
      return null;
    const rows = await getSitemapProductChunk(productIndex, PRODUCTS_PER_SITEMAP);
    return rows.map((p) => ({
      loc: ROUTES.product(p.slug),
      lastModified: p.lastModified,
      images: p.images,
    }));
  }
  const data = await getSitemapData();
  switch (name) {
    case "staticne":
      return [
        ...STATIC_SITEMAP_PATHS.map((loc) => ({ loc })),
        ...data.curatedSearches.map((q) => ({ loc: ROUTES.searchFor(normalizeCuratedQuery(q)) })),
      ];
    case "kategorije":
      return data.categories.map((c) => ({
        loc: ROUTES.category(c.slug),
        lastModified: c.updatedAt,
      }));
    case "vozila":
      return [
        ...data.brands.map((b) => ({ loc: ROUTES.vehicleBrand(b.slug) })),
        ...data.models.map((m) => ({ loc: ROUTES.vehicleModel(m.brandSlug, m.slug) })),
        ...data.generations.map((g) => ({
          loc: ROUTES.vehicleGeneration(g.brandSlug, g.modelSlug, g.slug),
        })),
      ];
    case "landing":
      return data.landings.map((l) => ({
        loc: `${ROUTES.category(l.categorySlug)}/${l.brandSlug}${l.modelSlug ? `/${l.modelSlug}` : ""}`,
        lastModified: l.updatedAt,
      }));
    default:
      return null;
  }
}
