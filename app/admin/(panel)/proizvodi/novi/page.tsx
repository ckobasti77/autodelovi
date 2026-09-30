import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Novi artikal" };

export default async function AdminNewProductPage() {
  await requireStaffPage(ADMIN.productNew);
  return <ProductEditor productId={null} />;
}
