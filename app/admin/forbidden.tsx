import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/SignInForm";
import { BareShell, NotFoundContent } from "@/components/shell/NotFoundContent";
import { Link } from "@/components/ui/Link";
import { ADMIN, ROUTES } from "@/constants/routes";
import { getViewer } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Nemate pristup" };

/**
 * 403 for the admin (`forbidden()` from the panel guard or an owner-only page): says which account
 * is signed in and offers the way out. `getViewer` is per-request cached and already read by the
 * panel guard, so rendering this boundary costs no extra query (COPY-06, D267).
 */
export default async function AdminForbidden() {
  const viewer = await getViewer();
  const who = viewer?.email ? `Prijavljeni ste kao ${viewer.email}. ` : "";
  const lead = viewer?.isStaff
    ? `${who}Ovaj deo administracije je samo za vlasnika radnje.`
    : `${who}Taj nalog nema pristup administraciji. Ako treba da radite u njoj, vlasnik radnje vam šalje pozivnicu.`;
  return (
    <BareShell>
      <NotFoundContent
        icon={<LockSimpleIcon size={40} aria-hidden="true" className="text-ink-3" />}
        title="Nemate pristup ovoj strani"
        lead={lead}
        aside={
          <div className="flex flex-col items-start gap-4">
            <ul className="flex flex-col gap-2">
              {viewer?.isStaff ? (
                <li>
                  <Link href={ADMIN.home} variant="standalone">
                    Nazad u administraciju
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href={ROUTES.home} variant="standalone">
                  Početna
                </Link>
              </li>
            </ul>
            {viewer ? <SignOutButton /> : null}
          </div>
        }
      />
    </BareShell>
  );
}
