import type { Metadata } from "next";

import { requireAccountPage } from "@/lib/server/auth";
import { AccountHeading, AccountNav } from "@/components/account/AccountNav";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Customer account (ROUTES §B1): proxy redirect + this server guard; Convex re-checks.
 *
 * Every view fills the 12-column grid as two columns — records in the wide one (1–7), what
 * belongs beside them in the narrow one — or as one full-width list, so no page ends half
 * empty (UI-BOOST §3 problem 10). The H1 names the open view (`AccountHeading`); „Odjavi se“
 * is in the profile and in the „Još“ menu.
 */
export default async function AccountLayout({ children }: LayoutProps<"/nalog">) {
  const viewer = await requireAccountPage(ROUTES.account);
  const who = viewer.email ?? viewer.firstName ?? viewer.name ?? "Nalog";
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <AccountHeading who={who} />
      <div className="mt-5">
        <AccountNav />
      </div>
      <div className="mt-6 lg:mt-8">{children}</div>
    </div>
  );
}
