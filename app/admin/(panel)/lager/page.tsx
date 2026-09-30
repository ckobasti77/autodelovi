import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { StockAdmin } from "@/components/admin/catalog/StockAdmin";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Lager" };

export default async function AdminStockAdminPage() {
  await requireStaffPage(ADMIN.stock);
  return <StockAdmin />;
}
