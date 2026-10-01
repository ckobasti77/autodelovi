"use client";

import { useEffect } from "react";

import { RouteLink as Link } from "@/components/ui/RouteLink";

/**
 * Error boundary for routes outside the shop group (ads landing, styleguide, admin fallback).
 * Plain markup on purpose: Next loads this boundary on every page, and the UI kit / site config it
 * used to import were shipped a second time through its chunk (PERF-20). The shop keeps the full
 * `ErrorState` in `app/(shop)/error.tsx`. `main#sadrzaj` matches `MAIN_ID` for the skip link.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="sadrzaj" tabIndex={-1} className="outline-none">
      <section className="px-page py-16 lg:py-24" aria-labelledby="error-title">
        <div className="flex max-w-[640px] flex-col gap-5">
          <h1 id="error-title" className="type-h1 text-ink-1">
            Stranica se nije učitala
          </h1>
          <p className="type-body text-ink-2">
            Nešto je pošlo naopako na našoj strani. Pokušajte ponovo&nbsp;— ako se greška ponovi,
            pošaljite nam upit i pomoći ćemo vam da nađete deo.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xs bg-accent px-4 type-button text-on-accent transition-control hover:bg-accent-hover focus-ring-inverse"
            >
              Pokušajte ponovo
            </button>
            <Link
              href="/upit"
              className="inline-flex h-11 items-center justify-center rounded-xs border border-control px-4 type-button text-ink-1 transition-control hover:border-ink-3 hover:bg-surface-2"
            >
              Pošaljite upit
            </Link>
          </div>
          {error.digest ? (
            <p className="type-caption font-normal text-ink-3">
              Šifra greške: <code className="type-code text-ink-2">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
