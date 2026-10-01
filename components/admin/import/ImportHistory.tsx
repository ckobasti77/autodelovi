"use client";

/** `/admin/uvoz/istorija` — every import: who, when, file, mode, counts, status. */
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { compactDateTime } from "@/lib/admin/format";
import { formatNumber } from "@/lib/format/number";
import { IMPORT_MODE_LABEL, ROWS, countImport } from "@/lib/i18n/sr/import";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { RouteLink } from "@/components/ui/RouteLink";
import { ADMIN } from "@/constants/routes";

import { useNowMinute } from "../hooks";
import { ActorLabel, LoadMoreFooter, PageHeader } from "../ui";
import { ImportStatusBadge } from "./parts";

type Row = FunctionReturnType<typeof api.imports.history>["page"][number];

const num = (value: number, tone?: "danger") => (
  <span className={value > 0 && tone === "danger" ? "font-semibold text-danger" : "text-ink-1"}>
    {formatNumber(value)}
  </span>
);

export function ImportHistory() {
  const router = useRouter();
  const now = useNowMinute();
  const { results, status, loadMore } = usePaginatedQuery(
    api.imports.history,
    {},
    { initialNumItems: 50 },
  );
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "when",
        accessorKey: "_creationTime",
        header: "Vreme",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-2">
            {compactDateTime(row.original._creationTime, now)}
          </span>
        ),
      },
      {
        id: "file",
        accessorKey: "fileName",
        header: "Fajl",
        cell: ({ row }) => (
          <span className="flex min-w-[14rem] flex-col">
            <RouteLink
              href={ADMIN.importBatch(row.original._id)}
              className="font-medium text-ink-1 hover:underline"
            >
              {row.original.fileName}
            </RouteLink>
            <span className="type-caption text-ink-3">
              {IMPORT_MODE_LABEL[row.original.mode]}
              {row.original.deactivateMissing ? " · deaktiviranje" : ""} ·{" "}
              {countImport(row.original.counts.total, ROWS)}
            </span>
          </span>
        ),
      },
      {
        id: "actor",
        header: "Ko",
        enableSorting: false,
        cell: ({ row }) => (row.original.actor ? <ActorLabel actor={row.original.actor} /> : "—"),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ImportStatusBadge status={row.original.status} />,
      },
      {
        id: "created",
        header: "Novi",
        meta: { align: "right" },
        cell: ({ row }) => num(row.original.counts.created ?? row.original.counts.create),
      },
      {
        id: "updated",
        header: "Izmene",
        meta: { align: "right" },
        cell: ({ row }) => num(row.original.counts.updated ?? row.original.counts.update),
      },
      {
        id: "errors",
        header: "Greške",
        meta: { align: "right" },
        cell: ({ row }) => num(row.original.counts.error + row.original.counts.failed, "danger"),
      },
    ],
    [now],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Istorija uvoza"
        description="Svaki uvoz sa brojem novih i izmenjenih artikala, greškama i mogućnošću poništavanja."
        actions={
          <RouteLink
            href={ADMIN.imports}
            className="inline-flex h-11 items-center rounded-xs bg-accent px-4 type-body-s font-semibold text-on-accent transition-control hover:bg-accent-hover focus-ring-inverse"
          >
            Novi uvoz
          </RouteLink>
        }
      />
      <DataTable
        caption="Istorija uvoza"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        rowLabel={(r) => r.fileName}
        loading={status === "LoadingFirstPage"}
        onRowOpen={(r) => router.push(ADMIN.importBatch(r._id))}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            Još nema uvoza.{" "}
            <RouteLink
              href={ADMIN.imports}
              className="text-accent-text underline underline-offset-2"
            >
              Pokrenite prvi
            </RouteLink>
            .
          </p>
        }
      />
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["uvoz", "uvoza", "uvoza"]}
      />
    </div>
  );
}
