import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { contactLinkList } from "@/config/site";
import { contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { Reveal } from "@/components/reveal/Reveal";
import { ContactActions } from "@/components/shell/ContactActions";
import { ROUTES } from "@/constants/routes";

/** The shop's documents, in the order of the footer. */
const DOCUMENTS = [
  { href: ROUTES.delivery, label: "Dostava i plaćanje" },
  { href: ROUTES.returns, label: "Reklamacije i povrat" },
  { href: ROUTES.terms, label: "Uslovi korišćenja" },
  { href: ROUTES.privacy, label: "Politika privatnosti" },
  { href: ROUTES.cookies, label: "Kolačići" },
] as const;

/**
 * Right column of a content page (under the text on phones): the next step for someone who
 * has read it, and the other documents. `inquiry` offers the VIN inquiry (about, delivery);
 * `contact` points to the contact page (complaints, terms, privacy, cookies). Channels come
 * from settings and are simply absent while the owner has not entered them.
 */
export async function ContentAside({
  current,
  step = "inquiry",
}: {
  /** Path of the page it stands on: that document is marked, not linked. */
  current: string;
  step?: "inquiry" | "contact";
}) {
  const settings = await getSettingsPublic();
  const links = contactLinkList(contactFromSettings(settings));
  return (
    <aside
      aria-label="Sledeći korak"
      className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"
    >
      <Reveal as="section" eager className="flex flex-col gap-4 panel p-5">
        {step === "inquiry" ? (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="type-h4 text-ink-1">Ne nalazite deo?</h2>
              <p className="type-body-s text-ink-2">
                Pošaljite broj šasije i šta vam treba — javljamo se sa ponudom u toku radnog dana.
              </p>
            </div>
            <Button asChild variant="primary" className="w-full sm:w-auto sm:self-start">
              <Link href={ROUTES.inquiry} variant="unstyled">
                Pošaljite upit
              </Link>
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h2 className="type-h4 text-ink-1">Imate pitanje?</h2>
              <p className="type-body-s text-ink-2">
                Javite nam se i navedite broj porudžbine ili upita, ako ga imate.
              </p>
            </div>
            <Button asChild variant="secondary" className="w-full sm:w-auto sm:self-start">
              <Link href={ROUTES.contact} variant="unstyled">
                Kontakt
              </Link>
            </Button>
          </>
        )}
        {links.length ? (
          <ContactActions
            links={links}
            location="content_aside"
            className="border-t border-line pt-3"
          />
        ) : null}
      </Reveal>
      <Reveal
        as="nav"
        eager
        index={1}
        aria-labelledby="content-documents"
        className="overflow-hidden panel"
      >
        <h2 id="content-documents" className="px-5 pt-4 pb-2 type-label uppercase text-ink-3">
          Kupovina i pravila
        </h2>
        <ul className="flex flex-col">
          {DOCUMENTS.map((d) => (
            <li key={d.href} className="border-t border-line-faint">
              {d.href === current ? (
                <span
                  aria-current="page"
                  className="flex min-h-11 items-center gap-2.5 px-5 type-body-s font-semibold text-ink-1"
                >
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
                  {d.label}
                </span>
              ) : (
                <RouteLink
                  href={d.href}
                  className="flex min-h-11 items-center justify-between gap-3 px-5 type-body-s text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 focus-ring-inset"
                >
                  {d.label}
                  <CaretRightIcon size={14} aria-hidden="true" className="shrink-0 text-ink-3" />
                </RouteLink>
              )}
            </li>
          ))}
        </ul>
      </Reveal>
    </aside>
  );
}
