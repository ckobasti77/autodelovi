import { LinkBreakIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { NotFoundContent, StateLinks } from "@/components/shell/NotFoundContent";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

const TITLE = "Link porudžbine nije ispravan";

export const metadata: Metadata = privateMetadata(TITLE);

/** Unknown or mistyped order link (`/porudzbina/<token>`, its pro forma): help, not the parts 404 (FLOW-26). */
export default function OrderLinkNotFound() {
  return (
    <NotFoundContent
      icon={<LinkBreakIcon size={40} aria-hidden="true" className="text-ink-3" />}
      code="404"
      title={TITLE}
      lead="Link je možda nepotpun ili ga je program za poštu prelomio. Otvorite ga ponovo iz e-pošte koju ste dobili posle porudžbine, ili nas kontaktirajte i navedite broj porudžbine (SK-…)."
      aside={
        <StateLinks
          id="order-link-next"
          title="Šta možete"
          links={[
            { href: ROUTES.contact, label: "Kontakt" },
            { href: ROUTES.accountOrders, label: "Moje porudžbine (za prijavljene)" },
            { href: ROUTES.parts, label: "Svi delovi" },
          ]}
        />
      }
    />
  );
}
