import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { CustomersList } from "@/components/admin/customers/CustomersAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Kupci" };

export default async function AdminCustomersPage() {
  await requireStaffPage(ADMIN.customers);
  return <CustomersList />;
}
