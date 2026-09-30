import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage } from "@/lib/server/auth";
import { ProfileForm } from "@/components/account/AccountViews";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Profil");

export default async function AccountProfilePage() {
  const viewer = await requireAccountPage(ROUTES.accountProfile);
  return (
    <ProfileForm
      initial={{
        firstName: viewer.firstName ?? "",
        lastName: viewer.lastName ?? "",
        phone: viewer.phone ?? "",
        email: viewer.email ?? "",
      }}
    />
  );
}
