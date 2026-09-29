import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumbs (§9.18): 13 px ink-3, „/“ separators in ink-4, the current page in ink-1 and
 * not linked. Phones show only the parent („← Kočnice“). JSON-LD is rendered separately by
 * the page (lib/seo) from the same items.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const parent = [...items].reverse().find((item, index) => index > 0 && item.href);
  return (
    <nav aria-label="Putanja" className={cn("type-caption font-normal", className)}>
      {parent?.href ? (
        <NextLink
          href={parent.href}
          className="inline-flex min-h-11 items-center gap-1.5 text-ink-2 transition-control hover:text-ink-1 md:hidden"
        >
          <ArrowLeftIcon size={14} aria-hidden="true" />
          {parent.label}
        </NextLink>
      ) : null}
      <ol className="hidden flex-wrap items-center gap-x-2 gap-y-1 md:flex">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {last || !item.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-ink-1" : "text-ink-3"}
                >
                  {item.label}
                </span>
              ) : (
                <NextLink
                  href={item.href}
                  className="text-ink-3 underline decoration-transparent underline-offset-4 transition-control hover:text-ink-1 hover:decoration-line-strong"
                >
                  {item.label}
                </NextLink>
              )}
              {!last ? (
                <span aria-hidden="true" className="text-ink-4">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
