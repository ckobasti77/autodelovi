import { metaCatalogCsv } from "@/lib/seo/feeds";
import { FEED_CACHE, loadFeed } from "@/lib/server/feeds";

/** Meta (Facebook/Instagram) catalog CSV — `id` = SKU = Pixel/CAPI `content_ids` (§J9). */
export async function GET(request: Request) {
  // `?demo=1` previews the feed with demo items (never submit that URL to an ad platform).
  const feed = await loadFeed(new URL(request.url).searchParams.get("demo") === "1");
  return new Response(metaCatalogCsv(feed.products), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="meta-catalog.csv"',
      "Cache-Control": FEED_CACHE,
      "X-Robots-Tag": "noindex",
    },
  });
}
