import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { getVehicleTree } from "@/lib/server/catalog-cache";
import { MechanicProfileForm } from "@/components/mechanic/MechanicProfileForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Profil servisa");

export default async function MechanicProfilePage() {
  const viewer = await requireMechanicPage(ROUTES.mechanicProfile);
  const tree = await getVehicleTree();
  return (
    <MechanicProfileForm
      brands={tree.map((b) => ({ id: b.brand._id, name: b.brand.name }))}
      accountEmail={viewer.email ?? ""}
    />
  );
}
