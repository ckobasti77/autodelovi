import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { InquiriesList } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Upiti");

/** The view's name is the H1 of the account layout (`AccountHeading`, A11Y-21). */
export default async function AccountInquiriesPage() {
  await requireAccountPage(ROUTES.accountInquiries);
  return <InquiriesList />;
}
