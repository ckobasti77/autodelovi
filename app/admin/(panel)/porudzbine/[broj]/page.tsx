import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { OrderDetail } from "@/components/admin/orders/OrderDetail";
import { ADMIN } from "@/constants/routes";

export async function generateMetadata({
  params,
}: PageProps<"/admin/porudzbine/[broj]">): Promise<Metadata> {
  const { broj } = await params;
  return { title: decodeURIComponent(broj) };
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/porudzbine/[broj]">) {
  const { broj } = await params;
  const number = decodeURIComponent(broj);
  await requireStaffPage(ADMIN.order(number));
  return <OrderDetail number={number} />;
}
