import type { MetadataRoute } from "next";

import { site } from "@/config/site";

/**
 * robots.txt (SEO-ADS §J3, ROUTES §B4): everything crawlable except the auth areas and APIs;
 * other noindex pages stay crawlable so their `noindex` is seen. AI search crawlers are
 * allowed (visibility in AI answers); the sitemap index is absolute.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/nalog", "/majstor", "/styleguide"],
      },
    ],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
