"use client";

/**
 * `/admin/upiti`: status tabs (+ „Moji“), search, kind filter, „samo majstori“ (priority),
 * live SLA timers for unanswered inquiries (a zero timer
 * after more than a minute means it arrived outside working hours).
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImageIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { compactDateTime, formatElapsed } from "@/lib/admin/format";
import { slaLevel, workingMinutesBetween } from "@/lib/domain/sla";
import { formatPhone } from "@/lib/format/phone";
import { INQUIRY_KIND_LABEL, CHANNEL_LABEL } from "@/lib/i18n/sr/admin";
import { PREFERRED_CHANNEL_LABEL, type InquiryStatus } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { useMediaQuery } from "@/components/ui/motion";
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
  const [f, setF] = useUrlFilters(["status", "q", "vrsta", "majstori", "izvor"] as const);
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
      ...(f.izvor ? { campaign: f.izvor } : {}),
    },
    { initialNumItems: 50 },
  );
  const counts = useQuery(api.inquiriesAdmin.statusCounts, {});
  const kpis = useQuery(api.dashboard.kpis, { nowMinute });
  // Below 1280 px the tags stack under the number and „Preuzeo“ hides (no sideways scroll).
  const roomy = useMediaQuery("(min-width: 1280px)");

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "number",
        accessorKey: "number",
        header: "Broj",
        meta: { sticky: "left" },
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1 min-[1280px]:flex-row min-[1280px]:items-center min-[1280px]:gap-2">
            <DocNumber number={row.original.number} />
            {row.original.isMechanic ? <Badge tone="info">Majstor</Badge> : null}
            {row.original.isDemo ? <DemoTag /> : null}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <InquiryStatusBadge status={row.original.status} />,
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
                    "inline-flex items-center gap-1 type-caption tabular-nums",
                    level === "late"
                      ? "font-semibold text-danger"
                      : level === "soon"
                        ? "text-warning"
                        : "text-ink-3",
                  )}
                >
                  {level === "late" ? (
                    <WarningIcon size={12} weight="bold" aria-hidden="true" />
                  ) : null}
                  {minutes >= 1
                    ? `čeka ${formatElapsed(minutes)}`
                    : nowMinute - r.createdAt < 120_000
                      ? "upravo stigao"
                      : "van radnog vremena"}
                  {level === "late" ? <span className="sr-only"> — kasni</span> : null}
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
          <span className="flex max-w-[14rem] flex-col xl:max-w-[24rem]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-ink-1">
                {row.original.vehicleLabel ?? INQUIRY_KIND_LABEL[row.original.kind]}
                {row.original.vin ? (
                  <span className="type-code-s text-ink-3"> · {row.original.vin}</span>
                ) : null}
              </span>
              {row.original.photoCount > 0 ? (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 type-caption tabular-nums text-ink-2"
                  title={`Fotografija: ${row.original.photoCount}`}
                >
                  <ImageIcon size={14} aria-hidden="true" />
                  {row.original.photoCount}
                  <span className="sr-only"> fotografija</span>
                </span>
              ) : null}
            </span>
            <span className="truncate type-caption text-ink-3">{row.original.message}</span>
          </span>
        ),
      },
      {
        id: "source",
        header: "Izvor",
        enableSorting: false,
        meta: { label: "Izvor" },
        cell: ({ row }) => (
          <span className="flex flex-col whitespace-nowrap">
            <span className="text-ink-2">
              {CHANNEL_LABEL[row.original.channel] ?? row.original.channel}
            </span>
            {row.original.campaign ? (
              <span className="max-w-[10rem] truncate type-caption text-ink-3">
                {row.original.campaign}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "assignee",
        accessorKey: "assigneeName",
        header: "Preuzeo",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-ink-2">{row.original.assigneeName ?? "—"}</span>
        ),
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
        <div className="w-48">
          <Select
            size="sm"
            aria-label="Vrsta upita"
            placeholder="Sve vrste"
            value={f.vrsta}
            onChange={(e) => setF({ vrsta: e.target.value })}
            options={Object.entries(INQUIRY_KIND_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <div className="w-44">
          <Select
            size="sm"
            aria-label="Izvor upita"
            placeholder="Svi izvori"
            value={f.izvor}
            onChange={(e) => setF({ izvor: e.target.value })}
            options={[
              { value: "google_ads", label: "Google Ads" },
              { value: "meta_ads", label: "Meta oglasi" },
            ]}
          />
        </div>
        <Switch
          label="Samo majstori"
          checked={Boolean(f.majstori)}
          onCheckedChange={(v) => setF({ majstori: v ? "1" : null })}
        />
      </div>
      <DataTable
        caption="Upiti"
        columns={columns}
        columnVisibility={{ assignee: roomy, source: roomy }}
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
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["upit", "upita", "upita"]}
      />
    </div>
  );
}
