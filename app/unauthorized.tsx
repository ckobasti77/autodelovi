import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { BareShell, NotFoundContent, StateLinks } from "@/components/shell/NotFoundContent";
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
        code="401"
        title="Potrebna je prijava"
        lead="Ova strana je dostupna samo prijavljenim korisnicima. Prijavite se, pa nastavite gde ste stali."
        aside={
          <StateLinks
            id="unauthorized-next"
            title="Kuda dalje"
            links={[
              { href: ROUTES.signIn, label: "Prijava" },
              { href: ROUTES.home, label: "Početna" },
            ]}
          />
        }
      />
    </BareShell>
  );
}
