import type { Metadata } from "next";

import { requireAccountPage } from "@/lib/server/auth";
import { RevealText } from "@/components/text-reveal/RevealText";
import { AccountNav } from "@/components/account/AccountNav";
import { SignOutButton } from "@/components/auth/SignInForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Customer account (ROUTES §B1): proxy redirect + this server guard; Convex re-checks. */
export default async function AccountLayout({ children }: LayoutProps<"/nalog">) {
  const viewer = await requireAccountPage(ROUTES.account);
  const name = viewer.firstName ?? viewer.name ?? viewer.email ?? "Nalog";
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="p" className="type-body-s text-ink-3">
        {`Prijavljeni ste kao ${viewer.email ?? name}`}
      </RevealText>
      <h1 className="mt-1 type-h1 text-ink-1" data-reveal="off">
        Moj nalog
      </h1>
      <div className="mt-6">
        <AccountNav />
      </div>
      <div className="mt-8">{children}</div>
      <div className="mt-12 border-t border-line pt-6 lg:hidden" data-reveal="off">
        <SignOutButton />
      </div>
    </div>
  );
}
