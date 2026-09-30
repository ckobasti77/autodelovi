import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { VehiclesAdmin } from "@/components/admin/catalog/VehiclesAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Vozila" };

export default async function AdminVehiclesAdminPage() {
  await requireStaffPage(ADMIN.vehicles);
  return <VehiclesAdmin />;
}
