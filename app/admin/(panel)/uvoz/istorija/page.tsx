import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ImportHistory } from "@/components/admin/import/ImportHistory";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Istorija uvoza" };

export default async function AdminImportHistoryPage() {
  await requireStaffPage(ADMIN.importHistory);
  return <ImportHistory />;
}
