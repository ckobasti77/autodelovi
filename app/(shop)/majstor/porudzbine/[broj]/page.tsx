import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { AccountOrderDetail } from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Porudžbina");

export default async function MechanicOrderPage({ params }: PageProps<"/majstor/porudzbine/[broj]">) {
  const { broj } = await params;
  const number = decodeURIComponent(broj);
  await requireMechanicPage(ROUTES.mechanicOrder(number));
  return <AccountOrderDetail number={number} />;
}
