import type { Metadata } from "next";

import { api } from "@/convex/_generated/api";
import { requireStaffPage } from "@/lib/server/auth";
import { fetchAsUser } from "@/lib/server/convex";
import { DeliveryNoteDocument } from "@/components/admin/print/OrderPrint";

export const metadata: Metadata = { title: "Otpremnice" };

/** Several delivery notes in one print job (bulk action in the orders list); ≤ 30. */
export default async function AdminBulkDeliveryNotesPage({
  searchParams,
}: PageProps<"/admin/stampa/otpremnice">) {
  await requireStaffPage("/admin/porudzbine");
  const { brojevi } = await searchParams;
  const numbers = (typeof brojevi === "string" ? brojevi : "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 30);
  const settings = await fetchAsUser(api.settings.getAdmin, {});
  const docs = (
    await Promise.all(numbers.map((number) => fetchAsUser(api.ordersAdmin.get, { number })))
  ).filter((d): d is NonNullable<typeof d> => d !== null);
  if (docs.length === 0)
    return <p className="type-body text-ink-2">Nije izabrana nijedna porudžbina.</p>;
  return docs.map((data, i) => (
    <DeliveryNoteDocument key={data.order._id} data={data} settings={settings} notice={i === 0} />
  ));
}
