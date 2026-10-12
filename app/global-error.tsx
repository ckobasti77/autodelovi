"use client";

/**
 * Last-resort error page: replaces the root layout, so it brings its own document, styles
 * and fonts (Next 16 global-error). Kept minimal and dependency-light — the app may be
 * broken when this renders.
 */
import { useEffect } from "react";

import "./globals.css";

import { fontVariables } from "@/lib/fonts";
import { site } from "@/config/site";

export default function GlobalError({
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
    <html lang={site.locale} className={fontVariables}>
      <body>
        <title>{`Greška · ${site.brand.name}`}</title>
        <main className="flex min-h-dvh flex-col justify-center gap-5 px-page py-16">
          {/* The kit file, not the inline component: this chunk loads with every page, and the
              logo outlines would add 3 KB of script to all of them. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG; next/image adds nothing here and this page must not depend on the image optimizer */}
          <img
            src="/brand/logo-header-night.svg"
            alt={site.brand.name}
            width={270}
            height={32}
            className="mb-6 h-8 w-auto self-start"
          />
          <div aria-hidden="true" className="corner-ticks flex h-28 w-full max-w-60 items-center justify-center gap-4">
            <span className="font-mono text-[1.75rem] leading-none font-medium tracking-[0.04em] text-ink-2 tabular-nums">500</span>
          </div>
          <h1 className="type-h1 text-ink-1">Sajt trenutno ne radi kako treba</h1>
          <p className="max-w-[60ch] type-body text-ink-2">
            Došlo je do greške pri učitavanju. Pokušajte ponovo za nekoliko trenutaka.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-sm bg-accent px-4 type-button text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.24)] transition-control hover:bg-accent-hover active:translate-y-px active:shadow-none focus-ring-inverse"
            >
              Pokušajte ponovo
            </button>
            {/* A plain anchor: a full load is the way out when the app itself is what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the router may be what failed */}
            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-sm border border-control px-4 type-button text-ink-1 transition-control hover:border-ink-3 hover:bg-surface-2 active:translate-y-px"
            >
              Početna
            </a>
          </div>
          {error.digest ? (
            <p className="self-start panel-inset px-3 py-2 type-caption font-normal text-ink-3">
              Šifra greške: <code className="type-code text-ink-1">{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
