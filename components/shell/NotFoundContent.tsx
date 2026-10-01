import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import { Link } from "@/components/ui/Link";
import { findCategory } from "@/lib/catalog/taxonomy";

export const NOT_FOUND_TITLE = "Stranica nije pronađena";

const NOT_FOUND_LEAD =
  "Adresa je možda promenjena ili deo više nije u ponudi. Potražite ga po broju ili nazivu — ili nam pošaljite upit, pa ćemo ga naći umesto vas.";

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
  return category ? [{ slug, label: category.labelSr }] : [];
});

/**
 * 404 content (§G8): search first, then popular categories and the inquiry. Server-only on
 * purpose: the root `app/not-found.tsx` is part of every route's client manifest and RSC payload,
 * so the interactive search (and the vehicle field) come in through `search` from the shop 404
 * only (PERF-13, D261).
 */
export function NotFoundContent({
  title = NOT_FOUND_TITLE,
  lead = NOT_FOUND_LEAD,
  search,
  aside,
}: {
  title?: string;
  lead?: ReactNode;
  /** The live `SearchBox` (+ vehicle field) in the shop; `NotFoundSearchForm` elsewhere. */
  search?: ReactNode;
  /** Replaces the popular-categories column (order and inquiry links have their own help). */
  aside?: ReactNode;
}) {
  return (
    <section className="px-page py-16 lg:py-24" aria-labelledby="nf-title">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex max-w-[640px] flex-col gap-5 lg:col-span-7">
          <MagnifyingGlassIcon size={40} aria-hidden="true" className="text-ink-3" />
          <h1 id="nf-title" className="type-h1 text-ink-1">
            {title}
          </h1>
          <p className="type-body text-ink-2">{lead}</p>
          {search}
        </div>
        <div className="lg:col-span-4 lg:col-start-9">{aside ?? <PopularCategories />}</div>
      </div>
    </section>
  );
}

function PopularCategories() {
  return (
    <nav aria-labelledby="nf-popular">
      <h2 id="nf-popular" className="type-label uppercase text-ink-3">
        Često tražene kategorije
      </h2>
      <ul className="mt-3 flex flex-col">
        {POPULAR.map((c) => (
          <li key={c.slug} className="border-b border-line">
            <Link href={ROUTES.category(c.slug)} variant="quiet" className="flex min-h-11 items-center">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <Link href={ROUTES.parts} variant="standalone">
            Svi delovi
          </Link>
        </li>
        <li>
          <Link href={ROUTES.inquiry} variant="standalone">
            Pošaljite upit
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/**
 * The search as a plain GET form to `/pretraga`: works before (and without) JavaScript and adds
 * no client code. Field styling mirrors `Input` size `xl` and the hero `SearchBox`.
 */
export function NotFoundSearchForm() {
  return (
    <form role="search" action={ROUTES.search} method="get" className="mt-2 flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label
          className={
            "flex h-14 w-full min-w-0 flex-1 items-center gap-2 rounded-xs border border-control bg-surface-2 px-3 text-ink-1 " +
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
        <button
          type="submit"
          className="inline-flex h-14 cursor-pointer items-center justify-center rounded-xs bg-accent px-6 type-button text-on-accent transition-control hover:bg-accent-hover"
        >
          Pretraži
        </button>
      </div>
    </form>
  );
}
