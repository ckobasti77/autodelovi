import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { OrdersList } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Porudžbine");

/** The view's name is the H1 of the account layout (`AccountHeading`, A11Y-21). */
export default async function AccountOrdersPage() {
  await requireAccountPage(ROUTES.accountOrders);
  return <OrdersList />;
}
