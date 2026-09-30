import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { Link } from "@/components/ui/Link";
import { OrdersList, SavedVehicles } from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Moj nalog");

export default async function AccountPage() {
  await requireAccountPage(ROUTES.account);
  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <section aria-labelledby="recent-title" className="lg:col-span-7">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="recent-title" className="type-h3 text-ink-1">
            Poslednje porudžbine
          </h2>
          <Link href={ROUTES.accountOrders} variant="standalone" className="type-body-s">
            Sve
          </Link>
        </div>
        <OrdersList limit={5} />
      </section>
      <section aria-labelledby="veh-title" className="lg:col-span-5">
        <h2 id="veh-title" className="mb-4 type-h3 text-ink-1">
          Vozila
        </h2>
        <SavedVehicles />
      </section>
    </div>
  );
}
