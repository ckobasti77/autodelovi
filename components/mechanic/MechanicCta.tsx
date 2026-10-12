"use client";

/**
 * `/za-majstore` calls to action: „Registrujte servis“ + „Prijavite se“ for visitors; the
 * portal link for accounts that already have a mechanic profile. The page stays cacheable —
 * the viewer is read on the client.
 */
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { isMechanicViewer, useViewer } from "@/lib/auth/useViewer";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

export function MechanicCta() {
  const viewer = useViewer();
  if (isMechanicViewer(viewer)) {
    return (
      <div className="flex flex-wrap items-center gap-3" data-reveal="off">
        <Button asChild size="lg" trailingIcon={<ArrowRightIcon size={16} />}>
          <Link href={ROUTES.mechanicPortal} variant="unstyled">
            Majstorski portal
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3" data-reveal="off">
      <Button asChild size="lg">
        <Link href={ROUTES.mechanicsRegister} variant="unstyled">
          Registrujte servis
        </Link>
      </Button>
      {viewer ? null : (
        <Button asChild variant="secondary" size="lg">
          <Link
            href={`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.mechanicPortal)}`}
            variant="unstyled"
          >
            Prijavite se
          </Link>
        </Button>
      )}
    </div>
  );
}

/**
 * The closing step of the landing: one sentence and the same actions as the hero, so a visitor
 * who read to the end does not have to scroll back. The sentence follows the viewer too.
 */
export function MechanicCtaBand() {
  const viewer = useViewer();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 panel-raised p-5 sm:p-6">
      <p className="max-w-[44ch] type-body text-ink-1">
        {isMechanicViewer(viewer)
          ? "Vaš servis je već registrovan — brza porudžbina i cenovnik su u portalu."
          : "Registracija traje pet minuta, a odgovor stiže e-poštom u toku radnog dana."}
      </p>
      <MechanicCta />
    </div>
  );
}
