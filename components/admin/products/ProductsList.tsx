"use client";

/**
 * `/admin/proizvodi` (DESIGN-SYSTEM §10.12): search (OEM / šifra / naziv), filters in the
 * URL, column chooser, density, stock edited inline (a correction with a reason in the
 * stock log), bulk activate / deactivate / change category / price %, each with „Poništi“.
 */
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ColumnsIcon, DotsThreeIcon, PlusIcon, RowsIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { compactDate, parsePercent } from "@/lib/admin/format";
import { formatRSD } from "@/lib/format/money";
import { STOCK_STATE_LABEL, STOCK_STATE_TONE } from "@/lib/i18n/sr/admin";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
} from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { RouteLink } from "@/components/ui/RouteLink";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { ADMIN, ROUTES } from "@/constants/routes";

import { FiltersPopover } from "../FiltersPopover";
import { useDebouncedValue, useNowMinute } from "../hooks";
import { DemoTag, LoadMoreFooter, PageHeader, SearchField, SegmentedFilter } from "../ui";
import { useUrlFilters } from "../useUrlFilters";

type Row = FunctionReturnType<typeof api.catalog.productsAdmin.list>["page"][number];
type Undo = FunctionArgs<typeof api.catalog.productsAdmin.bulkRestore>["items"];

function StockCell({ row }: { row: Row }) {
  const adjust = useMutation(api.catalog.productsAdmin.adjustStock);
  const [value, setValue] = useState(String(row.stockQty));
  const [busy, setBusy] = useState(false);
  const [prev, setPrev] = useState(row.stockQty);
  if (prev !== row.stockQty) {
    setPrev(row.stockQty);
    setValue(String(row.stockQty));
  }
  const commit = async () => {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) {
      setValue(String(row.stockQty));
      toast.error("Stanje mora biti ceo broj, 0 ili više.");
      return;
    }
    if (next === row.stockQty) return;
    setBusy(true);
    try {
      await adjust({
        productId: row._id,
        delta: next - row.stockQty,
        reason: "correction",
        note: "Izmena u tabeli artikala",
      });
      toast.success(`${row.sku}: stanje ${row.stockQty} → ${next} kom.`, {
        action: {
          label: "Poništi",
          onClick: () =>
            void adjust({
              productId: row._id,
              delta: row.stockQty - next,
              reason: "correction",
              note: "Poništena izmena u tabeli",
            }),
        },
      });
    } catch (err) {
      setValue(String(row.stockQty));
      toast.error(convexErrorMessage(err, "Stanje nije sačuvano."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <input
      aria-label={`Stanje, ${row.sku}`}
      inputMode="numeric"
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValue(String(row.stockQty));
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-16 rounded-xs border border-transparent bg-transparent px-2 text-right tabular-nums transition-control hover:border-control focus:border-focus focus:bg-surface-1 focus:outline-none"
    />
  );
}

export function ProductsList() {
  const router = useRouter();
  const nowMinute = useNowMinute();
  const [f, setF] = useUrlFilters([
    "q",
    "status",
    "kategorija",
    "proizvodjac",
    "stanje",
    "kvalitet",
    "demo",
  ] as const);
  const [search, setSearch] = useState(f.q);
  const debounced = useDebouncedValue(search, 250);
  useEffect(() => {
    if (debounced !== f.q) setF({ q: debounced });
  }, [debounced, f.q, setF]);
  const categories = useQuery(api.catalog.categoriesAdmin.options, {});
  const manufacturers = useQuery(api.catalog.manufacturersAdmin.list, {});
  const { results, status, loadMore } = usePaginatedQuery(
    api.catalog.productsAdmin.list,
    {
      ...(f.q ? { search: f.q } : {}),
      ...(f.status ? { active: f.status === "aktivni" } : {}),
      ...(f.kategorija ? { categoryId: f.kategorija as Id<"categories"> } : {}),
      ...(f.proizvodjac ? { manufacturerId: f.proizvodjac as Id<"manufacturers"> } : {}),
      ...(f.stanje ? { stockState: f.stanje as keyof typeof STOCK_STATE_LABEL } : {}),
      ...(f.kvalitet ? { quality: f.kvalitet as keyof typeof QUALITY_LABEL } : {}),
      ...(f.demo ? { demo: f.demo === "da" } : {}),
    },
    { initialNumItems: 50 },
  );
  const bulkActive = useMutation(api.catalog.productsAdmin.bulkSetActive);
  const bulkCategory = useMutation(api.catalog.productsAdmin.bulkSetCategory);
  const bulkPrice = useMutation(api.catalog.productsAdmin.bulkAdjustPrice);
  const bulkRestore = useMutation(api.catalog.productsAdmin.bulkRestore);
  const duplicate = useMutation(api.catalog.productsAdmin.duplicate);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [visibility, setVisibility] = useState<VisibilityState>({ updatedAt: false });
  const [density, setDensity] = useState<"default" | "compact">("default");
  const [dialog, setDialog] = useState<"category" | "price" | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [percent, setPercent] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedIds = Object.keys(selection).filter((k) => selection[k]) as Id<"products">[];
  const activeFilters = [f.kategorija, f.proizvodjac, f.stanje, f.kvalitet, f.demo].filter(
    Boolean,
  ).length;

  const withUndo = async (label: string, run: () => Promise<Undo>) => {
    setBusy(true);
    try {
      const undo = await run();
      setSelection({});
      setDialog(null);
      toast.success(`${label}: ${undo.length} ${undo.length === 1 ? "artikal" : "artikala"}.`, {
        duration: 10_000,
        ...(undo.length
          ? {
              action: {
                label: "Poništi",
                onClick: () =>
                  void bulkRestore({ items: undo }).then(() =>
                    toast.info("Grupna izmena je poništena."),
                  ),
              },
            }
          : {}),
      });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Grupna izmena nije izvršena."));
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "product",
        accessorKey: "name",
        header: "Artikal",
        meta: { sticky: "left", label: "Artikal" },
        cell: ({ row }) => {
          const p = row.original;
          const thumb = p.thumbUrl ?? p.categoryThumb;
          return (
            <span className="flex min-w-[16rem] items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-line-faint bg-surface-2">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 40 px admin thumbnail (Convex URL or category render)
                  <img src={thumb} alt="" className="size-full object-contain" loading="lazy" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-ink-1">{p.name}</span>
                <span className="flex items-center gap-1.5 type-caption text-ink-3">
                  <span className="type-code-s">{p.sku}</span>
                  {p.isDemo ? <DemoTag /> : null}
                  {!p.active ? <Badge tone="neutral">Neaktivan</Badge> : null}
                </span>
              </span>
            </span>
          );
        },
      },
      {
        id: "oem",
        accessorKey: "oemPrimary",
        header: "OEM",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap type-code-s text-ink-2">
            {row.original.oemPrimary ?? "—"}
          </span>
        ),
      },
      {
        id: "category",
        accessorKey: "categoryName",
        header: "Kategorija",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-ink-2">{row.original.categoryName}</span>
        ),
      },
      {
        id: "manufacturer",
        accessorKey: "manufacturerName",
        header: "Proizvođač",
        cell: ({ row }) => (
          <span className="flex flex-col whitespace-nowrap">
            <span className="text-ink-1">{row.original.manufacturerName}</span>
            <span className="type-caption text-ink-3">{QUALITY_LABEL[row.original.quality]}</span>
          </span>
        ),
      },
      {
        id: "stock",
        accessorKey: "stockQty",
        header: "Stanje",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex items-center justify-end gap-2">
            {row.original.stockState !== "in_stock" ? (
              <Badge tone={STOCK_STATE_TONE[row.original.stockState]}>
                {STOCK_STATE_LABEL[row.original.stockState]}
              </Badge>
            ) : null}
            <StockCell row={row.original} />
          </span>
        ),
      },
      {
        id: "price",
        accessorKey: "retailPricePara",
        header: "Cena",
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap font-medium">{formatRSD(Number(getValue()))}</span>
        ),
      },
      {
        id: "fitments",
        accessorKey: "fitmentCount",
        header: "Vozila",
        meta: { align: "right", label: "Broj vozila" },
        cell: ({ getValue }) => <span className="text-ink-2">{String(getValue())}</span>,
      },
      {
        id: "updatedAt",
        accessorKey: "updatedAt",
        header: "Izmenjen",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap tabular-nums text-ink-3">
            {compactDate(Number(getValue()), nowMinute)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Radnje</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { sticky: "right", widthClass: "w-12" },
        cell: ({ row }) => (
          <Menu
            trigger={
              <IconButton
                label={`Radnje za ${row.original.sku}`}
                icon={<DotsThreeIcon size={20} weight="bold" />}
                size="sm"
              />
            }
            items={[
              { label: "Otvori", onSelect: () => router.push(ADMIN.product(row.original._id)) },
              {
                label: "Dupliraj",
                onSelect: () =>
                  void duplicate({ productId: row.original._id }).then(
                    (id) => {
                      toast.success("Kopija je napravljena (neaktivna, stanje 0).");
                      router.push(ADMIN.product(id));
                    },
                    (err) => toast.error(convexErrorMessage(err, "Kopija nije napravljena.")),
                  ),
              },
              ...(row.original.active
                ? [{ label: "Pogledaj na sajtu", href: ROUTES.product(row.original.slug) }]
                : []),
            ]}
          />
        ),
      },
    ],
    [duplicate, nowMinute, router],
  );

  const percentValue = parsePercent(percent);
  const example =
    percentValue !== undefined && !Number.isNaN(percentValue)
      ? Math.round((1_000_000 * (1 + percentValue / 100)) / 100) * 100
      : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Proizvodi"
        description="Katalog delova: cene, stanje, brojevi, kompatibilnost i slike."
        actions={
          <Button asChild icon={<PlusIcon size={18} />}>
            <RouteLink href={ADMIN.productNew}>Novi artikal</RouteLink>
          </Button>
        }
      />
      <SegmentedFilter
        label="Status artikla"
        value={f.status}
        onChange={(v) => setF({ status: v })}
        options={[
          { value: "", label: "Svi" },
          { value: "aktivni", label: "Aktivni" },
          { value: "neaktivni", label: "Neaktivni" },
        ]}
      />
      {selectedIds.length > 0 ? (
        <div
          className="flex min-h-12 flex-wrap items-center gap-2 rounded-sm border border-line-strong bg-surface-1 px-3 py-2"
          role="region"
          aria-label="Grupne radnje"
        >
          <span className="mr-1 type-body-s font-semibold">{selectedIds.length} izabrano</span>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() =>
              void withUndo("Aktivirano", () =>
                bulkActive({ productIds: selectedIds, active: true }),
              )
            }
          >
            Aktiviraj
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() =>
              void withUndo("Deaktivirano", () =>
                bulkActive({ productIds: selectedIds, active: false }),
              )
            }
          >
            Deaktiviraj
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("category")}>
            Promeni kategoriju
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("price")}>
            Promeni cene %
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
            Poništi izbor
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Pretraga artikala"
            placeholder="OEM, šifra, naziv…"
          />
          <FiltersPopover
            active={activeFilters}
            onReset={() =>
              setF({
                kategorija: null,
                proizvodjac: null,
                stanje: null,
                kvalitet: null,
                demo: null,
              })
            }
          >
            <Field label="Kategorija">
              <Select
                size="sm"
                placeholder="Sve"
                value={f.kategorija}
                onChange={(e) => setF({ kategorija: e.target.value })}
                options={(categories ?? []).map((c) => ({ value: c._id, label: c.label }))}
              />
            </Field>
            <Field label="Proizvođač">
              <Select
                size="sm"
                placeholder="Svi"
                value={f.proizvodjac}
                onChange={(e) => setF({ proizvodjac: e.target.value })}
                options={(manufacturers ?? []).map((m) => ({ value: m._id, label: m.name }))}
              />
            </Field>
            <Field label="Stanje">
              <Select
                size="sm"
                placeholder="Sva"
                value={f.stanje}
                onChange={(e) => setF({ stanje: e.target.value })}
                options={Object.entries(STOCK_STATE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field label="Kvalitet">
              <Select
                size="sm"
                placeholder="Svi"
                value={f.kvalitet}
                onChange={(e) => setF({ kvalitet: e.target.value })}
                options={Object.entries(QUALITY_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Demo podaci">
              <Select
                size="sm"
                placeholder="Svi"
                value={f.demo}
                onChange={(e) => setF({ demo: e.target.value })}
                options={[
                  { value: "da", label: "Samo demo" },
                  { value: "ne", label: "Bez demo" },
                ]}
              />
            </Field>
          </FiltersPopover>
          <div className="ml-auto flex items-center gap-1">
            <Menu
              trigger={
                <IconButton
                  label="Kolone"
                  icon={<ColumnsIcon size={18} />}
                  size="sm"
                  variant="secondary"
                />
              }
              items={[
                { type: "label", label: "Prikaži kolone" },
                ...(["oem", "category", "manufacturer", "fitments", "updatedAt"] as const).map(
                  (id) => ({
                    type: "checkbox" as const,
                    label: {
                      oem: "OEM",
                      category: "Kategorija",
                      manufacturer: "Proizvođač",
                      fitments: "Broj vozila",
                      updatedAt: "Izmenjen",
                    }[id],
                    checked: visibility[id] !== false,
                    onCheckedChange: (checked: boolean) =>
                      setVisibility({ ...visibility, [id]: checked }),
                  }),
                ),
              ]}
            />
            <IconButton
              label={density === "compact" ? "Normalni redovi" : "Gusti redovi"}
              icon={<RowsIcon size={18} />}
              size="sm"
              variant="secondary"
              aria-pressed={density === "compact"}
              onClick={() => setDensity(density === "compact" ? "default" : "compact")}
            />
          </div>
        </div>
      )}
      <DataTable
        caption="Proizvodi"
        columns={columns}
        data={results}
        getRowId={(r) => r._id}
        rowLabel={(r) => `${r.sku} ${r.name}`}
        enableRowSelection
        rowSelection={selection}
        onRowSelectionChange={setSelection}
        columnVisibility={visibility}
        onColumnVisibilityChange={setVisibility}
        density={density}
        loading={status === "LoadingFirstPage"}
        onRowOpen={(r) => router.push(ADMIN.product(r._id))}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            Nema artikala za ovu pretragu i filtere.
          </p>
        }
      />
      <LoadMoreFooter shown={results.length} status={status} onMore={loadMore} noun="artikala" />

      <Dialog
        open={dialog === "category"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`Premesti ${selectedIds.length} artikala`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Odustani
            </Button>
            <Button
              loading={busy}
              disabled={!bulkCategoryId}
              onClick={() =>
                void withUndo("Premešteno", () =>
                  bulkCategory({
                    productIds: selectedIds,
                    categoryId: bulkCategoryId as Id<"categories">,
                  }),
                )
              }
            >
              Premesti
            </Button>
          </>
        }
      >
        <Field label="Nova kategorija">
          <Select
            placeholder="Izaberite"
            value={bulkCategoryId}
            onChange={(e) => setBulkCategoryId(e.target.value)}
            options={(categories ?? []).map((c) => ({ value: c._id, label: c.label }))}
          />
        </Field>
      </Dialog>
      <Dialog
        open={dialog === "price"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`Promena cene za ${selectedIds.length} artikala`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Odustani
            </Button>
            <Button
              loading={busy}
              disabled={
                percentValue === undefined || Number.isNaN(percentValue) || percentValue === 0
              }
              onClick={() =>
                void withUndo("Promenjene cene", () =>
                  bulkPrice({ productIds: selectedIds, percent: percentValue! }),
                )
              }
            >
              Promeni cene
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Promena u procentima"
            help="Pozitivno poskupljuje, negativno pojeftinjuje; cene se zaokružuju na ceo dinar."
          >
            <Input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              suffix="%"
              inputMode="decimal"
              placeholder="npr. 5 ili -10"
            />
          </Field>
          {example !== null ? (
            <p className="type-body-s text-ink-2">
              Primer: artikal od {formatRSD(1_000_000)} →{" "}
              <span className="font-semibold text-ink-1">{formatRSD(example)}</span>. Svaka promena
              ulazi u istoriju cena.
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}
