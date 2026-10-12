import type { Metadata } from "next";

import { formatPhone } from "@/lib/format/phone";
import { privateMetadata } from "@/lib/seo/metadata";
import { requireAccountPage, viewerNames } from "@/lib/server/auth";
import { ProfileForm } from "@/components/account/AccountViews";
import { SignOutButton } from "@/components/auth/SignInForm";
import { Reveal } from "@/components/reveal/Reveal";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Profil");

/**
 * Profile: the personal data form in the wide column, the way out of the account beside it.
 * The view's name is the H1 of the account layout (`AccountHeading`, A11Y-21).
 */
export default async function AccountProfilePage() {
  const viewer = await requireAccountPage(ROUTES.accountProfile);
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)">
      <div className="lg:col-span-7">
        <ProfileForm
          initial={{
            ...viewerNames(viewer),
            phone: viewer.phone ? formatPhone(viewer.phone) : "",
            email: viewer.email ?? "",
          }}
        />
      </div>
      <Reveal
        as="section"
        eager
        index={1}
        aria-labelledby="signout-title"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 self-start panel p-5 lg:col-span-5 xl:col-span-4 xl:col-start-9"
      >
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <h2 id="signout-title" className="type-h4 text-ink-1">
            Odjava
          </h2>
          <p className="type-body-s text-ink-2">
            Odjavljujete se na ovom uređaju. Porudžbine i sačuvana vozila ostaju na nalogu.
          </p>
        </div>
        <SignOutButton variant="quiet" />
      </Reveal>
    </div>
  );
}
