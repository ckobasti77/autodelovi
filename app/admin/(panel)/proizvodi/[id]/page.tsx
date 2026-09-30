import type { Metadata } from "next";

import type { Id } from "@/convex/_generated/dataModel";
import { requireStaffPage } from "@/lib/server/auth";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Artikal" };

export default async function AdminProductPage({ params }: PageProps<"/admin/proizvodi/[id]">) {
  const { id } = await params;
  await requireStaffPage(ADMIN.product(id));
  return <ProductEditor productId={id as Id<"products">} />;
}
