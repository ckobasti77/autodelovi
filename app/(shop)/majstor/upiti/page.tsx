import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { InquiriesList } from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Upiti");

export default async function MechanicInquiriesPage() {
  await requireMechanicPage(ROUTES.mechanicInquiries);
  return <InquiriesList />;
}
