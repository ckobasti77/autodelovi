import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { getCategoryTree, getManufacturers } from "@/lib/server/catalog-cache";
import { MechanicAdminDetail } from "@/components/admin/MechanicAdminDetail";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { title: "Majstor" };

export default async function AdminMechanicPage({ params }: PageProps<"/admin/majstori/[id]">) {
  const { id } = await params;
  await requireStaffPage(ROUTES.adminMechanic(id));
  const [tree, manufacturers] = await Promise.all([getCategoryTree(), getManufacturers()]);
  const categories = [...tree.categories, ...tree.subcategories]
    .map((c) => ({ id: c._id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "sr"));
  return (
    <MechanicAdminDetail
      profileId={id}
      categories={categories}
      manufacturers={manufacturers
        .map((m) => ({ id: m._id, name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "sr"))}
    />
  );
}
