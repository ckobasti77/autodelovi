"use client";

import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { ArrowCounterClockwiseIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinks, site } from "@/config/site";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/Button";

/**
 * Error boundary content (§G8): what happened in plain words, „Pokušajte ponovo“ (retry),
 * and a way to reach a person. The digest is shown so support can find the server log. Same
 * composition as the 404 (`NotFoundContent`): the drawing frame with the code in mono, the
 * title, one sentence, the next steps — left-aligned, inside the shop header and footer.
 */
export function ErrorState({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const phone = contactLinks.tel(site.contact.phone);
  return (
    <section className="px-page py-12 lg:py-20" aria-labelledby="error-title">
      <div className="flex max-w-[640px] flex-col gap-5">
        <div aria-hidden="true" className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center gap-4 text-warning">
          <WarningIcon size={40} />
          <span className="font-mono text-[1.75rem] leading-none font-medium tracking-[0.04em] text-ink-2 tabular-nums">500</span>
        </div>
        <h1 id="error-title" className="type-h1 text-ink-1">
          Stranica se nije učitala
        </h1>
        <p className="type-body text-ink-2">
          Nešto je pošlo naopako na našoj strani. Pokušajte ponovo&nbsp;— ako se greška ponovi,
          javite nam se i pomoći ćemo vam da nađete deo.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
          <p className="self-start panel-inset px-3 py-2 type-caption font-normal text-ink-3">
            Šifra greške: <code className="type-code text-ink-1">{digest}</code>
          </p>
        ) : null}
      </div>
    </section>
  );
}
