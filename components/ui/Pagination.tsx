import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { paginationRange } from "@/lib/pagination";

export type PaginationProps = {
  page: number;
  pageCount: number;
  /** Builds the (crawlable) URL of a page, e.g. `?strana=3`. */
  hrefFor: (page: number) => string;
  className?: string;
};

const stepClasses =
  "inline-flex h-11 items-center gap-1.5 rounded-sm px-3 type-button text-ink-1 transition-control hover:bg-surface-2";

/**
 * Pagination (§9.17): „Prethodna“ / „Sledeća“ + page numbers with gaps, current page with an
 * accent underline, 44 px targets, real links (`?strana=n`). Phones: prev/next + „Strana 6
 * od 12“.
 */
export function Pagination({ page, pageCount, hrefFor, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(page, 1), pageCount);
  const tokens = paginationRange(current, pageCount);
  const hasPrev = current > 1;
  const hasNext = current < pageCount;

  return (
    <nav
      aria-label="Stranice"
      className={cn("flex items-center justify-between gap-2 md:justify-center", className)}
    >
      {hasPrev ? (
        <NextLink href={hrefFor(current - 1)} rel="prev" className={stepClasses}>
          <CaretLeftIcon size={16} aria-hidden="true" />
          Prethodna
        </NextLink>
      ) : (
        <span aria-hidden="true" className={cn(stepClasses, "pointer-events-none text-ink-4")}>
          <CaretLeftIcon size={16} />
          Prethodna
        </span>
      )}

      <p className="type-body-s text-ink-2 md:hidden" data-reveal="off">
        Strana {current} od {pageCount}
      </p>

      <ol className="hidden items-center gap-1 md:flex">
        {tokens.map((token, index) =>
          token === "gap" ? (
            <li
              key={`gap-${index}`}
              aria-hidden="true"
              className="inline-flex h-11 w-8 items-end justify-center pb-3 text-ink-3"
            >
              …
            </li>
          ) : (
            <li key={token}>
              {token === current ? (
                <span
                  aria-current="page"
                  className="inline-flex h-11 min-w-11 items-center justify-center border-b-2 border-accent px-2 type-button tabular-nums text-ink-1"
                >
                  <span className="sr-only">Strana </span>
                  {token}
                </span>
              ) : (
                <NextLink
                  href={hrefFor(token)}
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-sm px-2 type-button tabular-nums text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1"
                >
                  <span className="sr-only">Strana </span>
                  {token}
                </NextLink>
              )}
            </li>
          ),
        )}
      </ol>

      {hasNext ? (
        <NextLink href={hrefFor(current + 1)} rel="next" className={stepClasses}>
          Sledeća
          <CaretRightIcon size={16} aria-hidden="true" />
        </NextLink>
      ) : (
        <span aria-hidden="true" className={cn(stepClasses, "pointer-events-none text-ink-4")}>
          Sledeća
          <CaretRightIcon size={16} />
        </span>
      )}
    </nav>
  );
}
