import "server-only";

import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { vehicleText } from "@/lib/seo/landingCopy";
import { getCategory, getLanding, resolveVehicle } from "@/lib/server/catalog-cache";
import { ogFrame, ogImageData } from "@/lib/og/frame";

/** Landing OG (category × brand / model): category render + vehicle + counts. */
export async function landingOgImage(kategorija: string, marka: string, model?: string) {
  const [category, vehicle, stats] = await Promise.all([
    getCategory(kategorija),
    resolveVehicle({ brandSlug: marka, ...(model ? { modelSlug: model } : {}) }),
    getLanding({
      categorySlug: kategorija,
      brandSlug: marka,
      ...(model ? { modelSlug: model } : {}),
    }),
  ]);
  if (!category || !vehicle) {
    return ogFrame({ title: "Delovi za VAG vozila" });
  }
  const name = vehicleText({
    brandName: vehicle.brand.name,
    modelName: vehicle.model?.name ?? null,
  });
  const c = category.category;
  return ogFrame({
    title: `${c.name} za ${name}`,
    meta: stats?.generations.length
      ? {
          label: stats.generations
            .slice(0, 3)
            .map((g) => g.name)
            .join(" · "),
        }
      : null,
    count: stats
      ? `${formatNumber(stats.productCount)} ${pluralSr(stats.productCount, ["artikal", "artikla", "artikala"])} · ${formatNumber(stats.inStockCount)} na stanju`
      : null,
    image: await ogImageData(c.thumbnailPath ?? `/images/parts/${c.slug}.webp`),
  });
}
