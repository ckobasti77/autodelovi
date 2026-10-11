import Image from "next/image";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";
import { categoryImage, type CategorySummary } from "@/lib/catalog/types";
import { RouteLink } from "@/components/ui/RouteLink";
import { ROUTES } from "@/constants/routes";

/**
 * Category tile: the Blender render on the graphite ground, name and a real count. The whole
 * tile is one link. Used by the home categories grid, `/delovi`, system hubs and vehicle pages.
 */
export function CategoryTile({
  category,
  count,
  href,
  size = "m",
  headingLevel = "h3",
}: {
  category: Pick<CategorySummary, "slug" | "name" | "productCount" | "inStockCount">;
  count?: number;
  href?: string;
  size?: "s" | "m";
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const Heading = headingLevel;
  const n = count ?? category.productCount;
  return (
    <RouteLink
      href={href ?? ROUTES.category(category.slug)}
      className="group relative flex h-full flex-col overflow-hidden panel card-interactive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div
        className={cn(
          "relative bg-[radial-gradient(circle_at_50%_45%,var(--color-surface-3),var(--color-surface-1)_70%)]",
          size === "s" ? "aspect-[5/4]" : "aspect-[4/3]",
        )}
      >
        <Image
          src={categoryImage(category.slug)}
          alt=""
          fill
          sizes={size === "s" ? "(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw" : "(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 50vw"}
          className="object-contain p-[10%] transition-transform duration-[600ms] ease-sk-out hover-hover:group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-3 sm:p-4">
        <Heading className="type-h4 text-ink-1 group-hover:underline group-hover:decoration-accent group-hover:underline-offset-4">
          {category.name}
        </Heading>
        <p className="type-caption text-ink-3">
          {n > 0 ? (
            <>
              <span className="tabular-nums">{formatNumber(n)}</span>{" "}
              {pluralSr(n, ["artikal", "artikla", "artikala"])}
            </>
          ) : (
            "Po upitu"
          )}
        </p>
      </div>
    </RouteLink>
  );
}
