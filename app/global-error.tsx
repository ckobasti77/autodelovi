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
            className="h-8 w-auto self-start"
          />
          <h1 className="type-h1 text-ink-1">Sajt trenutno ne radi kako treba</h1>
          <p className="max-w-[60ch] type-body text-ink-2">
            Došlo je do greške pri učitavanju. Pokušajte ponovo za nekoliko trenutaka.
          </p>
          <div>
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-11 cursor-pointer items-center rounded-sm bg-accent px-4 type-button text-on-accent transition-control hover:bg-accent-hover focus-ring-inverse"
            >
              Pokušajte ponovo
            </button>
          </div>
          {error.digest ? (
            <p className="type-caption font-normal text-ink-3">
              Šifra greške: <code className="type-code text-ink-2">{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
