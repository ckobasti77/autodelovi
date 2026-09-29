import { CATEGORIES_BY_SYSTEM } from "@/lib/three/stages";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { ROUTES } from "@/constants/routes";
import { Link } from "@/components/ui/Link";

/**
 * „Delovi po sistemima“ (contract F8): the server-rendered, no-JS and search-engine equivalent
 * of the 3D car — every category as a link, grouped by system in the car's order.
 */
export function SystemsIndex() {
  return (
    <section aria-labelledby="systems-title" className="border-t border-line px-page py-section">
      <h2 id="systems-title" className="type-display-l text-ink-1">
        {HERO_COPY.systemsSection}
      </h2>
      <div className="mt-10 grid gap-x-(--gutter) gap-y-10 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        {CATEGORIES_BY_SYSTEM.map(({ system, categories }) => (
          <div key={system.slug} className="flex flex-col">
            <h3 className="mb-3 border-b border-line pb-2 type-label uppercase text-ink-3">
              {system.labelSr}
            </h3>
            <ul className="flex flex-col">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={ROUTES.category(c.slug)}
                    variant="quiet"
                    className="inline-flex min-h-11 items-center py-1 text-[0.9375rem] sm:min-h-9"
                  >
                    {c.labelSr}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
