"use client";

/**
 * `/admin/lager` — „Bez zaliha“ and „Malo na stanju“ (quantity and per-product threshold
 * edited in the row: the quantity opens the stock dialog with a reason, the threshold saves
 * on blur) and „Kretanje zaliha“ (every change with reason, reference and actor, filterable
 * by reason). The default threshold lives in settings.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDateTime } from "@/lib/admin/format";
import { STOCK_REASON_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { StockDialog } from "../products/StockDialog";
import { ActorLabel, LoadMoreFooter, PageHeader, StockStateBadge } from "../ui";

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
      className="h-8 w-16 rounded-sm border border-transparent bg-transparent px-2 text-right tabular-nums hover:border-control focus:border-focus focus:bg-surface-1 focus:outline-none"
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
  const out = low?.filter((r) => r.stockState === "out_of_stock");
  const few = low?.filter((r) => r.stockState !== "out_of_stock");

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
        cell: ({ row }) => <StockStateBadge state={row.original.stockState} />,
      },
      {
        accessorKey: "stockQty",
        header: "Kom.",
        meta: { align: "right" },
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setAdjusting(row.original)}
            aria-label={`Promeni stanje za ${row.original.sku}, trenutno ${row.original.stockQty} kom.`}
            className="group inline-flex h-8 min-w-16 items-center justify-end gap-1.5 rounded-sm border border-transparent px-2 tabular-nums text-ink-1 transition-control hover:border-control focus-ring"
          >
            <PencilSimpleIcon
              size={14}
              aria-hidden="true"
              className="text-ink-3 transition-control hover-hover:opacity-0 hover-hover:group-hover:opacity-100 hover-hover:group-focus-visible:opacity-100"
            />
            {row.original.stockQty}
          </button>
        ),
      },
      {
        id: "threshold",
        header: "Prag",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <ThresholdCell row={row.original} fallback={fallback} />,
      },
    ],
    [fallback],
  );

  const lowTable = (rows: Low[] | undefined, caption: string, empty: string) => (
    <DataTable
      className="mt-4"
      caption={caption}
      columns={lowColumns}
      data={rows ?? []}
      getRowId={(r) => r.productId}
      loading={rows === undefined}
      empty={<p className="py-10 text-center type-body-s text-ink-2">{empty}</p>}
    />
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
        description={`Artikli bez zaliha i sa malo zaliha (prag ${fallback} kom. ako artikal nema svoj) i svaka promena stanja sa razlogom. Količinu i prag menjate direktno u redu.`}
      />
      <Tabs
        label="Lager"
        items={[
          {
            value: "bez",
            label: `Bez zaliha${out ? ` (${out.length})` : ""}`,
            content: lowTable(
              out,
              "Aktivni artikli bez zaliha",
              "Nijedan aktivan artikal nije bez zaliha.",
            ),
          },
          {
            value: "malo",
            label: `Malo na stanju${few ? ` (${few.length})` : ""}`,
            content: lowTable(
              few,
              "Aktivni artikli sa malo zaliha",
              "Svi aktivni artikli imaju zalihe iznad praga.",
            ),
          },
          {
            value: "kretanje",
            label: "Kretanje zaliha",
            content: (
              <div className="mt-4 flex flex-col gap-3">
                <div className="w-60">
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
                  />
                </div>
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
                  forms={["promena", "promene", "promena"]}
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
