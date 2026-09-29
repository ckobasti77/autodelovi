"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  DotsThreeIcon,
  PackageIcon,
  WarningCircleIcon,
  XCircleIcon,
  CubeIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type ColumnDef, type RowSelectionState } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import { Price } from "@/components/ui/Price";
import { Skeleton, SkeletonRegion, SkeletonText } from "@/components/ui/Skeleton";
import { StockBadge } from "@/components/ui/StockBadge";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { formatDateShort, formatRSD } from "@/lib/format";
import { Group, Specimen } from "./Section";

type OrderRow = {
  id: string;
  number: string;
  customer: string;
  createdAt: string;
  totalPara: number;
  status: "nova" | "potvrdjena" | "spremna" | "isporucena" | "ceka_deo" | "otkazana";
};

/** Sample rows for the table specimen only (styleguide, noindex). */
const ORDERS: OrderRow[] = [
  {
    id: "187",
    number: "000187",
    customer: "Auto servis Kovačević",
    createdAt: "2026-09-29T09:42:00Z",
    totalPara: 1847000,
    status: "nova",
  },
  {
    id: "186",
    number: "000186",
    customer: "Jelena Marić",
    createdAt: "2026-09-29T07:15:00Z",
    totalPara: 429000,
    status: "potvrdjena",
  },
  {
    id: "185",
    number: "000185",
    customer: "Servis Đurić i sinovi",
    createdAt: "2026-09-28T14:03:00Z",
    totalPara: 6512050,
    status: "spremna",
  },
  {
    id: "184",
    number: "000184",
    customer: "Stefan Ilić",
    createdAt: "2026-09-27T11:30:00Z",
    totalPara: 1299000,
    status: "isporucena",
  },
  {
    id: "183",
    number: "000183",
    customer: "Milica Šarić",
    createdAt: "2026-09-26T16:48:00Z",
    totalPara: 238900,
    status: "ceka_deo",
  },
  {
    id: "182",
    number: "000182",
    customer: "Nikola Stanković",
    createdAt: "2026-09-26T08:05:00Z",
    totalPara: 915000,
    status: "otkazana",
  },
];

const STATUS = {
  nova: { tone: "accent", label: "Nova", icon: <WarningCircleIcon size={14} weight="bold" /> },
  potvrdjena: {
    tone: "info",
    label: "Potvrđena",
    icon: <CheckCircleIcon size={14} weight="bold" />,
  },
  spremna: { tone: "info", label: "Za preuzimanje", icon: <PackageIcon size={14} weight="bold" /> },
  isporucena: {
    tone: "success",
    label: "Isporučena",
    icon: <CheckCircleIcon size={14} weight="bold" />,
  },
  ceka_deo: { tone: "warning", label: "Čeka deo", icon: <ClockIcon size={14} weight="bold" /> },
  otkazana: { tone: "danger", label: "Otkazana", icon: <XCircleIcon size={14} weight="bold" /> },
} as const;

const STEPS = [
  { id: "contact", label: "Kontakt" },
  { id: "delivery", label: "Dostava" },
  { id: "payment", label: "Plaćanje" },
  { id: "review", label: "Pregled" },
];

export function GalleryData() {
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [compact, setCompact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  const columns = useMemo<ColumnDef<OrderRow, unknown>[]>(
    () => [
      {
        accessorKey: "number",
        header: "Broj",
        meta: { widthClass: "w-40" },
        cell: ({ row }) => (
          <span className="type-code whitespace-nowrap">
            <span className="text-ink-3">SK-2026-</span>
            <span className="text-ink-1">{row.original.number}</span>
          </span>
        ),
      },
      {
        accessorKey: "customer",
        header: "Kupac",
        cell: ({ getValue }) => <span className="font-semibold">{String(getValue())}</span>,
      },
      {
        accessorKey: "createdAt",
        header: "Primljena",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-ink-2">{formatDateShort(String(getValue()))}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => {
          const status = STATUS[row.original.status];
          return (
            <Badge tone={status.tone} icon={status.icon}>
              {status.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalPara",
        header: "Ukupno",
        meta: { align: "right" },
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{formatRSD(Number(getValue()))}</span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Radnje</span>,
        enableSorting: false,
        meta: { sticky: "right", widthClass: "w-12" },
        cell: ({ row }) => (
          <IconButton
            label={`Radnje za SK-2026-${row.original.number}`}
            size="sm"
            icon={<DotsThreeIcon size={20} weight="bold" />}
            onClick={() => toast.info(`Radnje za SK-2026-${row.original.number}`)}
          />
        ),
      },
    ],
    [],
  );

  const selectedCount = Object.values(selection).filter(Boolean).length;

  return (
    <>
      <Group
        title="Cena i stanje"
        note="Žive vrednosti: nikad skrivene otkrivanjem teksta. „sa PDV-om“ uvek stoji uz cenu."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Specimen label="Price · retail · m">
            <Price para={1299000} />
          </Specimen>
          <Specimen label="Price · mechanic · m">
            <Price para={1104150} variant="mechanic" retailPara={1299000} />
          </Specimen>
          <Specimen label="Price · mechanic · l · rabat">
            <Price para={364650} variant="mechanic" retailPara={429000} discount={0.15} size="l" />
          </Specimen>
          <Specimen label="Price · decimale">
            <Price para={1299050} size="s" />
          </Specimen>
        </div>
        <Specimen label="StockBadge · inline · chip">
          <StockBadge status="in_stock" quantity={4} />
          <StockBadge status="in_stock" quantity={24} />
          <StockBadge status="low" quantity={2} />
          <StockBadge status="on_order" leadTime="3–5 dana" />
          <StockBadge status="out" />
        </Specimen>
        <Specimen label="StockBadge · chip">
          <StockBadge status="in_stock" quantity={4} variant="chip" />
          <StockBadge status="low" quantity={2} variant="chip" />
          <StockBadge status="on_order" variant="chip" />
          <StockBadge status="out" variant="chip" />
        </Specimen>
      </Group>

      <Group title="Kartica" note="Nivo 1: surface-1 + ivica; interaktivna podiže ivicu na hover.">
        <div className="grid gap-(--gutter) sm:grid-cols-2 lg:grid-cols-3">
          <Card interactive>
            <article className="flex flex-col gap-1.5">
              <span className="type-caption font-normal text-ink-3">Brembo · OEM kvalitet</span>
              <h4 className="type-h4 text-ink-1">Kočioni disk prednji, Ø 312 mm</h4>
              <span className="type-code text-ink-2">
                <span className="font-ui type-caption text-ink-3">OEM</span> 5Q0 615 301 F
              </span>
              <StockBadge status="in_stock" quantity={4} />
              <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-3">
                <Price para={1299000} />
                <Button variant="quiet" aria-label="U korpu: Kočioni disk prednji, Ø 312 mm">
                  U korpu
                </Button>
              </div>
            </article>
          </Card>
          <Card raised>
            <h4 className="type-h4 text-ink-1">Naglašena kartica</h4>
            <p className="mt-1 type-body-s text-ink-2">
              Ivica line-strong za lepljive trake i liste pod jakim svetlom.
            </p>
          </Card>
          <Card>
            <SkeletonRegion>
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="mt-3 h-3 w-24" />
              <SkeletonText lines={2} className="mt-3" />
            </SkeletonRegion>
          </Card>
        </div>
      </Group>

      <Group
        title="Navigacija"
        note="Putanja (telefon prikazuje samo roditelja), stranice kao pravi linkovi, koraci porudžbine."
      >
        <Breadcrumbs
          items={[
            { label: "Početna", href: "/" },
            { label: "Delovi", href: "/delovi" },
            { label: "Kočnice", href: "/delovi/kocnice" },
            { label: "Kočioni diskovi" },
          ]}
        />
        <Pagination page={6} pageCount={12} hrefFor={(page) => `/styleguide?strana=${page}`} />
        <Stepper steps={STEPS} current={1} hrefFor={() => "/styleguide#navigacija"} />
        <Tabs
          label="Podaci o delu"
          items={[
            {
              value: "opis",
              label: "Opis",
              content: (
                <p className="type-body text-ink-2">
                  Prednji ventilirani disk, par se menja zajedno sa pločicama.
                </p>
              ),
            },
            {
              value: "kompatibilnost",
              label: "Kompatibilnost",
              content: (
                <p className="type-body text-ink-2">
                  Golf VII, Octavia III, Leon III&nbsp;— proverite oznaku motora.
                </p>
              ),
            },
            {
              value: "brojevi",
              label: "Brojevi",
              content: <p className="type-code-l text-ink-1">5Q0 615 301 F · 5Q0 615 301 H</p>,
            },
            {
              value: "isporuka",
              label: "Isporuka",
              content: (
                <p className="type-body text-ink-2">Kurirska služba ili lično preuzimanje.</p>
              ),
            },
          ]}
        />
        <Tabs
          variant="segmented"
          label="Status porudžbina"
          items={[
            {
              value: "sve",
              label: "Sve",
              count: 187,
              content: <p className="type-body-s text-ink-3">Sve porudžbine, najnovije prve.</p>,
            },
            {
              value: "nove",
              label: "Nove",
              count: 3,
              content: <p className="type-body-s text-ink-3">Porudžbine koje čekaju potvrdu.</p>,
            },
            {
              value: "preuzimanje",
              label: "Za preuzimanje",
              count: 5,
              content: <p className="type-body-s text-ink-3">Spremne u radnji.</p>,
            },
            {
              value: "poslate",
              label: "Poslate",
              count: 12,
              content: <p className="type-body-s text-ink-3">Predate kurirskoj službi.</p>,
            },
          ]}
        />
      </Group>

      <Group title="Prazno stanje" note="Okvir crteža, jedna rečenica, jedna radnja.">
        <Card padding="none">
          <EmptyState
            icon={<CubeIcon size={40} />}
            title="Nema delova za ovaj filter"
            action={<Button variant="secondary">Pošaljite upit</Button>}
          >
            Tražili smo 1K0615301AA u OEM, zamenskim i kataloškim brojevima.
          </EmptyState>
        </Card>
      </Group>

      <Group
        title="Tabela (administracija, papir)"
        className="scroll-mt-24"
        id="tabela"
        note="Strelice pomeraju fokus reda, Enter otvara, razmak bira; Shift + klik bira opseg."
      >
        <div data-theme="paper" className="flex flex-col gap-4 rounded-md p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="type-body-s text-ink-2" aria-live="polite">
              {selectedCount > 0 ? `${selectedCount} izabrano` : "1–6 od 187"}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Switch label="Kompaktno" checked={compact} onCheckedChange={setCompact} />
              <Switch label="Učitavanje" checked={loading} onCheckedChange={setLoading} />
              <Switch label="Prazno" checked={empty} onCheckedChange={setEmpty} />
            </div>
          </div>
          <DataTable
            caption="Porudžbine"
            columns={columns}
            data={empty ? [] : ORDERS}
            getRowId={(row) => row.id}
            enableRowSelection
            rowSelection={selection}
            onRowSelectionChange={setSelection}
            rowLabel={(row) => `SK-2026-${row.number}`}
            onRowOpen={(row) => toast.info(`Otvaram SK-2026-${row.number}`)}
            density={compact ? "compact" : "default"}
            loading={loading}
            empty={
              <p className="py-10 text-center type-body-s text-ink-2">Nema novih porudžbina.</p>
            }
          />
        </div>
      </Group>
    </>
  );
}
