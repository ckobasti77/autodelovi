"use client";

import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { ArrowCounterClockwiseIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinks, site } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/Button";

/**
 * Error boundary content (§G8): what happened in plain words, „Pokušajte ponovo“ (retry),
 * and a way to reach a person. The digest is shown so support can find the server log.
 */
export function ErrorState({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const phone = contactLinks.tel(site.contact.phone);
  return (
    <section className="px-page py-16 lg:py-24" aria-labelledby="error-title">
      <div className="flex max-w-[640px] flex-col gap-5">
        <WarningIcon size={40} aria-hidden="true" className="text-warning" />
        <h1 id="error-title" className="type-h1 text-ink-1">
          Stranica se nije učitala
        </h1>
        <p className="type-body text-ink-2">
          Nešto je pošlo naopako na našoj strani. Pokušajte ponovo&nbsp;— ako se greška ponovi,
          javite nam se i pomoći ćemo vam da nađete deo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onRetry} icon={<ArrowCounterClockwiseIcon size={20} />}>
            Pokušajte ponovo
          </Button>
          <Button variant="secondary" asChild>
            <NextLink href={ROUTES.inquiry}>Pošaljite upit</NextLink>
          </Button>
          {phone ? (
            <Button variant="ghost" asChild>
              <a href={phone.href}>Pozovite {phone.display}</a>
            </Button>
          ) : null}
        </div>
        {digest ? (
          <p className="type-caption font-normal text-ink-3">
            Šifra greške: <code className="type-code text-ink-2">{digest}</code>
          </p>
        ) : null}
      </div>
    </section>
  );
}
