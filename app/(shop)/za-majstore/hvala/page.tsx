import type { Metadata } from "next";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { contactFromSettings } from "@/lib/settings/public";
import { privateMetadata } from "@/lib/seo/metadata";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Registracija primljena");

/** `/za-majstore/hvala` — confirmation after registration (DESIGN-SYSTEM §11.5 copy). */
export default async function MechanicThanksPage() {
  const settings = await getSettingsPublic();
  const contacts = contactLinkList(contactFromSettings(settings)).filter((l) => l.channel !== "email");
  return (
    <div className="px-page pb-(--space-section) pt-10 lg:pt-16">
      <div className="flex max-w-[44rem] flex-col items-start gap-5">
        <SealCheckIcon size={40} aria-hidden="true" className="text-success" />
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Registracija je primljena
        </RevealText>
        <RevealText as="p" className="type-lead text-ink-2">
          Nalog odobravamo u toku radnog dana; stići će vam e-mail. Do tada možete da poručujete po maloprodajnim cenama.
        </RevealText>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={ROUTES.mechanicPortal} variant="unstyled">
              Status naloga
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={ROUTES.parts} variant="unstyled">
              Pretražite delove
            </Link>
          </Button>
        </div>
        {contacts.length ? (
          <>
            <p className="mt-4 type-body-s text-ink-3">Hitno vam treba deo? Javite se odmah.</p>
            <ContactActions links={contacts} location="mechanic_thanks" />
          </>
        ) : null}
      </div>
    </div>
  );
}
