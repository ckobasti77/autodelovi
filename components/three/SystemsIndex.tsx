import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { CATEGORIES_BY_SYSTEM } from "@/lib/three/stages";
import { categoryImage } from "@/lib/catalog/types";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { ROUTES } from "@/constants/routes";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";

/**
 * „Delovi po sistemima“ (contract F8): the server-rendered, no-JS and search-engine equivalent
 * of the 3D car — every category as a link, grouped by system in the car's order.
 *
 * One panel per system: its render, its name (a link to the system hub), what it holds, and
 * its categories as chips. Panels flow in balanced columns, so a system with thirteen
 * categories does not leave a hole beside one with two, and on a phone the 44 links take a
 * third of the height they took as a plain list (UI-BOOST §7.4).
 */
export function SystemsIndex({
  counts,
}: {
  /** Products per category slug (from the category tree); totals are omitted without it. */
  counts?: Readonly<Record<string, number>>;
}) {
  return (
    <section aria-labelledby="systems-title" className="border-t border-line px-page py-section">
      <h2 id="systems-title" className="type-display-l text-ink-1">
        {HERO_COPY.systemsSection}
      </h2>
      <RevealGroup className="mt-block columns-1 gap-x-(--gutter) md:columns-2 xl:columns-3">
        {CATEGORIES_BY_SYSTEM.map(({ system, categories }) => {
          const products = counts ? categories.reduce((n, c) => n + (counts[c.slug] ?? 0), 0) : 0;
          return (
            <RevealItem
              key={system.slug}
              className="mb-3 break-inside-avoid panel p-4 sm:mb-(--gutter) sm:p-5"
            >
              <div className="group relative flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_45%,var(--color-surface-4),var(--color-surface-2)_72%)]"
                >
                  {categories[0] ? (
                    <Image
                      src={categoryImage(categories[0].slug)}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-contain p-1"
                    />
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3 className="type-h4 text-ink-1">
                    <RouteLink
                      href={ROUTES.category(system.slug)}
                      className="rounded-xs outline-none after:absolute after:inset-0 after:rounded-sm after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                    >
                      {system.labelSr}
                    </RouteLink>
                  </h3>
                  <p className="type-caption font-normal text-ink-3">
                    <span className="tabular-nums">{formatNumber(categories.length)}</span>{" "}
                    {pluralSr(categories.length, ["kategorija", "kategorije", "kategorija"])}
                    {products > 0 ? (
                      <>
                        {" · "}
                        <span className="tabular-nums">{formatNumber(products)}</span>{" "}
                        {pluralSr(products, ["artikal", "artikla", "artikala"])}
                      </>
                    ) : null}
                  </p>
                </div>
                <ArrowRightIcon
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-ink-3 transition-[color,translate] duration-200 ease-sk-out hover-hover:group-hover:translate-x-0.5 hover-hover:group-hover:text-accent"
                />
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={ROUTES.category(c.slug)} variant="unstyled" className="chip-link">
                      {c.labelSr}
                    </Link>
                  </li>
                ))}
              </ul>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </section>
  );
}
