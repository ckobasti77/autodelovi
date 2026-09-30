import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { PortalOverview } from "@/components/mechanic/PortalOverview";
import { QuickOrder } from "@/components/mechanic/QuickOrder";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Majstorski portal");

/** `/majstor` (§10.9): quick-order box first, then terms and link tiles. */
export default async function MechanicPortalPage() {
  await requireMechanicPage(ROUTES.mechanicPortal);
  return (
    <div className="flex flex-col gap-14">
      <QuickOrder compact />
      <PortalOverview />
    </div>
  );
}
