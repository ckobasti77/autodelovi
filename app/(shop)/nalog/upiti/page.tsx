import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { InquiriesList } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Upiti");

export default function AccountInquiriesPage() {
  return <InquiriesList />;
}
