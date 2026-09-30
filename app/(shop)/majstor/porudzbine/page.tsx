import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { MechanicOrders } from "@/components/mechanic/MechanicOrders";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Porudžbine");

export default async function MechanicOrdersPage() {
  await requireMechanicPage(ROUTES.mechanicOrders);
  return <MechanicOrders />;
}
