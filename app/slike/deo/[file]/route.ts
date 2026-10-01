import { parseProductImageFile, TYPE_BY_EXT } from "@/lib/seo/images";
import { getProductImage } from "@/lib/server/catalog-cache";

/**
 * Product photos under descriptive Serbian file names (image SEO):
 * `/slike/deo/<slug>-<n>-<v>.<ext>` → the Convex storage file. `<v>` is derived from the
 * storage id, so the URL changes with the photo and the response can be cached immutably.
 */
function notFound(): Response {
  return new Response("Nije pronađeno", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/slike/deo/[file]">) {
  const { file } = await params;
  const parsed = parseProductImageFile(file);
  if (!parsed) return notFound();
  const image = await getProductImage({
    slug: parsed.slug,
    index: parsed.index,
    token: parsed.token,
  });
  if (!image) return notFound();
  const upstream = await fetch(image.url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return notFound();
  return new Response(upstream.body, {
    headers: {
      "Content-Type": image.contentType ?? TYPE_BY_EXT[parsed.ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
