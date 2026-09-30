import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { SourcesAdmin } from "@/components/admin/system/SourcesAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Izvori" };

export default async function AdminSourcesPage() {
  await requireStaffPage(ADMIN.sources);
  return <SourcesAdmin />;
}
