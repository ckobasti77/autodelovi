import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { getCategoryTree } from "@/lib/server/catalog-cache";
import { PriceListPicker } from "@/components/mechanic/PriceListPicker";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Cenovnik");

export default async function MechanicPriceListPage() {
  await requireMechanicPage(ROUTES.mechanicPriceList);
  const tree = await getCategoryTree();
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[62ch] type-body text-ink-2" data-reveal="off">
        Izaberite sisteme ili kategorije. Fajl ima šifru, naziv, proizvođača, OEM broj, maloprodajnu cenu, vašu cenu,
        rabat i stanje — za rad bez interneta ili za ponudu mušteriji.
      </p>
      <PriceListPicker tree={tree} />
    </div>
  );
}
