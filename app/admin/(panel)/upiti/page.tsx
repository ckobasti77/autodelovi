import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { InquiriesList } from "@/components/admin/inquiries/InquiriesList";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Upiti" };

export default async function AdminInquiriesPage() {
  await requireStaffPage(ADMIN.inquiries);
  return <InquiriesList />;
}
