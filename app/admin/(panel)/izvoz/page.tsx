import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ExportsAdmin } from "@/components/admin/export/ExportsAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Izvoz" };

export default async function AdminExportsPage() {
  await requireStaffPage(ADMIN.exports);
  return <ExportsAdmin />;
}
