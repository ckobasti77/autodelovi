"use client";

/**
 * DataTable (§9.15) — admin tables on TanStack Table v8 (headless: sorting, selection,
 * column visibility); markup and states are ours.
 *
 * - Header 36 px surface-2, 11 px caps labels, sticky; rows 48 px (compact 36), 1 px
 *   line-faint dividers, no zebra; hover surface-2; selected rows use the neutral `selected`
 *   tint + a checked box (the accent tint is reserved for „Nova“ chips).
 * - Numbers right-aligned and tabular (column meta `align: "right"`).
 * - Keyboard: rows are a roving tab stop — ↑/↓/Home/End move, Enter opens, Space selects;
 *   Shift+click selects a range. Sortable headers are buttons with aria-sort on the <th>.
 * - Sticky first/last columns via meta `sticky: "left" | "right"` for horizontal scrolling.
 * - States: loading (skeleton rows keep the column widths), empty (per-filter message).
 */
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { CheckboxBox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- generics must match TanStack's declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
    sticky?: "left" | "right";
    /** Width utility for the column (e.g. "w-40"). */
    widthClass?: string;
    /** Label in the column-visibility menu when the header is not a string. */
    label?: string;
  }
}

export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Accessible table caption (visually hidden). */
  caption: string;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Enter on a focused row, or a click on the row outside interactive cells. */
  onRowOpen?: (row: T) => void;
  /** Accessible name of a row for the selection checkbox, e.g. „SK-2026-000187“. */
  rowLabel?: (row: T) => string;
  density?: "default" | "compact";
  loading?: boolean;
  loadingRows?: number;
  empty?: ReactNode;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  className?: string;
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  caption,
  enableRowSelection = false,
  rowSelection: rowSelectionProp,
  onRowSelectionChange,
  onRowOpen,
  rowLabel,
  density = "default",
  loading = false,
  loadingRows = 6,
  empty,
  columnVisibility: visibilityProp,
  onColumnVisibilityChange,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectionState, setSelectionState] = useState<RowSelectionState>({});
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({});
  const rowSelection = rowSelectionProp ?? selectionState;
  const columnVisibility = visibilityProp ?? visibilityState;
  const [focusIndex, setFocusIndex] = useState(0);
  const lastClicked = useRef<number | null>(null);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const selectionColumn: ColumnDef<T, unknown> = {
    id: "__select",
    enableSorting: false,
    enableHiding: false,
    meta: { sticky: "left", widthClass: "w-10" },
    header: ({ table }) => (
      <CheckboxBox
        aria-label="Izaberi sve redove"
        checked={
          table.getIsAllRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
      />
    ),
    cell: ({ row }) => (
      <CheckboxBox
        aria-label={`Izaberi ${rowLabel ? rowLabel(row.original) : `red ${row.index + 1}`}`}
        checked={row.getIsSelected()}
        tabIndex={-1}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          handleSelectClick(row, event.shiftKey);
        }}
      />
    ),
  };

  // TanStack returns a mutable instance; the React Compiler skips this component by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: enableRowSelection ? [selectionColumn, ...columns] : columns,
    getRowId: (row) => getRowId(row),
    state: { sorting, rowSelection, columnVisibility },
    enableRowSelection,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      if (rowSelectionProp === undefined) setSelectionState(next);
      onRowSelectionChange?.(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      if (visibilityProp === undefined) setVisibilityState(next);
      onColumnVisibilityChange?.(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  function handleSelectClick(row: Row<T>, shift: boolean) {
    const index = rows.findIndex((r) => r.id === row.id);
    if (shift && lastClicked.current !== null) {
      const [from, to] = [lastClicked.current, index].sort((a, b) => a - b) as [number, number];
      const target = !row.getIsSelected();
      const next: RowSelectionState = { ...rowSelection };
      for (let i = from; i <= to; i++) {
        const id = rows[i]?.id;
        if (id) next[id] = target;
      }
      table.setRowSelection(next);
    } else {
      row.toggleSelected();
    }
    lastClicked.current = index;
  }

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setFocusIndex(clamped);
    bodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]")[clamped]?.focus();
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row<T>, index: number) => {
    if (event.target !== event.currentTarget) return; // keys inside cell controls stay with them
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        break;
      case "Enter":
        if (onRowOpen) {
          event.preventDefault();
          onRowOpen(row.original);
        }
        break;
      case " ":
        if (enableRowSelection) {
          event.preventDefault();
          handleSelectClick(row, event.shiftKey);
        }
        break;
      default:
        break;
    }
  };

  const cellPad = density === "compact" ? "h-9" : "h-12";
  const stickyClass = (sticky?: "left" | "right") =>
    sticky === "left"
      ? "sticky left-0 z-raised"
      : sticky === "right"
        ? "sticky right-0 z-raised"
        : "";
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div
      className={cn(
        "relative overflow-x-auto rounded-sm border border-line bg-surface-1",
        className,
      )}
      data-reveal="off"
    >
      <table className="w-max min-w-full border-collapse text-left text-cell text-ink-1">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-raised">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : canSort
                            ? "none"
                            : undefined
                    }
                    className={cn(
                      "h-9 whitespace-nowrap border-b border-line-strong bg-surface-2 px-2 type-label text-ink-3 first:pl-3 last:pr-3",
                      meta?.align === "right" && "text-right",
                      meta?.widthClass,
                      stickyClass(meta?.sticky),
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center gap-1 rounded-xs uppercase transition-control hover:text-ink-1 focus-ring-inset",
                          meta?.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden="true" className="inline-flex">
                          {sorted === "asc" ? (
                            <ArrowUpIcon size={12} weight="bold" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon size={12} weight="bold" />
                          ) : (
                            <ArrowsDownUpIcon size={12} className="opacity-60" />
                          )}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody ref={bodyRef} aria-busy={loading || undefined}>
          {loading ? (
            Array.from({ length: loadingRows }, (_, i) => (
              <tr key={`sk-${i}`} className="border-b border-line-faint last:border-b-0">
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      cellPad,
                      "px-2 first:pl-3 last:pr-3",
                      column.columnDef.meta?.widthClass,
                    )}
                  >
                    <Skeleton
                      className={cn(
                        "h-3",
                        column.columnDef.meta?.align === "right" ? "ml-auto w-16" : "w-[70%]",
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-3 py-2">
                {empty ?? (
                  <p className="py-10 text-center type-body-s text-ink-2">Nema podataka.</p>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const selected = row.getIsSelected();
              return (
                <tr
                  key={row.id}
                  data-row=""
                  data-state={selected ? "selected" : undefined}
                  aria-selected={enableRowSelection ? selected : undefined}
                  tabIndex={index === focusIndex ? 0 : -1}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => onRowKeyDown(event, row, index)}
                  onClick={(event) => {
                    if (!onRowOpen) return;
                    const target = event.target as HTMLElement;
                    if (target.closest("a, button, input, [role=checkbox], [role=menuitem]"))
                      return;
                    onRowOpen(row.original);
                  }}
                  className={cn(
                    "group/row border-b border-line-faint last:border-b-0 focus-ring-inset",
                    onRowOpen && "cursor-pointer",
                    selected ? "bg-selected" : "hover:bg-surface-2",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          cellPad,
                          "px-2 align-middle first:pl-3 last:pr-3",
                          meta?.align === "right" && "text-right tabular-nums",
                          meta?.widthClass,
                          meta?.sticky &&
                            cn(
                              stickyClass(meta.sticky),
                              selected
                                ? "bg-selected"
                                : "bg-surface-1 group-hover/row:bg-surface-2",
                            ),
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { ColumnDef, RowSelectionState, VisibilityState } from "@tanstack/react-table";
