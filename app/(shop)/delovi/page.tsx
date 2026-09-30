import type { Metadata } from "next";

import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { getCategoryTree, getSettingsPublic } from "@/lib/server/catalog-cache";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ROUTES } from "@/constants/routes";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettingsPublic();
  return buildMetadata({
    title: "Svi delovi po sistemima vozila",
    description:
      "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra po sistemima: motor, kočnice, vešanje, hlađenje, elektrika, karoserija i servisni delovi. Cene sa PDV-om i stanje.",
    path: ROUTES.parts,
    titleSuffix: settings.seo.titleSuffix,
  });
}

const crumbs = [{ label: "Početna", href: ROUTES.home }, { label: "Delovi" }];

/** All systems → categories (ROUTES §B1 `/delovi`). */
export default async function PartsIndexPage() {
  const tree = await getCategoryTree();
  return (
    <div className="px-page pb-section pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-4 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <RevealText as="h1" className="type-display-l uppercase text-ink-1 lg:col-span-7">
          Delovi po sistemima
        </RevealText>
        <RevealText as="p" className="max-w-[60ch] type-lead text-ink-2 lg:col-span-5 lg:self-end">
          Izaberite sistem i kategoriju, pa suzite izbor po vozilu i motoru. Broj dela upišite u pretragu kako god ga imate.
        </RevealText>
      </div>
      <div className="mt-12 flex flex-col gap-14">
        {tree.systems.map((system) => {
          const categories = tree.categories
            .filter((c) => c.parentId === system._id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          if (categories.length === 0) return null;
          return (
            <section key={system.slug} aria-labelledby={`sys-${system.slug}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
                <h2 id={`sys-${system.slug}`} className="type-display-m uppercase text-ink-1">
                  {system.name}
                </h2>
                <Link href={ROUTES.category(system.slug)} variant="standalone" className="type-body-s">
                  Ceo sistem
                </Link>
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 3xl:grid-cols-6">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <CategoryTile category={c} size="s" />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
