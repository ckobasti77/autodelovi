import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { OrdersList } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Porudžbine");

export default function AccountOrdersPage() {
  return <OrdersList />;
}
