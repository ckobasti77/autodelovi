import type { MetadataRoute } from "next";

import { site } from "@/config/site";

/**
 * Web app manifest (served at /manifest.webmanifest). Icons come from the logo kit in
 * `public/brand/` (`scripts/brand/logo/build.mjs`, DESIGN-SYSTEM §2.5).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: site.brand.lockupName,
    short_name: site.brand.shortName,
    description: site.brand.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: site.themeColor,
    theme_color: site.themeColor,
    lang: site.locale,
    dir: "ltr",
    categories: ["shopping", "auto"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
