import { LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { BareShell, NotFoundContent } from "@/components/shell/NotFoundContent";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata("Nemate pristup");

/**
 * 403 for `forbidden()` outside the admin (a blocked account in /nalog or /majstor). Static and
 * server-only: Next serializes this file into every RSC payload, so it reads no viewer data
 * (the sign-in page shows who is signed in and offers „Odjavi se“). COPY-06, D267.
 */
export default function Forbidden() {
  return (
    <BareShell>
      <NotFoundContent
        icon={<LockSimpleIcon size={40} aria-hidden="true" className="text-ink-3" />}
        title="Nemate pristup ovoj strani"
        lead="Nalog kojim ste prijavljeni nema dozvolu za ovaj deo sajta. Ako mislite da je to greška, pozovite nas ili pišite, pa ćemo proveriti nalog."
        aside={
          <ul className="flex flex-col gap-2">
            <li>
              <Link href={ROUTES.home} variant="standalone">
                Početna
              </Link>
            </li>
            <li>
              <Link href={ROUTES.signIn} variant="standalone">
                Prijava drugim nalogom
              </Link>
            </li>
            <li>
              <Link href={ROUTES.contact} variant="standalone">
                Kontakt
              </Link>
            </li>
          </ul>
        }
      />
    </BareShell>
  );
}
