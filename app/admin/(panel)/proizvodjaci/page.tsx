import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ManufacturersAdmin } from "@/components/admin/catalog/ManufacturersAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Proizvođači" };

export default async function AdminManufacturersAdminPage() {
  await requireStaffPage(ADMIN.manufacturers);
  return <ManufacturersAdmin />;
}
