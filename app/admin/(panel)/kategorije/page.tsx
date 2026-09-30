import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { CategoriesAdmin } from "@/components/admin/catalog/CategoriesAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Kategorije" };

export default async function AdminCategoriesAdminPage() {
  await requireStaffPage(ADMIN.categories);
  return <CategoriesAdmin />;
}
