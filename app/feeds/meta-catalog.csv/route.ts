import { metaCatalogCsv } from "@/lib/seo/feeds";
import { FEED_CACHE, loadFeed } from "@/lib/server/feeds";

/** Meta (Facebook/Instagram) catalog CSV — `id` = SKU = Pixel/CAPI `content_ids` (§J9). */
export async function GET() {
  const feed = await loadFeed();
  return new Response(metaCatalogCsv(feed.products), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="meta-catalog.csv"',
      "Cache-Control": FEED_CACHE,
      "X-Robots-Tag": "noindex",
    },
  });
}
