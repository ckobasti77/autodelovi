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
import { ImageIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { compactDateTime, formatElapsed } from "@/lib/admin/format";
import { workingMinutesBetween } from "@/lib/domain/sla";
import { formatPhone } from "@/lib/format/phone";
import { INQUIRY_KIND_LABEL, CHANNEL_LABEL } from "@/lib/i18n/sr/admin";
import { PREFERRED_CHANNEL_LABEL, type InquiryStatus } from "@/lib/i18n/sr/shop";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Select";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Switch } from "@/components/ui/Switch";
import { ADMIN } from "@/constants/routes";

import { useDebouncedValue, useNowMinute } from "../hooks";
import {
  Chip,
  DemoTag,
  DocNumber,
  InquiryStatusBadge,
  ON_PAGE_FIELD,
  LoadMoreFooter,
  PageHeader,
  SearchField,
  SegmentedFilter,
} from "../ui";
import { useUrlFilters } from "../useUrlFilters";
import { WaitMark, waitLevel } from "../waiting";

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
  // An unknown `?status=` (old link, typo) lists everything instead of failing the query.
  const knownStatus = TABS.some((t) => t.value === f.status);
  const { results, status, loadMore } = usePaginatedQuery(
    api.inquiriesAdmin.list,
    {
      ...(f.status && knownStatus && !mine ? { status: f.status as InquiryStatus } : {}),
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
  // Width budget (DS §9.15, D159): below 1536 px the tags stack under the number and „Traži“ is
  // capped; „Preuzeo“ shows from 1280 px and „Izvor“ from 1600 px, so nothing scrolls sideways.
  const roomy = useMediaQuery("(min-width: 1280px)");
  const wide = useMediaQuery("(min-width: 1600px)");

  // „50 od 133“: `statusCounts` holds whole-status totals (capped at 500), so they describe the
  // list only while no search or other filter narrows it.
  const countKey = mine ? "mine" : f.status;
  const listTotal =
    counts && countKey in counts && !f.q && !f.vrsta && !f.majstori && !f.izvor
      ? counts[countKey as keyof typeof counts]
      : undefined;

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "number",
        accessorKey: "number",
        header: "Broj",
        meta: { sticky: "left" },
        cell: ({ row }) => (
          // Flags are 20 px chips: under the number they fit the 48 px row (the list keeps one
          // row height), beside it from 1536 px.
          <span className="flex flex-col items-start gap-0.5 2xl:flex-row 2xl:items-center 2xl:gap-2">
            <DocNumber number={row.original.number} />
            {row.original.isMechanic || row.original.isDemo ? (
              <span className="flex items-center gap-1">
                {row.original.isMechanic ? (
                  <Chip tone="info" dense>
                    Majstor
                  </Chip>
                ) : null}
                {row.original.isDemo ? <DemoTag /> : null}
              </span>
            ) : null}
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
          const level = minutes !== null && kpis ? waitLevel(minutes, kpis.slaTargetMinutes) : "ok";
          return (
            <span className="flex flex-col whitespace-nowrap">
              <span className="tabular-nums text-ink-2">
                {compactDateTime(r.createdAt, nowMinute)}
              </span>
              {minutes !== null ? (
                // The wait is neutral ink; the grade is an icon and a word (never colour alone).
                <span className="inline-flex items-center gap-1.5 type-caption tabular-nums text-ink-3">
                  {minutes >= 1
                    ? `čeka ${formatElapsed(minutes)}`
                    : nowMinute - r.createdAt < 120_000
                      ? "upravo stigao"
                      : "van radnog vremena"}
                  {minutes >= 1 && level !== "ok" ? <WaitMark level={level} /> : null}
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
          <span className="flex max-w-[14rem] flex-col xl:max-w-[18rem] 2xl:max-w-[24rem]">
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
            <span className="truncate type-caption text-ink-3" title={row.original.message}>
              {row.original.message}
            </span>
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
            className={ON_PAGE_FIELD}
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
            className={ON_PAGE_FIELD}
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
        columnVisibility={{ assignee: roomy, source: wide }}
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
        total={listTotal}
        totalCap={500}
      />
    </div>
  );
}
