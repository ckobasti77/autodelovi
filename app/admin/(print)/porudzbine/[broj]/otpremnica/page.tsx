import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { requireStaffPage } from "@/lib/server/auth";
import { fetchAsUser } from "@/lib/server/convex";
import { DeliveryNoteDocument } from "@/components/admin/print/OrderPrint";

export const metadata: Metadata = { title: "Otpremnica" };

export default async function AdminDeliveryNotePage({
  params,
}: PageProps<"/admin/porudzbine/[broj]/otpremnica">) {
  const { broj } = await params;
  await requireStaffPage(`/admin/porudzbine/${broj}/otpremnica`);
  const [data, settings] = await Promise.all([
    fetchAsUser(api.ordersAdmin.get, { number: decodeURIComponent(broj) }),
    fetchAsUser(api.settings.getAdmin, {}),
  ]);
  if (!data) notFound();
  return <DeliveryNoteDocument data={data} settings={settings} />;
}
