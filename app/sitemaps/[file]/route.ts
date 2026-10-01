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
import {
  getSitemapData,
  getSitemapProductChunk,
  getVehicleTree,
} from "@/lib/server/catalog-cache";

const NOT_FOUND_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * Child sitemaps (SEO-ADS §J3): `staticne`, `kategorije`, `vozila`, `landing`,
 * `proizvodi-<n>`. Only indexable URLs — noindex pages never appear here.
 */
export async function GET(_request: Request, { params }: RouteContext<"/sitemaps/[file]">) {
  const { file } = await params;
  const name = file.replace(/\.xml$/, "");
  if (!file.endsWith(".xml")) return new Response("Nije pronađeno", { status: 404, headers: NOT_FOUND_HEADERS });
  const urls = await urlsFor(name);
  if (!urls) return new Response("Nije pronađeno", { status: 404, headers: NOT_FOUND_HEADERS });
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
    case "vozila": {
      // A model with one generation redirects to it (SEO-04): only multi-generation hubs.
      const tree = await getVehicleTree();
      const hubs = new Set(
        tree.flatMap((b) =>
          b.models
            .filter((m) => m.generations.length > 1)
            .map((m) => `${b.brand.slug}/${m.model.slug}`),
        ),
      );
      return [
        ...data.brands.map((b) => ({ loc: ROUTES.vehicleBrand(b.slug) })),
        ...data.models
          .filter((m) => hubs.has(`${m.brandSlug}/${m.slug}`))
          .map((m) => ({ loc: ROUTES.vehicleModel(m.brandSlug, m.slug) })),
        ...data.generations.map((g) => ({
          loc: ROUTES.vehicleGeneration(g.brandSlug, g.modelSlug, g.slug),
        })),
      ];
    }
    case "landing":
      return data.landings.map((l) => ({
        loc: `${ROUTES.category(l.categorySlug)}/${l.brandSlug}${l.modelSlug ? `/${l.modelSlug}` : ""}`,
        lastModified: l.updatedAt,
      }));
    default:
      return null;
  }
}
