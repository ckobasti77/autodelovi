import type { Metadata } from "next";
import { ArrowRightIcon, WrenchIcon } from "@phosphor-icons/react/dist/ssr";

import { formatPhone } from "@/lib/format/phone";
import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage, viewerNames } from "@/lib/server/auth";
import { Reveal } from "@/components/reveal/Reveal";
import { RouteLink } from "@/components/ui/RouteLink";
import {
  InquiriesList,
  OrdersList,
  PanelHeader,
  SavedVehicles,
} from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Moj nalog");

/**
 * Account overview as a two-column dashboard: what was ordered and asked on the left, the
 * vehicles and who the account belongs to on the right. Each panel links to its full view.
 */
export default async function AccountPage() {
  const viewer = await requireAccountPage(ROUTES.account);
  const names = viewerNames(viewer);
  const fullName = [names.firstName, names.lastName].filter(Boolean).join(" ");
  const mechanic = viewer.mechanicStatus !== "none" && !viewer.isStaff;
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
        <section aria-labelledby="recent-title">
          <OrdersList
            limit={5}
            header={
              <PanelHeader
                id="recent-title"
                title="Poslednje porudžbine"
                href={ROUTES.accountOrders}
              />
            }
          />
        </section>
        <section aria-labelledby="inq-title">
          <InquiriesList
            limit={3}
            header={<PanelHeader id="inq-title" title="Upiti" href={ROUTES.accountInquiries} />}
          />
        </section>
      </div>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
        <section aria-labelledby="veh-title">
          <SavedVehicles
            header={<PanelHeader id="veh-title" title="Vozila" href={ROUTES.accountVehicles} />}
          />
        </section>
        <Reveal as="section" eager index={2} aria-labelledby="who-title" className="panel">
          <PanelHeader
            id="who-title"
            title="Profil"
            href={ROUTES.accountProfile}
            linkLabel="Izmeni"
          />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 px-4 py-4 sm:px-5">
            {fullName ? (
              <>
                <dt className="type-caption text-ink-3">Ime</dt>
                <dd className="type-body-s text-ink-1">{fullName}</dd>
              </>
            ) : null}
            <dt className="type-caption text-ink-3">E-pošta</dt>
            <dd className="break-all type-body-s text-ink-1">{viewer.email ?? "—"}</dd>
            <dt className="type-caption text-ink-3">Telefon</dt>
            <dd className="type-body-s tabular-nums text-ink-1">
              {viewer.phone ? formatPhone(viewer.phone) : "Nije upisan"}
            </dd>
          </dl>
        </Reveal>
        {mechanic ? (
          <Reveal eager index={3}>
            <RouteLink
              href={ROUTES.mechanicPortal}
              className="group flex min-h-20 items-center gap-4 panel card-interactive p-4"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center panel-inset text-ink-2"
              >
                <WrenchIcon size={22} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="type-body font-semibold text-ink-1">Majstorski portal</span>
                <span className="type-caption font-normal text-ink-3">
                  {viewer.mechanicStatus === "approved"
                    ? "Brza porudžbina, cenovnik i vaše cene"
                    : "Status registracije servisa"}
                </span>
              </span>
              <ArrowRightIcon
                size={18}
                aria-hidden="true"
                className="ml-auto shrink-0 text-ink-3 transition-control group-hover:text-ink-1"
              />
            </RouteLink>
          </Reveal>
        ) : null}
      </div>
    </div>
  );
}
