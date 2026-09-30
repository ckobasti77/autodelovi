"use client";

/**
 * `/admin/upiti`: status tabs (+ „Moji“), search, kind filter, „samo majstori“ (priority),
 * live SLA timers for unanswered inquiries.
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { compactDateTime, formatElapsed } from "@/lib/admin/format";
import { slaLevel, workingMinutesBetween } from "@/lib/domain/sla";
import { formatPhone } from "@/lib/format/phone";
import { INQUIRY_KIND_LABEL } from "@/lib/i18n/sr/admin";
import { PREFERRED_CHANNEL_LABEL, type InquiryStatus } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { ADMIN } from "@/constants/routes";

import { useDebouncedValue, useNowMinute } from "../hooks";
import {
  DemoTag,
  DocNumber,
  InquiryStatusBadge,
  LoadMoreFooter,
  PageHeader,
  SearchField,
  SegmentedFilter,
} from "../ui";
import { useUrlFilters } from "../useUrlFilters";

type Row = FunctionReturnType<typeof api.inquiriesAdmin.list>["page"][number];

const TABS = [
  { value: "", label: "Svi" },
  { value: "nov", label: "Novi" },
  { value: "u_obradi", label: "U obradi" },
  { value: "ponuda_poslata", label: "Ponuda poslata" },
  { value: "istekla", label: "Istekli" },
  { value: "prihvacena", label: "Prihvaćeni" },
  { value: "odbijena", label: "Zatvoreni" },
  { value: "moji", label: "Moji" },
] as const;

export function InquiriesList() {
  const router = useRouter();
  const nowMinute = useNowMinute();
  const [f, setF] = useUrlFilters(["status", "q", "vrsta", "majstori"] as const);
  const [search, setSearch] = useState(f.q);
  const debounced = useDebouncedValue(search, 250);
  useEffect(() => {
    if (debounced !== f.q) setF({ q: debounced });
  }, [debounced, f.q, setF]);
  const mine = f.status === "moji";
  const { results, status, loadMore } = usePaginatedQuery(
    api.inquiriesAdmin.list,
    {
      ...(f.status && !mine ? { status: f.status as InquiryStatus } : {}),
      ...(mine ? { mine: true } : {}),
      ...(f.q ? { search: f.q } : {}),
      ...(f.vrsta ? { kind: f.vrsta as keyof typeof INQUIRY_KIND_LABEL } : {}),
      ...(f.majstori ? { mechanicsOnly: true } : {}),
    },
    { initialNumItems: 50 },
  );
  const counts = useQuery(api.inquiriesAdmin.statusCounts, {});
  const kpis = useQuery(api.dashboard.kpis, { nowMinute });

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "number",
        accessorKey: "number",
        header: "Broj",
        meta: { sticky: "left" },
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <DocNumber number={row.original.number} />
            {row.original.isMechanic ? <Badge tone="info">Majstor</Badge> : null}
            {row.original.isDemo ? <DemoTag /> : null}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Primljen",
        cell: ({ row }) => {
          const r = row.original;
          const open = (r.status === "nov" || r.status === "u_obradi") && !r.firstResponseAt;
          const minutes =
            open && kpis
              ? workingMinutesBetween(r.createdAt, nowMinute, kpis.hours, kpis.holidays)
              : null;
          const level = minutes !== null && kpis ? slaLevel(minutes, kpis.slaTargetMinutes) : "ok";
          return (
            <span className="flex flex-col whitespace-nowrap">
              <span className="tabular-nums text-ink-2">
                {compactDateTime(r.createdAt, nowMinute)}
              </span>
              {minutes !== null ? (
                <span
                  className={cn(
                    "type-caption tabular-nums",
                    level === "late"
                      ? "font-semibold text-danger"
                      : level === "soon"
                        ? "text-warning"
                        : "text-ink-3",
                  )}
                >
                  čeka {minutes < 1 ? "od otvaranja" : formatElapsed(minutes)}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "contact",
        accessorKey: "contactName",
        header: "Kontakt",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium text-ink-1">{row.original.contactName}</span>
            <span className="type-caption text-ink-3">
              {row.original.phone ? `${formatPhone(row.original.phone)} · ` : ""}
              {PREFERRED_CHANNEL_LABEL[
                row.original.preferredChannel as keyof typeof PREFERRED_CHANNEL_LABEL
              ] ?? row.original.preferredChannel}
            </span>
          </span>
        ),
      },
      {
        id: "request",
        header: "Traži",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex max-w-[26rem] flex-col">
            <span className="truncate text-ink-1">
              {row.original.vehicleLabel ?? INQUIRY_KIND_LABEL[row.original.kind]}
              {row.original.vin ? (
                <span className="type-code-s text-ink-3"> · {row.original.vin}</span>
              ) : null}
            </span>
            <span className="truncate type-caption text-ink-3">{row.original.message}</span>
          </span>
        ),
      },
      {
        id: "photos",
        accessorKey: "photoCount",
        header: "Foto",
        meta: { align: "right" },
        cell: ({ getValue }) =>
          Number(getValue()) > 0 ? (
            <span className="inline-flex items-center gap-1 text-ink-2">
              <ImageIcon size={14} aria-hidden="true" />
              {String(getValue())}
            </span>
          ) : (
            <span className="text-ink-4">—</span>
          ),
      },
      {
        id: "assignee",
        accessorKey: "assigneeName",
        header: "Radi",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-ink-2">{row.original.assigneeName ?? "—"}</span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <InquiryStatusBadge status={row.original.status} />,
      },
    ],
    [kpis, nowMinute],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Upiti"
        description="Upiti po broju šasije i za delove koje kupci nisu našli. Odgovor šaljete kao ponudu."
      />
      <SegmentedFilter
        label="Status upita"
        value={f.status}
        onChange={(s) => setF({ status: s })}
        options={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          count:
            counts && t.value === "moji"
              ? counts.mine
              : counts && t.value in counts
                ? counts[t.value as keyof typeof counts]
                : undefined,
        }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Pretraga upita"
          placeholder="Broj, ime, telefon, VIN, OEM…"
        />
        <Select
          size="sm"
          aria-label="Vrsta upita"
          placeholder="Sve vrste"
          value={f.vrsta}
          onChange={(e) => setF({ vrsta: e.target.value })}
          options={Object.entries(INQUIRY_KIND_LABEL).map(([value, label]) => ({ value, label }))}
          className="w-48"
        />
        <Switch
          label="Samo majstori"
          checked={Boolean(f.majstori)}
          onCheckedChange={(v) => setF({ majstori: v ? "1" : null })}
        />
      </div>
      <DataTable
        caption="Upiti"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        rowLabel={(r) => r.number}
        loading={status === "LoadingFirstPage"}
        onRowOpen={(r) => router.push(ADMIN.inquiry(r.number))}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            {f.status === "nov" ? "Nema novih upita." : "Nema upita za ovaj izbor."}
          </p>
        }
      />
      <LoadMoreFooter shown={results.length} status={status} onMore={loadMore} noun="upita" />
    </div>
  );
}
