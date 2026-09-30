import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { ROUTES } from "@/constants/routes";
import { SearchBox } from "@/components/shell/SearchBox";
import { Link } from "@/components/ui/Link";
import { HeroVehicleField } from "@/components/vehicle/VehicleBindings";

const POPULAR = [
  { slug: "kocione-plocice", label: "Kočione pločice" },
  { slug: "kocioni-diskovi", label: "Kočioni diskovi" },
  { slug: "amortizeri-opruge", label: "Amortizeri i opruge" },
  { slug: "zupcasti-kais-vodena-pumpa", label: "Zupčasti kaiš i vodena pumpa" },
  { slug: "filteri", label: "Filteri" },
  { slug: "turbina", label: "Turbina" },
];

/** 404 content (§G8): search first, the vehicle, popular categories and the inquiry. */
export function NotFoundContent() {
  return (
    <section className="px-page py-16 lg:py-24" aria-labelledby="nf-title">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex max-w-[640px] flex-col gap-5 lg:col-span-7">
          <MagnifyingGlassIcon size={40} aria-hidden="true" className="text-ink-3" />
          <h1 id="nf-title" className="type-h1 text-ink-1">
            Stranica nije pronađena
          </h1>
          <p className="type-body text-ink-2">
            Adresa je možda promenjena ili deo više nije u ponudi. Potražite ga po broju ili
            nazivu&nbsp;— ili nam pošaljite upit, pa ćemo ga naći umesto vas.
          </p>
          <SearchBox variant="hero" className="mt-2" />
          <HeroVehicleField />
        </div>
        <nav aria-labelledby="nf-popular" className="lg:col-span-4 lg:col-start-9">
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
      </div>
    </section>
  );
}
