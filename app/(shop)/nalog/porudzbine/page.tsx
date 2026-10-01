import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { OrdersList } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Porudžbine");

export default async function AccountOrdersPage() {
  await requireAccountPage(ROUTES.accountOrders);
  // The tab label as this view's heading under the shared „Moj nalog“ h1 (A11Y-21).
  return (
    <>
      <h2 className="sr-only" data-reveal="off">
        Porudžbine
      </h2>
      <OrdersList />
    </>
  );
}
