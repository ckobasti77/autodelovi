import { categoryProductCount, type CategoryDetail, type CategoryTree } from "@/lib/catalog/types";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { RevealText } from "@/components/text-reveal/RevealText";
import { JsonLd } from "@/components/seo/JsonLd";
import { CategoryTile } from "@/components/catalog/CategoryTile";

/** System hub (`kind: system`, §10.2): the system's categories as render tiles with counts. */
export function SystemHub({
  category,
  tree,
  crumbs,
}: {
  category: CategoryDetail;
  tree: CategoryTree;
  crumbs: Crumb[];
}) {
  const children = tree.categories
    .filter((c) => c.parentId === category.category._id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="px-page pb-(--space-section) pt-6 lg:pt-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <RevealText as="h1" className="mt-4 type-display-l uppercase text-ink-1">
        {category.category.name}
      </RevealText>
      {category.intro ? (
        <RevealText as="p" className="mt-4 max-w-[72ch] type-lead text-ink-2">
          {category.intro}
        </RevealText>
      ) : null}
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-(--gutter) md:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
        {children.map((c) => (
          <li key={c.slug}>
            <CategoryTile category={c} count={categoryProductCount(tree, c)} headingLevel="h2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
