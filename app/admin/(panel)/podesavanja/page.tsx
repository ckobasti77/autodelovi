import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { SettingsAdmin } from "@/components/admin/settings/SettingsAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Podešavanja" };

export default async function AdminSettingsPage() {
  await requireStaffPage(ADMIN.settings);
  return <SettingsAdmin />;
}
