import type { Metadata } from "next";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { ROUTES } from "@/constants/routes";
import { SearchBox } from "@/components/shell/SearchBox";
import { SiteShell } from "@/components/shell/SiteShell";
import { Link } from "@/components/ui/Link";

export const metadata: Metadata = {
  title: "Stranica nije pronađena",
  robots: { index: false, follow: true },
};

/** Global 404 (§G8): search first, then the ways in — catalog and the inquiry. */
export default function NotFound() {
  return (
    <SiteShell>
      <section className="px-page py-16 lg:py-24" aria-labelledby="nf-title">
        <div className="flex max-w-[640px] flex-col gap-5">
          <MagnifyingGlassIcon size={40} aria-hidden="true" className="text-ink-3" />
          <h1 id="nf-title" className="type-h1 text-ink-1">
            Stranica nije pronađena
          </h1>
          <p className="type-body text-ink-2">
            Adresa je možda promenjena ili deo više nije u ponudi. Potražite ga po broju ili
            nazivu&nbsp;— ili nam pošaljite upit, pa ćemo ga naći umesto vas.
          </p>
          <SearchBox variant="hero" className="mt-2" />
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href={ROUTES.parts} variant="standalone">
                Svi delovi
              </Link>
            </li>
            <li>
              <Link href={ROUTES.inquiry} variant="standalone">
                Pošaljite upit po broju šasije
              </Link>
            </li>
            <li>
              <Link href={ROUTES.home} variant="standalone">
                Početna
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </SiteShell>
  );
}
