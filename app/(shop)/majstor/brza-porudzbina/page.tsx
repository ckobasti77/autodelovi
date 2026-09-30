import type { Metadata } from "next";

import { quickOrderTextFromCodes } from "@/lib/domain/quickOrder";
import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { QuickOrder } from "@/components/mechanic/QuickOrder";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Brza porudžbina");

/** `/majstor/brza-porudzbina?kodovi=A,B` — the header search sends pasted lists here. */
export default async function QuickOrderPage({ searchParams }: PageProps<"/majstor/brza-porudzbina">) {
  await requireMechanicPage(ROUTES.mechanicQuickOrderPage);
  const sp = await searchParams;
  const raw = Array.isArray(sp.kodovi) ? sp.kodovi[0] : sp.kodovi;
  const codes = (raw ?? "")
    .split(",")
    .map((c) => c.trim().slice(0, 60))
    .filter(Boolean);
  return <QuickOrder initialText={quickOrderTextFromCodes(codes)} />;
}
