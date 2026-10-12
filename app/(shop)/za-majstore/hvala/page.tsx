import type { Metadata } from "next";
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { contactFromSettings } from "@/lib/settings/public";
import { privateMetadata } from "@/lib/seo/metadata";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { Reveal } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { ApprovalSteps } from "@/components/mechanic/ApprovalSteps";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Registracija primljena");

/**
 * `/za-majstore/hvala` — confirmation after registration (DESIGN-SYSTEM §11.5 copy): what was
 * received and what to do meanwhile on the left, the three steps that follow on the right.
 */
export default async function MechanicThanksPage() {
  const settings = await getSettingsPublic();
  const contacts = contactLinkList(contactFromSettings(settings)).filter(
    (l) => l.channel !== "email",
  );
  return (
    <div className="px-page pb-(--space-section) pt-10 lg:pt-16">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-x-(--gutter)">
        <div className="flex flex-col items-start gap-5 lg:col-span-7">
          <SealCheckIcon size={40} aria-hidden="true" className="text-success" />
          <RevealText as="h1" className="type-display-l uppercase text-ink-1">
            Registracija je primljena
          </RevealText>
          <RevealText as="p" className="max-w-[52ch] type-lead text-ink-2">
            Nalog odobravamo u toku radnog dana; javićemo vam e-poštom. Do tada možete da poručujete
            po maloprodajnim cenama.
          </RevealText>
          <div className="mt-2 flex flex-wrap gap-3" data-reveal="off">
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
            <div className="mt-2 flex flex-col gap-1">
              <RevealText as="p" className="type-body-s text-ink-3">
                Hitno vam treba deo? Javite se odmah.
              </RevealText>
              <ContactActions links={contacts} location="mechanic_thanks" />
            </div>
          ) : null}
        </div>
        <Reveal
          as="aside"
          eager
          aria-label="Posle registracije"
          className="flex flex-col gap-5 panel p-5 sm:p-6 lg:col-span-5 xl:col-span-4 xl:col-start-9"
        >
          <h2 className="type-h4 text-ink-1">Šta sledi</h2>
          <ApprovalSteps />
        </Reveal>
      </div>
    </div>
  );
}
