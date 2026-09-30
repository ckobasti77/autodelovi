import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { NotificationsAdmin } from "@/components/admin/system/NotificationsAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Obaveštenja" };

export default async function AdminNotificationsAdminPage() {
  await requireStaffPage(ADMIN.notifications);
  return <NotificationsAdmin />;
}
