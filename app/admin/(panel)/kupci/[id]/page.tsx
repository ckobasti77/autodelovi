import type { Metadata } from "next";

import type { Id } from "@/convex/_generated/dataModel";
import { requireStaffPage } from "@/lib/server/auth";
import { CustomerDetail } from "@/components/admin/customers/CustomersAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Kupac" };

export default async function AdminCustomerPage({ params }: PageProps<"/admin/kupci/[id]">) {
  const { id } = await params;
  await requireStaffPage(ADMIN.customer(id));
  return <CustomerDetail userId={id as Id<"users">} />;
}
