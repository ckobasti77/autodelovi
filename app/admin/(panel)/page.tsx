import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { Dashboard } from "@/components/admin/dashboard/Dashboard";

export const metadata: Metadata = { title: { absolute: "Pregled · Administracija" } };

export default async function AdminDashboardPage() {
  await requireStaffPage("/admin");
  return <Dashboard />;
}
