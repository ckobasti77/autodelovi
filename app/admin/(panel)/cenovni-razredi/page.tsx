import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { TiersAdmin } from "@/components/admin/customers/TiersAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Cenovni razredi" };

export default async function AdminTiersPage() {
  await requireStaffPage(ADMIN.tiers);
  return <TiersAdmin />;
}
