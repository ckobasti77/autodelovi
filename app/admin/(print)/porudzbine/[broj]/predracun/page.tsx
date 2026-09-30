import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { fetchAsUser } from "@/lib/server/convex";
import { ProformaDocument } from "@/components/admin/print/OrderPrint";

export const metadata: Metadata = { title: "Predračun" };

export default async function AdminProformaPage({
  params,
}: PageProps<"/admin/porudzbine/[broj]/predracun">) {
  const { broj } = await params;
  const [data, settings] = await Promise.all([
    fetchAsUser(api.ordersAdmin.get, { number: decodeURIComponent(broj) }),
    fetchAsUser(api.settings.getAdmin, {}),
  ]);
  if (!data) notFound();
  return <ProformaDocument data={data} settings={settings} />;
}
