import {
  categoryProductCount,
  type CategoryDetail,
  type CategoryTree,
  type ProductCardData,
} from "@/lib/catalog/types";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/jsonld";
import type { LandingLinkData } from "@/lib/seo/landingLinks";
import { systemIntro } from "@/lib/seo/templates";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { LandingLinks } from "@/components/seo/LandingLinks";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";

/** The system's child categories in shop order, each with its real product count. */
export function systemChildren(category: CategoryDetail, tree: CategoryTree) {
  return tree.categories
    .filter((c) => c.parentId === category.category._id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ category: c, count: categoryProductCount(tree, c) }));
}

/**
 * System hub (`kind: system`, §10.2, SEO-04): the intro (the owner's text, or one built from
 * the real counts), the system's categories as render tiles with counts, the most popular
 * parts across them (ItemList) and the indexable vehicle landings of its categories.
 */
export function SystemHub({
  category,
  tree,
  crumbs,
  topProducts,
  landings,
}: {
  category: CategoryDetail;
  tree: CategoryTree;
  crumbs: Crumb[];
  topProducts: ProductCardData[];
  landings: LandingLinkData[];
}) {
  const children = systemChildren(category, tree);
  const name = category.category.name;
  const intro =
    category.intro ??
    systemIntro({
      name,
      categories: children.map((c) => ({ name: c.category.name, count: c.count })),
    });
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(crumbs),
          ...(topProducts.length
            ? [
                itemListJsonLd(
                  topProducts.map((p) => ({ name: p.name, slug: p.slug })),
                  `${name} — najtraženiji delovi`,
                ),
              ]
            : []),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <RevealText as="h1" className="mt-4 type-display-l uppercase text-ink-1">
        {name}
      </RevealText>
      {intro ? (
        <RevealText as="p" className="mt-4 max-w-[72ch] type-lead text-ink-2">
          {intro}
        </RevealText>
      ) : null}
      <RevealGroup
        as="ul"
        className="mt-block grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5"
      >
        {children.map(({ category: c, count }, i) => (
          <RevealItem as="li" key={c.slug} eager={i < 4} index={i}>
            <CategoryTile category={c} count={count} headingLevel="h2" />
          </RevealItem>
        ))}
      </RevealGroup>
      {topProducts.length > 0 ? (
        <section aria-labelledby="system-top-title" className="mt-14">
          <h2 id="system-top-title" className="type-h2 text-ink-1">
            Najtraženiji delovi
          </h2>
          <div className="mt-5">
            <ProductGrid items={topProducts} />
          </div>
        </section>
      ) : null}
      <LandingLinks
        id="system-landings-title"
        title={`${name} po vozilu`}
        links={landings}
        show="vehicle"
      />
    </div>
  );
}
