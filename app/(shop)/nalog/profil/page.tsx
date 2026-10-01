import type { Metadata } from "next";

import { formatPhone } from "@/lib/format/phone";
import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage, viewerNames } from "@/lib/server/auth";
import { ProfileForm } from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Profil");

export default async function AccountProfilePage() {
  const viewer = await requireAccountPage(ROUTES.accountProfile);
  return (
    <>
      {/* The tab label as this view's heading under the shared „Moj nalog“ h1 (A11Y-21). */}
      <h2 className="sr-only" data-reveal="off">
        Profil
      </h2>
      <ProfileForm
        initial={{
          ...viewerNames(viewer),
          phone: viewer.phone ? formatPhone(viewer.phone) : "",
          email: viewer.email ?? "",
        }}
      />
    </>
  );
}
