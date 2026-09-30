import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { InquiryDetail } from "@/components/admin/inquiries/InquiryDetail";
import { ADMIN } from "@/constants/routes";

export async function generateMetadata({
  params,
}: PageProps<"/admin/upiti/[broj]">): Promise<Metadata> {
  const { broj } = await params;
  return { title: decodeURIComponent(broj) };
}

export default async function AdminInquiryPage({ params }: PageProps<"/admin/upiti/[broj]">) {
  const { broj } = await params;
  const number = decodeURIComponent(broj);
  await requireStaffPage(ADMIN.inquiry(number));
  return <InquiryDetail number={number} />;
}
