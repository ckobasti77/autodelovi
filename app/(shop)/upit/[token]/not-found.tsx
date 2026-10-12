import { LinkBreakIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";

import { NotFoundContent, StateLinks } from "@/components/shell/NotFoundContent";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

const TITLE = "Link upita nije ispravan";

export const metadata: Metadata = privateMetadata(TITLE);

/** Unknown or mistyped inquiry link (`/upit/<token>`): help, not the parts 404 (FLOW-26). */
export default function InquiryLinkNotFound() {
  return (
    <NotFoundContent
      icon={<LinkBreakIcon size={40} aria-hidden="true" className="text-ink-3" />}
      code="404"
      title={TITLE}
      lead="Link je možda nepotpun ili ga je program za poštu prelomio. Otvorite ga ponovo iz e-pošte koju ste dobili posle slanja upita, ili nas kontaktirajte i navedite broj upita (UP-…)."
      aside={
        <StateLinks
          id="inquiry-link-next"
          title="Kuda dalje"
          links={[
            { href: ROUTES.contact, label: "Kontakt" },
            { href: ROUTES.inquiry, label: "Pošaljite nov upit" },
          ]}
        />
      }
    />
  );
}
