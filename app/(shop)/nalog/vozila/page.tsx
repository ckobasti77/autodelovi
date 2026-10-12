import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { SavedVehiclesView } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Vozila");

/** The view's name is the H1 of the account layout (`AccountHeading`, A11Y-21). */
export default async function AccountVehiclesPage() {
  await requireAccountPage(ROUTES.accountVehicles);
  return <SavedVehiclesView />;
}
