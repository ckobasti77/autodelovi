import type { Metadata } from "next";

import type { Id } from "@/convex/_generated/dataModel";
import { requireStaffPage } from "@/lib/server/auth";
import { PrivacyAdmin } from "@/components/admin/system/PrivacyAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Privatnost" };

export default async function AdminPrivacyPage({ searchParams }: PageProps<"/admin/privatnost">) {
  await requireStaffPage(ADMIN.privacy);
  const { kupac } = await searchParams;
  const userId = typeof kupac === "string" && /^[a-z0-9]{20,40}$/.test(kupac) ? kupac : null;
  return <PrivacyAdmin userId={userId as Id<"users"> | null} />;
}
