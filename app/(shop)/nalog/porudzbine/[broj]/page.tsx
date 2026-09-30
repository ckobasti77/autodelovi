import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ROUTES } from "@/constants/routes";
import { AccountOrderDetail } from "@/components/account/AccountViews";

export const metadata: Metadata = privateMetadata("Porudžbina");

export default async function AccountOrderPage({ params }: PageProps<"/nalog/porudzbine/[broj]">) {
  const { broj } = await params;
  await requireAccountPage(ROUTES.accountOrder(decodeURIComponent(broj)));
  return <AccountOrderDetail number={decodeURIComponent(broj)} />;
}
