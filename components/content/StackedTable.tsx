import type { ReactNode } from "react";

/**
 * Data table of the content pages (delivery terms, cookies, privacy; VIS-13). From `sm` up it
 * is an ordinary table; below `sm` every row becomes a stacked card — the first cell as its
 * title, the other cells as „LABEL value“ lines — so nothing hides in a clipped horizontal
 * scroller on a phone. The explicit ARIA roles keep the table semantics that `display: block`
 * would otherwise drop; the per-cell labels are aria-hidden because the column headers
 * already name the cells. Table data is static, like prices (`data-reveal="off"`).
 */
export function StackedTable({
  caption,
  head,
  rows,
  className,
}: {
  caption?: string;
  head: ReactNode[];
  rows: { key: string; cells: ReactNode[] }[];
  className?: string;
}) {
  return (
    <div className={`rounded-sm border border-line ${className ?? ""}`} data-reveal="off">
      <table role="table" className="w-full border-collapse type-body-s max-sm:block">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead role="rowgroup" className="bg-surface-2 max-sm:sr-only">
          <tr role="row">
            {head.map((cell, j) => (
              <th
                key={j}
                role="columnheader"
                scope="col"
                className="border-b border-line-strong px-3 py-2.5 text-left type-label uppercase text-ink-3"
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
              className="border-b border-line last:border-b-0 max-sm:flex max-sm:flex-col max-sm:gap-1.5 max-sm:px-4 max-sm:py-3.5"
            >
              {row.cells.map((cell, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    role="rowheader"
                    scope="row"
                    className="px-3 py-3 text-left align-top font-semibold text-ink-1 max-sm:p-0"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={j}
                    role="cell"
                    className="px-3 py-3 align-top text-ink-2 max-sm:flex max-sm:gap-3 max-sm:p-0"
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
    </div>
  );
}
