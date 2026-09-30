import type { Metadata } from "next";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { contactFromSettings } from "@/lib/settings/public";
import { requireMechanicPage } from "@/lib/server/auth";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { fetchAsUser } from "@/lib/server/convex";
import { RevealText } from "@/components/text-reveal/RevealText";
import { MechanicStatusScreen } from "@/components/mechanic/MechanicStatusScreen";
import { PortalNav } from "@/components/mechanic/PortalNav";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Mechanic portal (ROUTES §B1 `/majstor…`): proxy redirect + this server guard; every portal
 * function re-checks in Convex (`requireApprovedMechanic`). Accounts that are not approved
 * mechanics get the status screen instead of the portal pages.
 */
export default async function MechanicLayout({ children }: LayoutProps<"/majstor">) {
  await requireMechanicPage(ROUTES.mechanicPortal);
  const [overview, settings] = await Promise.all([
    fetchAsUser(api.mechanicPortal.overview, {}),
    getSettingsPublic(),
  ]);
  const approved = overview?.status === "approved";
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="p" className="type-body-s text-ink-3">
        {overview ? overview.companyName : "Majstorski portal"}
      </RevealText>
      <h1 className="mt-1 type-h1 text-ink-1" data-reveal="off">
        {approved ? "Majstorski portal" : "Majstorski nalog"}
      </h1>
      {approved ? (
        <>
          <div className="mt-6">
            <PortalNav />
          </div>
          <div className="mt-8">{children}</div>
        </>
      ) : (
        <div className="mt-8">
          <MechanicStatusScreen
            profile={
              overview
                ? {
                    status: overview.status,
                    companyName: overview.companyName,
                    pib: overview.pib,
                    city: overview.city,
                    submittedAt: overview.submittedAt,
                    rejectionReason: overview.rejectionReason,
                  }
                : null
            }
            contacts={contactLinkList(contactFromSettings(settings)).filter((l) => l.channel !== "email")}
          />
        </div>
      )}
    </div>
  );
}
