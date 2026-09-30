import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ImportWizard } from "@/components/admin/import/ImportWizard";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Uvoz iz Excela" };

export default async function AdminImportPage() {
  await requireStaffPage(ADMIN.imports);
  return <ImportWizard />;
}
