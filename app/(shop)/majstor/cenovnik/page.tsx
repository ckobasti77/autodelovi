import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { getCategoryTree } from "@/lib/server/catalog-cache";
import { RevealText } from "@/components/text-reveal/RevealText";
import { PriceListPicker } from "@/components/mechanic/PriceListPicker";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Cenovnik");

export default async function MechanicPriceListPage() {
  await requireMechanicPage(ROUTES.mechanicPriceList);
  const tree = await getCategoryTree();
  return (
    <div className="flex flex-col gap-5">
      <RevealText as="p" className="max-w-[68ch] type-body text-ink-2">
        Izaberite sisteme ili kategorije. Fajl ima šifru, naziv, proizvođača, OEM broj, maloprodajnu
        cenu, vašu cenu, rabat i stanje — za rad bez interneta ili za ponudu mušteriji.
      </RevealText>
      <PriceListPicker tree={tree} />
    </div>
  );
}
