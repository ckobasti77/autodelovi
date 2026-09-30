import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { EmailTemplatesAdmin } from "@/components/admin/system/EmailTemplatesAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Šabloni e-pošte" };

export default async function AdminEmailTemplatesPage() {
  await requireStaffPage(ADMIN.emailTemplates);
  return <EmailTemplatesAdmin />;
}
