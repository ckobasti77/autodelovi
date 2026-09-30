import type { Metadata } from "next";

import { InviteAccept } from "@/components/admin/system/InviteAccept";

export const metadata: Metadata = {
  title: { absolute: "Pozivnica za administraciju" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Public, token-guarded (docs/ROUTES.md §B2): no staff guard — the token is the capability. */
export default async function AdminInvitePage({ params }: PageProps<"/admin/pozivnica/[token]">) {
  const { token } = await params;
  return <InviteAccept token={token} />;
}
