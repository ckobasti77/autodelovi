import { LinkBreakIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { NotFoundContent } from "@/components/shell/NotFoundContent";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

const TITLE = "Link porudžbine nije ispravan";

export const metadata: Metadata = privateMetadata(TITLE);

/** Unknown or mistyped order link (`/porudzbina/<token>`, its pro forma): help, not the parts 404 (FLOW-26). */
export default function OrderLinkNotFound() {
  return (
    <NotFoundContent
      icon={<LinkBreakIcon size={40} aria-hidden="true" className="text-ink-3" />}
      title={TITLE}
      lead="Link je možda nepotpun ili ga je program za poštu prelomio. Otvorite ga ponovo iz e-pošte koju ste dobili posle porudžbine, ili nas kontaktirajte i navedite broj porudžbine (SK-…)."
      aside={
        <ul className="flex flex-col gap-2">
          <li>
            <Link href={ROUTES.contact} variant="standalone">
              Kontakt
            </Link>
          </li>
          <li>
            <Link href={ROUTES.accountOrders} variant="standalone">
              Moje porudžbine (za prijavljene)
            </Link>
          </li>
          <li>
            <Link href={ROUTES.parts} variant="standalone">
              Svi delovi
            </Link>
          </li>
        </ul>
      }
    />
  );
}
