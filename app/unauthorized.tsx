import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { BareShell, NotFoundContent } from "@/components/shell/NotFoundContent";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata("Potrebna je prijava");

/**
 * 401 for `unauthorized()`. Account areas normally redirect to /prijava (proxy + `lib/server/auth`),
 * so this is the fallback that keeps Next's English default from ever showing (COPY-06, D267).
 */
export default function Unauthorized() {
  return (
    <BareShell>
      <NotFoundContent
        icon={<LockSimpleIcon size={40} aria-hidden="true" className="text-ink-3" />}
        title="Potrebna je prijava"
        lead="Ova strana je dostupna samo prijavljenim korisnicima. Prijavite se, pa nastavite gde ste stali."
        aside={
          <ul className="flex flex-col gap-2">
            <li>
              <Link href={ROUTES.signIn} variant="standalone">
                Prijava
              </Link>
            </li>
            <li>
              <Link href={ROUTES.home} variant="standalone">
                Početna
              </Link>
            </li>
          </ul>
        }
      />
    </BareShell>
  );
}
