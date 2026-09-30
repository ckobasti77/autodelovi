"use client";

/**
 * Header account entry: mechanics go to `/majstor` (approved ones also get the quick-order
 * shortcut), everyone else to `/nalog`. Before the viewer is known it renders the plain
 * account link, so the server HTML and the first client render match.
 */
import { ListNumbersIcon, UserCircleIcon, WrenchIcon } from "@phosphor-icons/react/dist/ssr";

import { isMechanicViewer, useViewer } from "@/lib/auth/useViewer";
import { RouteLink } from "@/components/ui/RouteLink";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export function AccountLink({ className }: { className: string }) {
  const viewer = useViewer();
  const mechanic = isMechanicViewer(viewer);
  const approved = mechanic && viewer?.mechanicStatus === "approved";
  return (
    <>
      {approved ? (
        <RouteLink
          href={ROUTES.mechanicQuickOrderPage}
          aria-label="Brza porudžbina"
          className={className}
        >
          <ListNumbersIcon size={24} aria-hidden="true" />
        </RouteLink>
      ) : null}
      <RouteLink
        href={mechanic ? ROUTES.mechanicPortal : ROUTES.account}
        aria-label={mechanic ? "Majstorski portal" : "Moj nalog"}
        data-testid={TEST_IDS.accountButton}
        data-mechanic={mechanic ? "" : undefined}
        className={className}
      >
        {mechanic ? <WrenchIcon size={24} aria-hidden="true" /> : <UserCircleIcon size={24} aria-hidden="true" />}
      </RouteLink>
    </>
  );
}
