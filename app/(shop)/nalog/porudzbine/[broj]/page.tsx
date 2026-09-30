import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { AccountOrderDetail } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Porudžbina");

export default async function AccountOrderPage({ params }: PageProps<"/nalog/porudzbine/[broj]">) {
  const { broj } = await params;
  return <AccountOrderDetail number={decodeURIComponent(broj)} />;
}
