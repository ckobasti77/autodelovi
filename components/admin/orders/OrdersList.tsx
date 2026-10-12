"use client";

/**
 * `/admin/porudzbine` (DESIGN-SYSTEM §9.15, §10.11): status tabs with counts, search (`/`),
 * filters (date, delivery, payment, customer type, source, campaign) in the URL, column
 * chooser, density, CSV export of the loaded rows, bulk confirm and bulk delivery notes.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaretDownIcon,
  ColumnsIcon,
  DotsThreeIcon,
  ExportIcon,
  PrinterIcon,
  RowsIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { nextOrderStatuses } from "@/lib/domain/orderStateMachine";
import { belgradeLocalToUtc } from "@/lib/domain/time";
import { compactDateTime, downloadText, toCsv } from "@/lib/admin/format";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import {
  ADMIN_ORDER_STATUS,
  CHANNEL_LABEL,
  CUSTOMER_TYPE_LABEL,
  ORDER_SOURCE_LABEL,
  ORDER_TRANSITION_VERB,
  PAYMENT_STATUS_LABEL,
} from "@/lib/i18n/sr/admin";
import {
  convexErrorMessage,
  DELIVERY_LABEL,
  PAYMENT_LABEL,
  type OrderStatus,
} from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ADMIN } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";
import { FiltersPopover } from "../FiltersPopover";
import { useDebouncedValue, useNowMinute } from "../hooks";
import {
  DemoTag,
  DocNumber,
  LoadMoreFooter,
  OrderStatusBadge,
  PageHeader,
  SearchField,
  SegmentedFilter,
  CompactInput,
  Chip,
  IconAction,
} from "../ui";
import { useUrlFilters } from "../useUrlFilters";

type Row = FunctionReturnType<typeof api.ordersAdmin.list>["page"][number];

// „Nove“ is the default view (no `status` in the URL); „Sve“ is the explicit `status=sve`.
const STATUS_TABS: { value: OrderStatus | "sve"; label: string }[] = [
  { value: "nova", label: "Nove" },
  { value: "sve", label: "Sve" },
  { value: "potvrdjena", label: "Potvrđene" },
  { value: "ceka_deo", label: "Čeka deo" },
  { value: "spremna_za_preuzimanje", label: "Za preuzimanje" },
  { value: "poslata", label: "Poslate" },
  { value: "zavrsena", label: "Završene" },
  { value: "otkazana", label: "Otkazane" },
];

const FILTER_KEYS = [
  "status",
  "q",
  "od",
  "do",
  "dostava",
  "placanje",
  "kupac",
  "izvor",
  "kampanja",
] as const;

/** `ordersAdmin.statusCounts` stops counting at 500 per status. */
const COUNT_CAP = 500;

function dayStart(date: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? belgradeLocalToUtc(Number(m[1]), Number(m[2]), Number(m[3])) : undefined;
}

export function OrdersList() {
  const router = useRouter();
  const nowMinute = useNowMinute();
  const [f, setF] = useUrlFilters(FILTER_KEYS);
  const [search, setSearch] = useState(f.q);
  const debounced = useDebouncedValue(search, 250);
  useEffect(() => {
    if (debounced !== f.q) setF({ q: debounced });
  }, [debounced, f.q, setF]);

  // A search from the default tab looks through every status (finding a number is the point).
  const tab = f.status || (f.q ? "sve" : "nova");
  const statusArg = tab === "sve" ? undefined : (tab as OrderStatus);
  const from = f.od ? dayStart(f.od) : undefined;
  const toStart = f.do ? dayStart(f.do) : undefined;
  const args = {
    ...(statusArg ? { status: statusArg } : {}),
    ...(f.q ? { search: f.q } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(toStart !== undefined ? { to: toStart + 86_400_000 - 1 } : {}),
    ...(f.dostava ? { delivery: f.dostava as "pickup" | "courier" } : {}),
    ...(f.placanje ? { payment: f.placanje as keyof typeof PAYMENT_LABEL } : {}),
    ...(f.kupac ? { customerType: f.kupac as keyof typeof CUSTOMER_TYPE_LABEL } : {}),
    ...(f.izvor ? { source: f.izvor as keyof typeof ORDER_SOURCE_LABEL } : {}),
    ...(f.kampanja ? { campaign: f.kampanja } : {}),
  };
  const { results, status, loadMore } = usePaginatedQuery(api.ordersAdmin.list, args, {
    initialNumItems: 50,
  });
  const counts = useQuery(api.ordersAdmin.statusCounts, {});
  const transition = useMutation(api.ordersAdmin.transition);
  const confirm = useConfirm();

  const [selection, setSelection] = useState<RowSelectionState>({});
  const [density, setDensity] = useState<"default" | "compact">("default");
  // „Izvor“ fits without horizontal scrolling only on wide screens (DS §9.15); the chooser shows it anywhere.
  const wide = useMediaQuery("(min-width: 1600px)");
  // Below 1280 px the date folds under the number and „Kom.“ hides, so nothing scrolls sideways.
  const roomy = useMediaQuery("(min-width: 1280px)");
  const [chosen, setVisibility] = useState<VisibilityState>({});
  const visibility: VisibilityState = {
    source: wide,
    createdAt: roomy,
    items: roomy,
    ...chosen,
  };
  const dateFolded = visibility.createdAt === false;
  const activeFilters = [f.od, f.do, f.dostava, f.placanje, f.kupac, f.izvor, f.kampanja].filter(
    Boolean,
  ).length;
  const selected = results.filter((r) => selection[r._id]);
  // „50 od 243“: the status counts are totals of a whole status, so they only describe the list
  // while nothing else narrows it (search, date, delivery …).
  const listTotal =
    counts && statusArg && statusArg in counts && !f.q && activeFilters === 0
      ? counts[statusArg as keyof typeof counts]
      : undefined;

  /**
   * The legal next steps of one order, as menu items (the same rules and wording as the order
   * page). Each asks for confirmation; cancelling asks for the reason. „Poslata“ needs a courier
   * and a tracking number, so that one opens the order.
   */
  const askRef = useRef(confirm.ask);
  useEffect(() => {
    askRef.current = confirm.ask;
  });
  const statusItems = useCallback(
    (r: Row): MenuItem[] =>
      nextOrderStatuses(r.status, r.deliveryMethod).map((to) => {
        const label = ORDER_TRANSITION_VERB[to];
        if (to === "poslata")
          return { label: `${label}…`, onSelect: () => router.push(ADMIN.order(r.number)) };
        return {
          label,
          danger: to === "otkazana",
          onSelect: () =>
            askRef.current({
              title: `${label} — ${r.number}`,
              description:
                to === "potvrdjena"
                  ? "Stanje se umanjuje za artikle iz porudžbine; kupac dobija potvrdu."
                  : to === "otkazana"
                    ? "Kupac dobija obaveštenje sa razlogom."
                    : to === "zavrsena"
                      ? "Porudžbina se zatvara; posle toga se više ne menja."
                      : "Kupac dobija obaveštenje o promeni statusa.",
              confirmLabel: label,
              danger: to === "otkazana",
              ...(to === "otkazana" ? { reasonLabel: "Razlog otkazivanja" } : {}),
              onConfirm: async (reason) => {
                await transition({
                  orderId: r._id as Id<"orders">,
                  to,
                  expectedUpdatedAt: r.updatedAt,
                  ...(to === "otkazana" ? { reason } : {}),
                });
                toast.success(`${r.number}: ${ADMIN_ORDER_STATUS[to].label.toLowerCase()}.`);
              },
            }),
        };
      }),
    [router, transition],
  );

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "number",
        accessorKey: "number",
        header: "Broj",
        meta: { sticky: "left" },
        cell: ({ row }) => (
          <span className="flex flex-col" data-testid={TEST_IDS.adminOrderRow}>
            <span className="flex items-center gap-2">
              <DocNumber number={row.original.number} />
              {row.original.isDemo ? <DemoTag /> : null}
            </span>
            {dateFolded ? (
              <span className="whitespace-nowrap type-caption tabular-nums text-ink-3">
                {compactDateTime(row.original.createdAt, nowMinute)}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Primljena",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-2">
            {compactDateTime(row.original.createdAt, nowMinute)}
          </span>
        ),
      },
      {
        id: "customer",
        accessorKey: "customerName",
        header: "Kupac",
        meta: { label: "Kupac" },
        cell: ({ row }) => (
          // Capped and truncated (full name in the tooltip) so a long company name never pushes
          // the list into sideways scrolling (VIS-15).
          <span
            className="flex min-w-[10rem] max-w-[13rem] flex-col 2xl:max-w-[18rem]"
            title={
              row.original.companyName
                ? `${row.original.companyName} · ${row.original.customerName}`
                : row.original.customerName
            }
          >
            <span className="truncate font-medium text-ink-1">
              {row.original.companyName ?? row.original.customerName}
            </span>
            <span className="truncate type-caption text-ink-3">
              {row.original.companyName ? `${row.original.customerName} · ` : ""}
              {CUSTOMER_TYPE_LABEL[row.original.customerType]}
            </span>
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const r = row.original;
          const items = statusItems(r);
          return (
            // The flag is a 20 px chip: under the status it still fits the 48 px row, so the list
            // keeps one row height; beside it from 1536 px.
            <span className="flex flex-col items-start gap-0.5 whitespace-nowrap 2xl:flex-row 2xl:items-center 2xl:gap-1.5">
              {items.length > 0 ? (
                // The chip is the control: the legal next steps open from the row. Not a tab
                // stop — the same items are in the row's „Radnje“ menu, one stop per row.
                <Menu
                  align="start"
                  trigger={
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`Status ${r.number}: ${ADMIN_ORDER_STATUS[r.status].label}. Promeni status`}
                      title="Promeni status"
                      className="group/status -my-1 -ml-1 inline-flex h-8 cursor-pointer items-center gap-0.5 rounded-sm pl-1 pr-0.5 transition-control hover:bg-surface-4 focus-ring-inset"
                    >
                      <OrderStatusBadge status={r.status} />
                      <CaretDownIcon
                        size={12}
                        weight="bold"
                        aria-hidden="true"
                        className="text-ink-4 transition-control group-hover/status:text-ink-2"
                      />
                    </button>
                  }
                  items={items}
                />
              ) : (
                <OrderStatusBadge status={r.status} />
              )}
              {r.hasBackorder && r.status === "nova" ? (
                <Chip tone="warning" dense>
                  Ima po porudžbini
                </Chip>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "items",
        accessorKey: "itemCount",
        header: "Kom.",
        meta: { align: "right", label: "Komada" },
        cell: ({ getValue }) => <span>{String(getValue())}</span>,
      },
      {
        id: "total",
        accessorKey: "totalPara",
        header: "Ukupno",
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-medium text-ink-1">
            {formatRSD(Number(getValue()))}
          </span>
        ),
      },
      {
        id: "payment",
        header: "Plaćanje · dostava",
        enableSorting: false,
        meta: { label: "Plaćanje i dostava" },
        cell: ({ row }) => (
          // Capped and cut on one line each (the full text is the tooltip): a long method such as
          // „Gotovinom pri preuzimanju · Plaćeno“ neither widens the table (VIS-15) nor wraps into
          // a third line that would make its row taller than the rest.
          <span
            className="flex min-w-[9rem] max-w-[14rem] flex-col"
            title={`${PAYMENT_LABEL[row.original.paymentMethod]}${
              row.original.paymentStatus === "paid" ? ` · ${PAYMENT_STATUS_LABEL.paid}` : ""
            } · ${DELIVERY_LABEL[row.original.deliveryMethod]}${
              row.original.trackingNumber ? ` · ${row.original.trackingNumber}` : ""
            }`}
          >
            <span className="truncate text-ink-1">
              {PAYMENT_LABEL[row.original.paymentMethod]}
              {row.original.paymentStatus === "paid" ? (
                <span className="text-success"> · {PAYMENT_STATUS_LABEL.paid}</span>
              ) : null}
            </span>
            <span className="truncate type-caption text-ink-3">
              {DELIVERY_LABEL[row.original.deliveryMethod]}
              {row.original.trackingNumber ? ` · ${row.original.trackingNumber}` : ""}
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
            <span className="text-ink-2">{ORDER_SOURCE_LABEL[row.original.source]}</span>
            {row.original.channel || row.original.campaign ? (
              <span className="max-w-[12rem] truncate type-caption text-ink-3">
                {[
                  row.original.channel
                    ? (CHANNEL_LABEL[row.original.channel] ?? row.original.channel)
                    : null,
                  row.original.campaign,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Radnje</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { sticky: "right", widthClass: "w-12" },
        cell: ({ row }) => {
          const steps = statusItems(row.original);
          return (
            <Menu
              trigger={
                <IconButton
                  label={`Radnje za ${row.original.number}`}
                  title="Radnje"
                  icon={<DotsThreeIcon size={20} weight="bold" />}
                  size="sm"
                />
              }
              items={[
                { label: "Otvori", onSelect: () => router.push(ADMIN.order(row.original.number)) },
                {
                  label: "Štampaj predračun",
                  icon: <PrinterIcon size={18} />,
                  href: ADMIN.orderProforma(row.original.number),
                },
                {
                  label: "Otpremnica",
                  icon: <PrinterIcon size={18} />,
                  href: ADMIN.orderDeliveryNote(row.original.number),
                },
                ...(steps.length > 0
                  ? [
                      { type: "separator" as const },
                      { type: "label" as const, label: "Promeni status" },
                      ...steps,
                    ]
                  : []),
              ]}
            />
          );
        },
      },
    ],
    [dateFolded, nowMinute, router, statusItems],
  );

  const exportCsv = () => {
    const rows = [
      [
        "Broj",
        "Datum",
        "Status",
        "Kupac",
        "Firma",
        "Telefon",
        "Tip",
        "Komada",
        "Ukupno (RSD)",
        "Plaćanje",
        "Plaćeno",
        "Dostava",
        "Broj pošiljke",
        "Izvor",
        "Kampanja",
      ],
      ...results.map((r) => [
        r.number,
        compactDateTime(r.createdAt, 0),
        ADMIN_ORDER_STATUS[r.status].label,
        r.customerName,
        r.companyName ?? "",
        formatPhone(r.phone),
        CUSTOMER_TYPE_LABEL[r.customerType],
        r.itemCount,
        (r.totalPara / 100).toFixed(2).replace(".", ","),
        PAYMENT_LABEL[r.paymentMethod],
        PAYMENT_STATUS_LABEL[r.paymentStatus],
        DELIVERY_LABEL[r.deliveryMethod],
        r.trackingNumber ?? "",
        ORDER_SOURCE_LABEL[r.source],
        r.campaign ?? "",
      ]),
    ];
    downloadText(`porudzbine-${new Date(nowMinute).toISOString().slice(0, 10)}.csv`, toCsv(rows));
  };

  const bulkConfirm = () => {
    const targets = selected.filter((r) => r.status === "nova" || r.status === "ceka_deo");
    confirm.ask({
      title: `Potvrditi ${targets.length} porudžbin${targets.length === 1 ? "u" : "e"}?`,
      description:
        targets.length < selected.length
          ? `Potvrđuju se samo nove i one koje čekaju deo (${targets.length} od ${selected.length}). Stanje se umanjuje za svaku, kupci dobijaju obaveštenje.`
          : "Stanje se umanjuje za svaku porudžbinu, kupci dobijaju obaveštenje.",
      confirmLabel: "Potvrdi",
      onConfirm: async () => {
        let ok = 0;
        const failed: string[] = [];
        for (const r of targets) {
          try {
            await transition({
              orderId: r._id as Id<"orders">,
              to: "potvrdjena",
              expectedUpdatedAt: r.updatedAt,
            });
            ok++;
          } catch (err) {
            failed.push(`${r.number}: ${convexErrorMessage(err, "greška")}`);
          }
        }
        setSelection({});
        if (failed.length)
          toast.error(`Potvrđeno ${ok}, nije ${failed.length}.`, {
            description: failed.join(" · "),
          });
        else toast.success(`Potvrđeno: ${ok}.`);
      },
    });
  };

  const empty =
    tab === "nova" && !f.q && activeFilters === 0
      ? "Nema novih porudžbina."
      : f.q || activeFilters
        ? "Nema porudžbina za ovu pretragu i filtere."
        : "Nema porudžbina sa ovim statusom.";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Porudžbine"
        description="Sve porudžbine sa sajta, iz upita i brze porudžbine majstora."
      />
      <SegmentedFilter
        label="Status porudžbine"
        value={tab}
        onChange={(status) => {
          setSelection({});
          setF({ status: status === "nova" ? "" : status });
        }}
        options={STATUS_TABS.map((t) => ({
          ...t,
          count: counts && t.value in counts ? counts[t.value as keyof typeof counts] : undefined,
        }))}
      />
      {selected.length > 0 ? (
        <div
          className="flex min-h-12 flex-wrap items-center gap-3 panel-raised px-3 py-1"
          role="region"
          aria-label="Grupne radnje"
        >
          <span className="type-body-s font-semibold">{selected.length} izabrano</span>
          <Button
            size="sm"
            onClick={bulkConfirm}
            disabled={!selected.some((r) => r.status === "nova" || r.status === "ceka_deo")}
          >
            Potvrdi
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<PrinterIcon size={16} />}
            onClick={() =>
              window.open(
                `/admin/stampa/otpremnice?brojevi=${encodeURIComponent(selected.map((r) => r.number).join(","))}`,
                "_blank",
              )
            }
          >
            Štampaj otpremnice
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Poništi izbor
          </Button>
        </div>
      ) : (
        // Same 48 px slot as the bulk bar: selecting a row must not move the rows under the pointer.
        <div className="flex min-h-12 flex-wrap items-center gap-2">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Pretraga porudžbina"
            placeholder="Broj, ime, telefon, e-mail, PIB…"
          />
          <FiltersPopover
            active={activeFilters}
            onReset={() =>
              setF({
                od: null,
                do: null,
                dostava: null,
                placanje: null,
                kupac: null,
                izvor: null,
                kampanja: null,
              })
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Od datuma">
                <CompactInput
                  type="date"
                  value={f.od}
                  onChange={(e) => setF({ od: e.target.value })}
                />
              </Field>
              <Field label="Do datuma">
                <CompactInput
                  type="date"
                  value={f.do}
                  onChange={(e) => setF({ do: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Dostava">
              <Select
                size="sm"
                placeholder="Sve"
                value={f.dostava}
                onChange={(e) => setF({ dostava: e.target.value })}
                options={Object.entries(DELIVERY_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Plaćanje">
              <Select
                size="sm"
                placeholder="Sva"
                value={f.placanje}
                onChange={(e) => setF({ placanje: e.target.value })}
                options={Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Tip kupca">
              <Select
                size="sm"
                placeholder="Svi"
                value={f.kupac}
                onChange={(e) => setF({ kupac: e.target.value })}
                options={Object.entries(CUSTOMER_TYPE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field label="Izvor">
              <Select
                size="sm"
                placeholder="Svi"
                value={f.izvor}
                onChange={(e) => setF({ izvor: e.target.value })}
                options={Object.entries(ORDER_SOURCE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field
              label="Kampanja"
              help="utm_campaign, ili google_ads / meta_ads za klikove iz oglasa"
            >
              <CompactInput
                value={f.kampanja}
                onChange={(e) => setF({ kampanja: e.target.value })}
              />
            </Field>
          </FiltersPopover>
          <div className="ml-auto flex items-center gap-1">
            <Menu
              trigger={
                <IconButton
                  label="Kolone"
                  title="Kolone"
                  icon={<ColumnsIcon size={18} />}
                  size="sm"
                  variant="quiet"
                />
              }
              items={[
                { type: "label", label: "Prikaži kolone" },
                ...(["createdAt", "customer", "items", "payment", "source"] as const).map((id) => ({
                  type: "checkbox" as const,
                  label: {
                    createdAt: "Primljena",
                    customer: "Kupac",
                    items: "Komada",
                    payment: "Plaćanje i dostava",
                    source: "Izvor",
                  }[id],
                  checked: visibility[id] !== false,
                  onCheckedChange: (checked: boolean) =>
                    setVisibility({ ...visibility, [id]: checked }),
                })),
              ]}
            />
            <IconAction
              label={density === "compact" ? "Normalni redovi" : "Gusti redovi"}
              icon={<RowsIcon size={18} />}
              size="sm"
              variant="quiet"
              aria-pressed={density === "compact"}
              onClick={() => setDensity(density === "compact" ? "default" : "compact")}
            />
            <Button
              variant="quiet"
              size="sm"
              icon={<ExportIcon size={16} />}
              onClick={exportCsv}
              disabled={results.length === 0}
            >
              Izvoz za Excel
            </Button>
          </div>
        </div>
      )}
      <DataTable
        caption="Porudžbine"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        rowLabel={(r) => r.number}
        enableRowSelection
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        columnVisibility={visibility}
        onColumnVisibilityChange={setVisibility}
        density={density}
        loading={status === "LoadingFirstPage"}
        onRowOpen={(r) => router.push(ADMIN.order(r.number))}
        empty={<p className="py-10 text-center type-body-s text-ink-2">{empty}</p>}
      />
      <LoadMoreFooter
        shown={results.length}
        status={status}
        onMore={loadMore}
        forms={["porudžbina", "porudžbine", "porudžbina"]}
        total={listTotal}
        totalCap={COUNT_CAP}
      />
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}
