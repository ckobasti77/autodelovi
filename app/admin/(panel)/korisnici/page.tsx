import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { requireStaffPage } from "@/lib/server/auth";
import { UsersAdmin } from "@/components/admin/system/UsersAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Korisnici" };

export default async function AdminUsersPage() {
  const viewer = await requireStaffPage(ADMIN.users);
  if (!viewer.isOwner) forbidden();
  return <UsersAdmin />;
}
