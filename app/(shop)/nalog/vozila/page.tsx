import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { SavedVehicles } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Vozila");

export default async function AccountVehiclesPage() {
  await requireAccountPage(ROUTES.accountVehicles);
  return <SavedVehicles />;
}
