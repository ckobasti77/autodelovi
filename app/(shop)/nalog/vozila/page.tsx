import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { SavedVehicles } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Vozila");

export default function AccountVehiclesPage() {
  return <SavedVehicles />;
}
