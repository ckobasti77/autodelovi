import type { Metadata } from "next";

import type { Id } from "@/convex/_generated/dataModel";
import { requireStaffPage } from "@/lib/server/auth";
import { ImportBatchDetail } from "@/components/admin/import/ImportBatchDetail";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Zapis uvoza" };

export default async function AdminImportBatchPage({ params }: PageProps<"/admin/uvoz/[id]">) {
  const { id } = await params;
  await requireStaffPage(ADMIN.importBatch(id));
  return <ImportBatchDetail batchId={id as Id<"importBatches">} />;
}
