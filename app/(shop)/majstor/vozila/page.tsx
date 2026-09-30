import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { getVehicleTree } from "@/lib/server/catalog-cache";
import { CustomerVehicles } from "@/components/mechanic/CustomerVehicles";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Vozila mušterija");

export default async function MechanicVehiclesPage() {
  await requireMechanicPage(ROUTES.mechanicVehicles);
  const tree = await getVehicleTree();
  return <CustomerVehicles tree={tree} />;
}
