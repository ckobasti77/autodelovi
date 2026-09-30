import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { OrdersList } from "@/components/admin/orders/OrdersList";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Porudžbine" };

export default async function AdminOrdersPage() {
  await requireStaffPage(ADMIN.orders);
  return <OrdersList />;
}
