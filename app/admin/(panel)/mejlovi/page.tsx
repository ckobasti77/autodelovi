import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { EmailsAdmin } from "@/components/admin/system/EmailsAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "E-pošta" };

export default async function AdminEmailsAdminPage() {
  await requireStaffPage(ADMIN.emails);
  return <EmailsAdmin />;
}
