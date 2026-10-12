import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { PortalOverview } from "@/components/mechanic/PortalOverview";
import { QuickOrder } from "@/components/mechanic/QuickOrder";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Majstorski portal");

/**
 * `/majstor` (§10.9): the quick-order box on the left, and beside it the answer of a check and
 * the overview — terms, last orders, link tiles.
 */
export default async function MechanicPortalPage() {
  await requireMechanicPage(ROUTES.mechanicPortal);
  return <QuickOrder compact aside={<PortalOverview />} />;
}
