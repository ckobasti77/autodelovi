import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { AuditAdmin } from "@/components/admin/system/AuditAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Revizija" };

export default async function AdminAuditAdminPage() {
  await requireStaffPage(ADMIN.audit);
  return <AuditAdmin />;
}
