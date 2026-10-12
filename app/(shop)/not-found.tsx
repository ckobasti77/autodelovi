import type { Metadata } from "next";

import { NOT_FOUND_TITLE, NotFoundContent } from "@/components/shell/NotFoundContent";
import { NotFoundSearch } from "@/components/shell/NotFoundSearch";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata(NOT_FOUND_TITLE);

/**
 * 404 inside the storefront layout (`notFound()` from a shop page): live search and the vehicle.
 * The phone and the other channels from settings are in the footer and in the mobile action
 * bar around it; this boundary stays light because Next serializes it into every shop page.
 */
export default function ShopNotFound() {
  return <NotFoundContent code="404" search={<NotFoundSearch />} />;
}
