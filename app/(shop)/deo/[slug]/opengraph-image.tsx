import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame, ogImageData } from "@/lib/og/frame";
import { getProductBySlug } from "@/lib/server/catalog-cache";

/** Product OG: photo (or category render) + name + OEM + manufacturer — never the price. */
export const alt = "Auto deo — naziv, OEM broj i proizvođač";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) {
    return ogFrame({ title: "Artikal nije u ponudi" });
  }
  const c = data.product;
  const photo = data.images.find((i) => i.url)?.url ?? null;
  const code = c.oemPrimary ?? data.mpn;
  return ogFrame({
    title: c.name,
    titleCase: "sentence",
    meta: { label: code ? "OEM" : undefined, code: code ?? undefined, after: c.manufacturerName },
    count: QUALITY_LABEL[c.quality],
    image: await ogImageData(photo ?? `/images/parts/${c.categorySlug}.webp`),
  });
}
