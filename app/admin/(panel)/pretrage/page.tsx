import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { SearchesAdmin } from "@/components/admin/system/SearchesAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Pretrage" };

export default async function AdminSearchesAdminPage() {
  await requireStaffPage(ADMIN.searches);
  return <SearchesAdmin />;
}
