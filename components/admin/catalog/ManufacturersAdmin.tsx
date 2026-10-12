"use client";

/** `/admin/proizvodjaci` — makers with product counts; create / edit (aliases feed the import). */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { foldForSearch } from "@/lib/domain/search";
import { QUALITY_LABEL } from "@/lib/i18n/sr/catalog";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/ui/Toast";

import { PageHeader, SearchField } from "../ui";

type Row = FunctionReturnType<typeof api.catalog.manufacturersAdmin.list>[number];

export function ManufacturersAdmin() {
  const rows = useQuery(api.catalog.manufacturersAdmin.list, {});
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const shown = useMemo(() => {
    const t = foldForSearch(q);
    return (rows ?? []).filter(
      (r) => !t || foldForSearch(`${r.name} ${r.aliases.join(" ")}`).includes(t),
    );
  }, [rows, q]);
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Proizvođač",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span
              className={row.original.active ? "font-medium text-ink-1" : "text-ink-3 line-through"}
            >
              {row.original.name}
            </span>
            {row.original.isVagGenuine ? (
              <Badge size="text" tone="info">
                Original VAG
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "defaultQuality",
        header: "Kvalitet",
        cell: ({ row }) => (
          <span className="text-ink-2">{QUALITY_LABEL[row.original.defaultQuality]}</span>
        ),
      },
      {
        id: "aliases",
        header: "Drugi nazivi",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="max-w-[20rem] truncate text-ink-3">
            {row.original.aliases.join(", ") || "—"}
          </span>
        ),
      },
      {
        accessorKey: "country",
        header: "Zemlja",
        cell: ({ row }) => <span className="text-ink-2">{row.original.country ?? "—"}</span>,
      },
      { accessorKey: "productCount", header: "Artikala", meta: { align: "right" } },
    ],
    [],
  );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Proizvođači"
        description="Proizvođači delova. Drugi nazivi pomažu da uvoz iz Excela prepozna „LUK“, „LuK GmbH“ i slično."
        actions={
          <Button icon={<PlusIcon size={18} />} onClick={() => setEditing("new")}>
            Novi proizvođač
          </Button>
        }
      />
      <SearchField
        value={q}
        onChange={setQ}
        label="Pretraga proizvođača"
        placeholder="Naziv ili drugi naziv…"
      />
      <DataTable
        caption="Proizvođači"
        columns={columns}
        data={shown}
        getRowId={(r) => r._id}
        loading={rows === undefined}
        onRowOpen={(r) => setEditing(r)}
        empty={
          <p className="py-10 text-center type-body-s text-ink-2">
            Nema proizvođača za ovu pretragu.
          </p>
        }
      />
      {editing ? (
        <ManufacturerDialog
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ManufacturerDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const save = useMutation(api.catalog.manufacturersAdmin.save);
  const [f, setF] = useState({
    name: row?.name ?? "",
    aliases: row?.aliases.join(", ") ?? "",
    isVagGenuine: row?.isVagGenuine ?? false,
    defaultQuality: row?.defaultQuality ?? ("aftermarket" as Row["defaultQuality"]),
    country: row?.country ?? "",
    active: row?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={row ? row.name : "Novi proizvođač"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Odustani
          </Button>
          <Button
            loading={busy}
            disabled={f.name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                await save({
                  ...(row ? { manufacturerId: row._id } : {}),
                  name: f.name,
                  aliases: f.aliases
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                  isVagGenuine: f.isVagGenuine,
                  defaultQuality: f.defaultQuality,
                  ...(f.country.trim() ? { country: f.country } : {}),
                  active: f.active,
                });
                toast.success("Sačuvano.");
                onClose();
              } catch (err) {
                toast.error(convexErrorMessage(err, "Nije sačuvano."));
                setBusy(false);
              }
            }}
          >
            Sačuvaj
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Naziv">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Drugi nazivi" help="Razdvojte zarezom.">
          <Input value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Podrazumevani kvalitet">
            <Select
              value={f.defaultQuality}
              onChange={(e) =>
                setF({ ...f, defaultQuality: e.target.value as Row["defaultQuality"] })
              }
              options={Object.entries(QUALITY_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Zemlja">
            <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
          </Field>
        </div>
        <Switch
          label="Originalni VAG delovi"
          checked={f.isVagGenuine}
          onCheckedChange={(v) => setF({ ...f, isVagGenuine: v })}
        />
        <Switch
          label="Aktivan"
          checked={f.active}
          onCheckedChange={(v) => setF({ ...f, active: v })}
        />
      </div>
    </Dialog>
  );
}
