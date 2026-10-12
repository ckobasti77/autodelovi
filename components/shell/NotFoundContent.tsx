import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { BrandLink } from "@/components/brand/BrandLink";
import { Reveal } from "@/components/reveal/Reveal";
import { MAIN_ID } from "@/components/shell/SkipLink";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { findCategory } from "@/lib/catalog/taxonomy";

export const NOT_FOUND_TITLE = "Stranica nije pronađena";

const NOT_FOUND_LEAD =
  "Adresa je možda promenjena ili deo više nije u ponudi. Potražite ga po broju ili nazivu — ili nam pošaljite upit, pa ćemo ga naći umesto vas.";

const POPULAR_SLUGS = [
  "kocione-plocice",
  "kocioni-diskovi",
  "amortizeri-opruge",
  "zupcasti-kais-vodena-pumpa",
  "filteri",
  "turbina",
] as const;

/** Labels straight from the taxonomy, so the links read like the category pages they open. */
const POPULAR = POPULAR_SLUGS.flatMap((slug) => {
  const category = findCategory(slug);
  return category ? [{ href: ROUTES.category(slug), label: category.labelSr }] : [];
});

/**
 * Status page content (§G8) in the „Rendgen“ world: a drawing frame with corner ticks holding
 * the glyph and the status code in mono, the title, one sentence, and real next steps — the
 * search, then where to go. Left-aligned like the pages around it; never a dead end.
 *
 * Server-only and lean on purpose: Next serializes the 404, 403 and 401 boundaries into the RSC
 * payload of every page, and lists the root `app/not-found.tsx` in every route's client
 * manifest. So the interactive search (and the vehicle field) come in through `search` from the
 * shop 404 only (PERF-13, D266), the copy is plain markup inside one eager block (visible from
 * the first paint, no per-word spans) and the rows draw their arrow in CSS.
 */
export function NotFoundContent({
  icon = <MagnifyingGlassIcon size={40} aria-hidden="true" className="text-ink-3" />,
  code,
  title = NOT_FOUND_TITLE,
  lead = NOT_FOUND_LEAD,
  search,
  aside,
}: {
  /** 40 px decorative glyph in the drawing frame. */
  icon?: ReactNode;
  /** Status code beside the glyph, in mono („404“, „403“). */
  code?: string;
  title?: string;
  lead?: ReactNode;
  /** The live `SearchBox` (+ vehicle field) in the shop; `NotFoundSearchForm` elsewhere. */
  search?: ReactNode;
  /** Replaces the popular-categories column (order links, 403 pages have their own help). */
  aside?: ReactNode;
}) {
  return (
    <section className="px-page py-12 lg:py-20" aria-labelledby="nf-title">
      <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex max-w-[640px] flex-col gap-5 lg:col-span-7">
          <Reveal eager className="flex flex-col gap-5">
            <StateFrame icon={icon} code={code} />
            <h1 id="nf-title" className="type-h1 text-ink-1">
              {title}
            </h1>
            <p className="type-body text-ink-2">{lead}</p>
          </Reveal>
          {search}
        </div>
        <div className="lg:col-span-4 lg:col-start-9">{aside ?? <PopularCategories />}</div>
      </div>
    </section>
  );
}

/**
 * Drawing frame of a status page (§5.7, §9.19): corner ticks around the glyph and the code. A
 * drawing, so it stays square; decorative, so it is hidden from assistive technology — the
 * title says what happened.
 */
function StateFrame({ icon, code }: { icon: ReactNode; code?: string }) {
  return (
    <div
      aria-hidden="true"
      className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center gap-4 text-ink-3"
    >
      {icon}
      {code ? (
        <span className="font-mono text-[1.75rem] leading-none font-medium tracking-[0.04em] text-ink-2 tabular-nums">
          {code}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Next steps of a status page as one panel of rows (44 px, the whole row is the link), with
 * optional standalone links under them. The default aside lists popular categories; the 401,
 * 403 and broken-link pages pass their own.
 */
export function StateLinks({
  id,
  title,
  links,
  more = [],
}: {
  /** Unique id for the heading that names the navigation. */
  id: string;
  title: string;
  links: { href: string; label: string }[];
  more?: { href: string; label: string }[];
}) {
  return (
    <Reveal as="nav" eager index={1} aria-labelledby={id} className="overflow-hidden panel">
      <h2 id={id} className="px-4 pt-4 pb-2 type-label uppercase text-ink-3 sm:px-5">
        {title}
      </h2>
      <ul className="flex flex-col">
        {links.map((l) => (
          <li key={l.href} className="border-t border-line-faint">
            <RouteLink
              href={l.href}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 type-body-s text-ink-1 transition-control after:text-ink-3 after:content-['→'] hover:bg-surface-2 hover:after:text-accent focus-ring-inset sm:px-5"
            >
              {l.label}
            </RouteLink>
          </li>
        ))}
      </ul>
      {more.length ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line px-4 py-2 sm:px-5">
          {more.map((l) => (
            <li key={l.href}>
              <Link href={l.href} variant="standalone" className="min-h-11 type-body-s">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Reveal>
  );
}

function PopularCategories() {
  return (
    <StateLinks
      id="nf-popular"
      title="Često tražene kategorije"
      links={POPULAR}
      more={[
        { href: ROUTES.parts, label: "Svi delovi" },
        { href: ROUTES.inquiry, label: "Pošaljite upit" },
        { href: ROUTES.contact, label: "Kontakt" },
      ]}
    />
  );
}

/**
 * The search as a plain GET form to `/pretraga`: works before (and without) JavaScript and adds
 * no client code. The field mirrors `Input` size `xl` (a client module, so its classes cannot be
 * imported here) and the hero `SearchBox`.
 */
export function NotFoundSearchForm() {
  return (
    <form role="search" action={ROUTES.search} method="get" className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label
          className={
            "flex h-14 w-full min-w-0 items-center gap-2 rounded-sm sm:flex-1 border border-control bg-surface-2 px-3 text-ink-1 " +
            "transition-control hover:border-ink-3 focus-within:border-focus focus-within:shadow-[inset_0_0_0_1px_var(--color-focus)] focus-within:hover:border-focus"
          }
        >
          <MagnifyingGlassIcon size={20} aria-hidden="true" className="shrink-0 text-ink-3" />
          <span className="sr-only">Broj dela ili naziv</span>
          <input
            type="search"
            name="q"
            required
            autoComplete="off"
            enterKeyHint="search"
            placeholder="npr. 1K0 615 301 AA ili kočione pločice"
            className="h-full min-w-0 flex-1 bg-transparent text-[1rem] leading-normal text-inherit outline-none placeholder:text-ink-3 focus-visible:outline-none"
          />
        </label>
        <Button type="submit" size="xl" className="sm:w-auto">
          Pretraži
        </Button>
      </div>
    </form>
  );
}

/**
 * Self-contained frame (logo header + `main`) for status pages rendered outside any route
 * group layout: the root 404, 403 and 401. No client islands (see `NotFoundContent`).
 */
export function BareShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header data-reveal="off" className="border-b border-line bg-bg print:hidden">
        <div className="flex h-header items-center px-page">
          <BrandLink />
        </div>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
    </div>
  );
}
