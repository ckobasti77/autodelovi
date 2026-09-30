import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { ProductsList } from "@/components/admin/products/ProductsList";
import { ADMIN } from "@/constants/routes";

export const metadata: Metadata = { title: "Proizvodi" };

export default async function AdminProductsPage() {
  await requireStaffPage(ADMIN.products);
  return <ProductsList />;
}
