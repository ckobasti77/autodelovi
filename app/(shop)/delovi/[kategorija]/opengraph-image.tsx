import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame, ogImageData } from "@/lib/og/frame";
import { getCategory } from "@/lib/server/catalog-cache";

/** Category / system OG: category render + name + counts. */
export const alt = "Kategorija auto delova — broj artikala i stanje";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({ params }: { params: Promise<{ kategorija: string }> }) {
  const { kategorija } = await params;
  const data = await getCategory(kategorija);
  if (!data) return ogFrame({ title: "Delovi za VAG vozila" });
  const c = data.category;
  const children = data.children;
  const count = c.productCount || children.reduce((n, x) => n + x.productCount, 0);
  const inStock = c.inStockCount || children.reduce((n, x) => n + x.inStockCount, 0);
  const render = c.thumbnailPath ?? children[0]?.thumbnailPath ?? `/images/parts/${c.slug}.webp`;
  return ogFrame({
    title:
      c.kind === "system"
        ? `${c.name} — delovi za VAG vozila`
        : `${c.name} za VW, Audi, Škoda, SEAT`,
    meta: { label: "VW · Audi · Škoda · SEAT · Cupra" },
    count:
      count > 0
        ? `${formatNumber(count)} ${pluralSr(count, ["artikal", "artikla", "artikala"])} · ${formatNumber(inStock)} na stanju`
        : null,
    image: await ogImageData(c.kind === "system" ? (children[0]?.thumbnailPath ?? null) : render),
  });
}
