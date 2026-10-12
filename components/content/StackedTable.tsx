import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Reveal } from "@/components/reveal/Reveal";

/**
 * Data table of the content pages (delivery terms, cookies, privacy; VIS-13). From `sm` up it
 * is an ordinary table; below `sm` every row becomes a stacked card — the first cell as its
 * title, the other cells as „LABEL value“ lines — so nothing hides in a clipped horizontal
 * scroller on a phone. The explicit ARIA roles keep the table semantics that `display: block`
 * would otherwise drop; the per-cell labels are aria-hidden because the column headers
 * already name the cells.
 *
 * The table is one `panel` and arrives as one block in the fade variant (a lift on a wide
 * table reads as a layout jump); its cells are not split into words. `eager` for a table on
 * the first screen.
 */
export function StackedTable({
  caption,
  head,
  rows,
  eager = false,
  className,
}: {
  caption?: string;
  head: ReactNode[];
  rows: { key: string; cells: ReactNode[] }[];
  /** On the first screen: CSS-only entrance from a visible frame. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <Reveal variant="fade" eager={eager} className={cn("panel overflow-hidden", className)}>
      <table role="table" className="w-full border-collapse type-body-s max-sm:block">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead role="rowgroup" className="bg-surface-2 max-sm:sr-only">
          <tr role="row">
            {head.map((cell, j) => (
              <th
                key={j}
                role="columnheader"
                scope="col"
                className="border-b border-line-strong px-4 py-3 text-left type-label uppercase text-ink-3"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-sm:block">
          {rows.map((row) => (
            <tr
              key={row.key}
              role="row"
              className="border-b border-line last:border-b-0 max-sm:flex max-sm:flex-col max-sm:gap-1.5 max-sm:px-4 max-sm:py-4"
            >
              {row.cells.map((cell, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    role="rowheader"
                    scope="row"
                    className="px-4 py-3.5 text-left align-top font-semibold text-ink-1 max-sm:p-0"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={j}
                    role="cell"
                    className="px-4 py-3.5 align-top text-ink-2 max-sm:flex max-sm:gap-3 max-sm:p-0"
                  >
                    {head[j] ? (
                      <span
                        aria-hidden="true"
                        className="w-24 shrink-0 pt-0.5 type-label uppercase text-ink-3 sm:hidden"
                      >
                        {head[j]}
                      </span>
                    ) : null}
                    <span className="block min-w-0">{cell}</span>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Reveal>
  );
}
