"use client";

/**
 * `/admin/lager` — „Malo na stanju“ (out of stock first, per-product threshold editable,
 * stock change with a reason) and „Kretanje zaliha“ (every change with reason, reference
 * and actor, filterable by reason). The default threshold lives in settings.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { STOCK_REASON_LABEL, STOCK_STATE_LABEL, STOCK_STATE_TONE } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { StockDialog } from "../products/StockDialog";
import { ActorLabel, LoadMoreFooter, PageHeader } from "../ui";

type Low = FunctionReturnType<typeof api.stock.lowStock>[number];
type Movement = FunctionReturnType<typeof api.stock.movements>["page"][number];

function ThresholdCell({ row, fallback }: { row: Low; fallback: number }) {
  const setThreshold = useMutation(api.stock.setThreshold);
  const [value, setValue] = useState(row.threshold === null ? "" : String(row.threshold));
  return (
    <input
      aria-label={`Prag za ${row.sku}`}
      inputMode="numeric"
      placeholder={String(fallback)}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={async () => {
        const next = value.trim() === "" ? null : Number(value);
        if (next === row.threshold) return;
        if (next !== null && (!Number.isInteger(next) || next < 0)) {
          setValue(row.threshold === null ? "" : String(row.threshold));
          return toast.error("Prag je ceo broj, 0 ili više.");
        }
        try {
          await setThreshold({ productId: row.productId, threshold: next });
          toast.success(`${row.sku}: prag ${next ?? `podrazumevani (${fallback})`}.`);
        } catch (err) {
          toast.error(convexErrorMessage(err, "Prag nije sačuvan."));
        }
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-8 w-16 rounded-xs border border-transparent bg-transparent px-2 text-right tabular-nums hover:border-control focus:border-focus focus:bg-surface-1 focus:outline-none"
    />
  );
}

export function StockAdmin() {
  const nowMinute = useNowMinute();
  const low = useQuery(api.stock.lowStock, {});
  const settings = useQuery(api.settings.getAdmin, {});
  const [reason, setReason] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.stock.movements,
    reason ? { reason: reason as keyof typeof STOCK_REASON_LABEL } : {},
    { initialNumItems: 50 },
  );
  const [adjusting, setAdjusting] = useState<Low | null>(null);
  const fallback = settings?.commerce.lowStockDefault ?? 3;

  const lowColumns = useMemo<ColumnDef<Low, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Artikal",
        cell: ({ row }) => (
          <RouteLink
            href={ADMIN.product(row.original.productId)}
            className="flex flex-col hover:underline"
          >
            <span className="text-ink-1">{row.original.name}</span>
            <span className="type-code-s text-ink-3">{row.original.sku}</span>
          </RouteLink>
        ),
      },
      {
        accessorKey: "stockState",
        header: "Stanje",
        cell: ({ row }) => (
          <Badge tone={STOCK_STATE_TONE[row.original.stockState]}>
            {STOCK_STATE_LABEL[row.original.stockState]}
          </Badge>
        ),
      },
      { accessorKey: "stockQty", header: "Kom.", meta: { align: "right" } },
      {
        id: "threshold",
        header: "Prag",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <ThresholdCell row={row.original} fallback={fallback} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Radnje</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Button size="sm" variant="secondary" onClick={() => setAdjusting(row.original)}>
            Promeni stanje
          </Button>
        ),
      },
    ],
    [fallback],
  );

  const moveColumns = useMemo<ColumnDef<Movement, unknown>[]>(
    () => [
      {
        accessorKey: "at",
        header: "Vreme",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-2">
            {compactDateTime(row.original.at, nowMinute)}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Artikal",
        cell: ({ row }) => (
          <RouteLink
            href={ADMIN.product(row.original.productId)}
            className="flex flex-col hover:underline"
          >
            <span className="text-ink-1">{row.original.name}</span>
            <span className="type-code-s text-ink-3">{row.original.sku}</span>
          </RouteLink>
        ),
      },
      {
        accessorKey: "delta",
        header: "Promena",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={
              row.original.delta > 0 ? "font-semibold text-success" : "font-semibold text-danger"
            }
          >
            {row.original.delta > 0 ? "+" : "−"}
            {Math.abs(row.original.delta)}
          </span>
        ),
      },
      {
        id: "after",
        header: "Posle",
        meta: { align: "right" },
        cell: ({ row }) => <span>{row.original.qtyAfter}</span>,
      },
      {
        accessorKey: "reason",
        header: "Razlog",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="text-ink-1">{STOCK_REASON_LABEL[row.original.reason]}</span>
            {row.original.note ? (
              <span className="type-caption text-ink-3">{row.original.note}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "actor",
        header: "Ko",
        enableSorting: false,
        cell: ({ row }) => <ActorLabel actor={row.original.actor} />,
      },
    ],
    [nowMinute],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Lager"
        description={`Artikli bez zaliha i sa malo zaliha (prag ${fallback} kom. ako artikal nema svoj) i svaka promena stanja sa razlogom.`}
      />
      <Tabs
        label="Lager"
        items={[
          {
            value: "malo",
            label: `Malo na stanju${low ? ` (${low.length})` : ""}`,
            content: (
              <DataTable
                className="mt-4"
                caption="Artikli sa malo ili bez zaliha"
                columns={lowColumns}
                data={low ?? []}
                getRowId={(r) => r.productId}
                loading={low === undefined}
                empty={
                  <p className="py-10 text-center type-body-s text-ink-2">
                    Svi aktivni artikli imaju dovoljno zaliha.
                  </p>
                }
              />
            ),
          },
          {
            value: "kretanje",
            label: "Kretanje zaliha",
            content: (
              <div className="mt-4 flex flex-col gap-3">
                <Select
                  size="sm"
                  aria-label="Razlog promene"
                  placeholder="Svi razlozi"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  options={Object.entries(STOCK_REASON_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  className="w-60"
                />
                <DataTable
                  caption="Kretanje zaliha"
                  columns={moveColumns}
                  data={results}
                  getRowId={(r) => r._id}
                  loading={status === "LoadingFirstPage"}
                  empty={
                    <p className="py-10 text-center type-body-s text-ink-2">
                      Nema promena za ovaj izbor.
                    </p>
                  }
                />
                <LoadMoreFooter
                  shown={results.length}
                  status={status}
                  onMore={loadMore}
                  noun="promena"
                />
              </div>
            ),
          },
        ]}
      />
      {adjusting ? (
        <StockDialog
          open
          onOpenChange={(v) => !v && setAdjusting(null)}
          productId={adjusting.productId as Id<"products">}
          sku={adjusting.sku}
          current={adjusting.stockQty}
        />
      ) : null}
    </div>
  );
}
