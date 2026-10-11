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
 * - Sticky first/last columns via meta `sticky: "left" | "right"` for horizontal scrolling; the
 *   edge hints sit on the seam next to a sticky column, where content actually disappears.
 * - The table is as wide as its container (`w-full`, auto layout): wrapping cells fold before
 *   anything scrolls; only nowrap / capped content can force sideways scrolling (D159).
 * - Selection changes are announced through a polite status („Izabrano: 3“, „Izbor poništen“).
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
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
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
  // Edge hints: columns hidden to the right/left of a horizontally scrolling table.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  // Widths of the sticky left/right columns: the hints are drawn at their inner edges.
  const [insets, setInsets] = useState({ start: 0, end: 0 });
  // A click that lands on a row right after a selection change is a stale double-click aimed
  // at the checkbox, not a request to open the record (VIS-17).
  const selectionChangedAt = useRef(-Infinity);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setOverflow((o) => (o.start === start && o.end === end ? o : { start, end }));
      let startInset = 0;
      let endInset = 0;
      const box = el.getBoundingClientRect();
      for (const th of el.querySelectorAll<HTMLElement>("thead th[data-sticky]")) {
        const r = th.getBoundingClientRect();
        if (th.dataset.sticky === "left") startInset = Math.max(startInset, r.right - box.left);
        else endInset = Math.max(endInset, box.right - r.left);
      }
      startInset = Math.round(startInset);
      endInset = Math.round(endInset);
      setInsets((i) =>
        i.start === startInset && i.end === endInset ? i : { start: startInset, end: endInset },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);

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
      selectionChangedAt.current = performance.now();
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

  // Status for screen readers: the row checkbox is not a tab stop and <tr aria-selected> is
  // not exposed inside a plain table, so every change of the selected count is announced.
  const selectedCount = enableRowSelection ? Object.values(rowSelection).filter(Boolean).length : 0;
  const [announcedCount, setAnnouncedCount] = useState(selectedCount);
  const [selectionNote, setSelectionNote] = useState("");
  if (announcedCount !== selectedCount) {
    setAnnouncedCount(selectedCount);
    setSelectionNote(selectedCount > 0 ? `Izabrano: ${selectedCount}` : "Izbor poništen");
  }

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
  // A sticky-left data column sits right of the 40 px (w-10) selection column, not under it.
  const stickyClass = (sticky?: "left" | "right", columnId?: string) =>
    sticky === "left"
      ? enableRowSelection && columnId !== "__select"
        ? "sticky left-10 z-raised"
        : "sticky left-0 z-raised"
      : sticky === "right"
        ? "sticky right-0 z-raised"
        : "";
  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <div
      // @container: cells can fold on the table's own width (the sidebar makes viewport
      // breakpoints a poor proxy: 1366 px has less room than 1280 px).
      className={cn("@container relative panel", className)}
      // A block reveal without lift (a wide table that moves reads as a layout jump); its text
      // arrives with it, never word by word.
      data-reveal="block"
      data-reveal-variant="fade"
    >
      {/* relative: absolutely positioned cell content (sr-only text) is clipped by the scroller
          instead of widening the document on phones. */}
      <div ref={scrollRef} className="relative overflow-x-auto rounded-md">
        <table className="w-full border-collapse text-left text-cell text-ink-1">
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
                      data-sticky={meta?.sticky}
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
                        stickyClass(meta?.sticky, header.column.id),
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex h-8 cursor-pointer items-center gap-1 rounded-sm uppercase transition-control hover:text-ink-1 focus-ring-inset",
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
                      if (performance.now() - selectionChangedAt.current < 300) return;
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
                                stickyClass(meta.sticky, cell.column.id),
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
      {overflow.end ? (
        <span
          aria-hidden="true"
          style={{ right: insets.end }}
          className={cn(
            "pointer-events-none absolute inset-y-0 w-8 bg-linear-to-l from-ink-1/12 to-transparent",
            insets.end === 0 && "rounded-r-md",
          )}
        />
      ) : null}
      {overflow.start ? (
        <span
          aria-hidden="true"
          style={{ left: insets.start }}
          className={cn(
            "pointer-events-none absolute inset-y-0 w-8 bg-linear-to-r from-ink-1/8 to-transparent",
            insets.start === 0 && "rounded-l-md",
          )}
        />
      ) : null}
      {enableRowSelection ? (
        <p role="status" className="sr-only">
          {selectionNote}
        </p>
      ) : null}
    </div>
  );
}

export type { ColumnDef, RowSelectionState, VisibilityState } from "@tanstack/react-table";
