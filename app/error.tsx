"use client";

import { useEffect } from "react";

import { RouteLink as Link } from "@/components/ui/RouteLink";

/**
 * Error boundary for routes outside the shop group (ads landing, styleguide, admin fallback).
 * Plain markup on purpose: Next loads this boundary on every page, and the UI kit / site config it
 * used to import were shipped a second time through its chunk (PERF-20). The shop keeps the full
 * `ErrorState` in `app/(shop)/error.tsx`. `main#sadrzaj` matches `MAIN_ID` for the skip link.
 * Same composition as there, drawn with classes only: frame with corner ticks, the code in mono.
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
      <section className="px-page py-12 lg:py-20" aria-labelledby="error-title">
        <div className="flex max-w-[640px] flex-col gap-5">
          <div aria-hidden="true" className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center gap-4">
            <span className="font-mono text-[1.75rem] leading-none font-medium tracking-[0.04em] text-ink-2 tabular-nums">500</span>
          </div>
          <h1 id="error-title" className="type-h1 text-ink-1">
            Stranica se nije učitala
          </h1>
          <p className="type-body text-ink-2">
            Nešto je pošlo naopako na našoj strani. Pokušajte ponovo&nbsp;— ako se greška ponovi,
            pošaljite nam upit i pomoći ćemo vam da nađete deo.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-sm bg-accent px-4 type-button text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.24)] transition-control hover:bg-accent-hover active:translate-y-px active:shadow-none focus-ring-inverse"
            >
              Pokušajte ponovo
            </button>
            <Link
              href="/upit"
              className="inline-flex h-11 items-center justify-center rounded-sm border border-control px-4 type-button text-ink-1 transition-control hover:border-ink-3 hover:bg-surface-2 active:translate-y-px"
            >
              Pošaljite upit
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-sm px-4 type-button text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 active:translate-y-px"
            >
              Početna
            </Link>
          </div>
          {error.digest ? (
            <p className="self-start panel-inset px-3 py-2 type-caption font-normal text-ink-3">
              Šifra greške: <code className="type-code text-ink-1">{error.digest}</code>
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
