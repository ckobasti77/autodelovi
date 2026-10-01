import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { SavedVehicles } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Vozila");

export default async function AccountVehiclesPage() {
  await requireAccountPage(ROUTES.accountVehicles);
  // The tab label as this view's heading under the shared „Moj nalog“ h1 (A11Y-21).
  return (
    <>
      <h2 className="sr-only" data-reveal="off">
        Vozila
      </h2>
      <SavedVehicles />
    </>
  );
}
