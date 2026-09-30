import { merchantFeedXml } from "@/lib/seo/feeds";
import { FEED_CACHE, loadFeed } from "@/lib/server/feeds";

/**
 * Google Merchant Center feed (RSS 2.0 + `g:`), SEO-ADS §J9. Dormant until Merchant Center
 * supports Serbia (D21, docs/ADS-PLAYBOOK.md) — valid and ready to submit. Only active
 * products with a public price; cached for an hour.
 */
export async function GET(request: Request) {
  // `?demo=1` previews the feed with demo items (never submit that URL to an ad platform).
  const feed = await loadFeed(new URL(request.url).searchParams.get("demo") === "1");
  return new Response(merchantFeedXml(feed.products, feed), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": FEED_CACHE,
      "X-Robots-Tag": "noindex",
    },
  });
}
