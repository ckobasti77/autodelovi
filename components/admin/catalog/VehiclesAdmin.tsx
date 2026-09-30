"use client";

/**
 * `/admin/vozila` — makes → models → generations (years, VIN model codes, platform) and the
 * engines linked to each generation; a second tab lists every engine (codes, fuel, power).
 * Edits in dialogs; every save is audited.
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type ReactNode } from "react";
import { PencilSimpleIcon, PlusIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { FUEL_LABEL } from "@/lib/i18n/sr/admin";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";

import { PageHeader, Section } from "../ui";

type Tree = FunctionReturnType<typeof api.catalog.vehiclesAdmin.tree>;
type Generation = FunctionReturnType<typeof api.catalog.vehiclesAdmin.generations>[number];
type Engine = FunctionReturnType<typeof api.catalog.vehiclesAdmin.engines>[number];

type DialogState =
  | { kind: "brand"; brand?: Tree[number] }
  | { kind: "model"; brandId: Id<"vehicleBrands">; model?: Tree[number]["models"][number] }
  | { kind: "generation"; modelId: Id<"vehicleModels">; generation?: Generation }
  | { kind: "engine"; engine?: Engine }
  | null;

function Column({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title} actions={action}>
      <div className="-mx-4 -my-2 max-h-[calc(100dvh-18rem)] overflow-y-auto">{children}</div>
    </Section>
  );
}

function RowButton({
  active,
  onClick,
  children,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex min-h-10 w-full cursor-pointer items-center gap-2 border-b border-line-faint px-4 text-left type-body-s transition-control focus-ring-inset",
        active ? "bg-selected font-semibold text-ink-1" : "text-ink-1 hover:bg-surface-2",
        muted && "text-ink-3",
      )}
    >
      {children}
    </button>
  );
}

export function VehiclesAdmin() {
  const tree = useQuery(api.catalog.vehiclesAdmin.tree, {});
  const engines = useQuery(api.catalog.vehiclesAdmin.engines, {});
  const [brandId, setBrandId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const brand = tree?.find((b) => b._id === brandId) ?? tree?.[0];
  const model = brand?.models.find((m) => m._id === modelId) ?? brand?.models[0];
  const generations = useQuery(
    api.catalog.vehiclesAdmin.generations,
    model ? { modelId: model._id } : "skip",
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Vozila"
        description="Marke, modeli, generacije i motori — osnova za izbor vozila i kompatibilnost delova."
      />
      <Tabs
        label="Vozila"
        items={[
          {
            value: "stablo",
            label: "Marke, modeli, generacije",
            content: !tree ? (
              <Skeleton className="mt-4 h-96 w-full" />
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-[220px_260px_minmax(0,1fr)]">
                <Column
                  title="Marke"
                  action={
                    <IconButton
                      label="Nova marka"
                      icon={<PlusIcon size={16} />}
                      size="sm"
                      onClick={() => setDialog({ kind: "brand" })}
                    />
                  }
                >
                  {tree.map((b) => (
                    <RowButton
                      key={b._id}
                      active={b._id === brand?._id}
                      muted={!b.active}
                      onClick={() => (setBrandId(b._id), setModelId(null))}
                    >
                      <span className="flex-1 truncate">{b.name}</span>
                      <span className="type-caption text-ink-3">{b.models.length}</span>
                    </RowButton>
                  ))}
                </Column>
                <Column
                  title={brand ? `Modeli — ${brand.name}` : "Modeli"}
                  action={
                    brand ? (
                      <span className="flex">
                        <IconButton
                          label={`Izmeni marku ${brand.name}`}
                          icon={<PencilSimpleIcon size={16} />}
                          size="sm"
                          onClick={() => setDialog({ kind: "brand", brand })}
                        />
                        <IconButton
                          label="Novi model"
                          icon={<PlusIcon size={16} />}
                          size="sm"
                          onClick={() => setDialog({ kind: "model", brandId: brand._id })}
                        />
                      </span>
                    ) : null
                  }
                >
                  {(brand?.models ?? []).map((m) => (
                    <RowButton
                      key={m._id}
                      active={m._id === model?._id}
                      muted={!m.active}
                      onClick={() => setModelId(m._id)}
                    >
                      <span className="flex-1 truncate">{m.name}</span>
                    </RowButton>
                  ))}
                </Column>
                <Section
                  title={model ? `Generacije — ${brand?.name} ${model.name}` : "Generacije"}
                  actions={
                    model && brand ? (
                      <span className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<PencilSimpleIcon size={16} />}
                          onClick={() => setDialog({ kind: "model", brandId: brand._id, model })}
                        >
                          Model
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<PlusIcon size={16} />}
                          onClick={() => setDialog({ kind: "generation", modelId: model._id })}
                        >
                          Nova generacija
                        </Button>
                      </span>
                    ) : null
                  }
                >
                  {generations === undefined ? (
                    <Skeleton className="h-60 w-full" />
                  ) : generations.length === 0 ? (
                    <p className="type-body-s text-ink-2">Model još nema generacija.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {generations.map((g) => (
                        <GenerationRow
                          key={g._id}
                          generation={g}
                          engines={engines ?? []}
                          onEdit={() =>
                            model &&
                            setDialog({ kind: "generation", modelId: model._id, generation: g })
                          }
                        />
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            ),
          },
          {
            value: "motori",
            label: `Motori${engines ? ` (${engines.length})` : ""}`,
            content: (
              <Section
                className="mt-4"
                title="Motori"
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<PlusIcon size={16} />}
                    onClick={() => setDialog({ kind: "engine" })}
                  >
                    Novi motor
                  </Button>
                }
              >
                <div className="-mx-4 overflow-x-auto">
                  <table className="w-full border-collapse text-cell">
                    <caption className="sr-only">Motori</caption>
                    <thead>
                      <tr className="border-b border-line text-left type-label uppercase text-ink-3">
                        <th scope="col" className="px-4 py-2">
                          Motor
                        </th>
                        <th scope="col" className="px-2 py-2">
                          Kodovi
                        </th>
                        <th scope="col" className="px-2 py-2">
                          Gorivo
                        </th>
                        <th scope="col" className="px-2 py-2 text-right">
                          cm³
                        </th>
                        <th scope="col" className="px-2 py-2 text-right">
                          kW / KS
                        </th>
                        <th scope="col" className="w-12 px-2 py-2">
                          <span className="sr-only">Izmeni</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(engines ?? []).map((e) => (
                        <tr key={e._id} className="border-b border-line-faint">
                          <td className="px-4 py-2 font-medium">{e.name}</td>
                          <td className="px-2 py-2 type-code-s text-ink-2">
                            {e.codes.join(", ") || "—"}
                          </td>
                          <td className="px-2 py-2 text-ink-2">{FUEL_LABEL[e.fuel]}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {e.displacementCc ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {e.powerKw} / {e.powerHp}
                          </td>
                          <td className="px-2 py-2">
                            <IconButton
                              label={`Izmeni ${e.name} ${e.powerKw} kW`}
                              icon={<PencilSimpleIcon size={16} />}
                              size="sm"
                              onClick={() => setDialog({ kind: "engine", engine: e })}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ),
          },
        ]}
      />
      {dialog ? <VehicleDialog state={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function GenerationRow({
  generation: g,
  engines,
  onEdit,
}: {
  generation: Generation;
  engines: Engine[];
  onEdit: () => void;
}) {
  const link = useMutation(api.catalog.vehiclesAdmin.linkEngine);
  const unlink = useMutation(api.catalog.vehiclesAdmin.unlinkEngine);
  const [adding, setAdding] = useState("");
  const linked = new Set(g.engines.map((e) => e.engineId));
  return (
    <li className="rounded-sm border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-faint bg-surface-2 px-3 py-2">
        <span className={cn("font-semibold", !g.active && "text-ink-3 line-through")}>
          {g.name}
        </span>
        {g.code ? <span className="type-code-s text-ink-2">{g.code}</span> : null}
        <span className="type-body-s tabular-nums text-ink-2">
          {g.yearFrom}–{g.yearTo ?? "danas"}
        </span>
        {g.platform ? <Badge tone="outline">{g.platform}</Badge> : null}
        {g.vinModelCodes.length ? (
          <span className="type-caption text-ink-3">
            VIN: <span className="type-code-s">{g.vinModelCodes.join(", ")}</span>
          </span>
        ) : null}
        <IconButton
          label={`Izmeni generaciju ${g.name}`}
          icon={<PencilSimpleIcon size={16} />}
          size="sm"
          className="ml-auto"
          onClick={onEdit}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {g.engines.length === 0 ? (
          <span className="type-caption text-ink-3">Nema povezanih motora.</span>
        ) : null}
        {g.engines.map((e) => (
          <span
            key={e.linkId}
            className="inline-flex h-7 items-center gap-1 rounded-xs border border-line bg-surface-1 pl-2 type-caption"
          >
            {e.name} · {e.powerKw} kW
            <button
              type="button"
              aria-label={`Ukloni motor ${e.name} ${e.powerKw} kW iz ${g.name}`}
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-xs text-ink-3 hover:bg-surface-2 hover:text-danger focus-ring-inset"
              onClick={() =>
                void unlink({ linkId: e.linkId }).catch((err) =>
                  toast.error(convexErrorMessage(err, "Motor nije uklonjen.")),
                )
              }
            >
              <XIcon size={12} />
            </button>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <Select
            size="sm"
            aria-label={`Dodaj motor u ${g.name}`}
            placeholder="Dodaj motor…"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            options={engines
              .filter((e) => !linked.has(e._id))
              .map((e) => ({
                value: e._id,
                label: `${e.name} · ${e.powerKw} kW · ${FUEL_LABEL[e.fuel]}`,
              }))}
            className="w-60"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!adding}
            onClick={() =>
              void link({ generationId: g._id, engineId: adding as Id<"engines"> }).then(
                () => setAdding(""),
                (err) => toast.error(convexErrorMessage(err, "Motor nije dodat.")),
              )
            }
          >
            Dodaj
          </Button>
        </span>
      </div>
    </li>
  );
}

function VehicleDialog({
  state,
  onClose,
}: {
  state: NonNullable<DialogState>;
  onClose: () => void;
}) {
  const saveBrand = useMutation(api.catalog.vehiclesAdmin.saveBrand);
  const saveModel = useMutation(api.catalog.vehiclesAdmin.saveModel);
  const saveGeneration = useMutation(api.catalog.vehiclesAdmin.saveGeneration);
  const saveEngine = useMutation(api.catalog.vehiclesAdmin.saveEngine);
  const b = state.kind === "brand" ? state.brand : undefined;
  const m = state.kind === "model" ? state.model : undefined;
  const g = state.kind === "generation" ? state.generation : undefined;
  const e = state.kind === "engine" ? state.engine : undefined;
  const [f, setF] = useState({
    name: b?.name ?? m?.name ?? g?.name ?? e?.name ?? "",
    active: b?.active ?? m?.active ?? g?.active ?? true,
    wmi: b?.wmi.join(", ") ?? "",
    aliases: (b?.aliases ?? m?.aliases ?? g?.aliases ?? []).join(", "),
    code: g?.code ?? "",
    yearFrom: g ? String(g.yearFrom) : "",
    yearTo: g?.yearTo ? String(g.yearTo) : "",
    platform: g?.platform ?? "",
    vinModelCodes: g?.vinModelCodes.join(", ") ?? "",
    codes: e?.codes.join(", ") ?? "",
    fuel: e?.fuel ?? "dizel",
    displacementCc: e?.displacementCc ? String(e.displacementCc) : "",
    powerKw: e ? String(e.powerKw) : "",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const title = {
    brand: b ? `Marka ${b.name}` : "Nova marka",
    model: m ? `Model ${m.name}` : "Novi model",
    generation: g ? `Generacija ${g.name}` : "Nova generacija",
    engine: e ? `Motor ${e.name}` : "Novi motor",
  }[state.kind];

  const submit = async () => {
    setBusy(true);
    try {
      if (state.kind === "brand")
        await saveBrand({
          ...(b ? { brandId: b._id } : {}),
          name: f.name,
          wmi: f.wmi,
          aliases: f.aliases,
          active: f.active,
        });
      if (state.kind === "model")
        await saveModel({
          ...(m ? { modelId: m._id } : {}),
          brandId: state.brandId,
          name: f.name,
          aliases: f.aliases,
          active: f.active,
        });
      if (state.kind === "generation")
        await saveGeneration({
          ...(g ? { generationId: g._id } : {}),
          modelId: state.modelId,
          name: f.name,
          code: f.code,
          yearFrom: Number(f.yearFrom),
          ...(f.yearTo.trim() ? { yearTo: Number(f.yearTo) } : {}),
          platform: f.platform,
          vinModelCodes: f.vinModelCodes,
          aliases: f.aliases,
          active: f.active,
        });
      if (state.kind === "engine")
        await saveEngine({
          ...(e ? { engineId: e._id } : {}),
          name: f.name,
          codes: f.codes,
          fuel: f.fuel as Engine["fuel"],
          ...(f.displacementCc.trim() ? { displacementCc: Number(f.displacementCc) } : {}),
          powerKw: Number(f.powerKw),
        });
      toast.success("Sačuvano.");
      onClose();
    } catch (err) {
      toast.error(convexErrorMessage(err, "Nije sačuvano."));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Odustani
          </Button>
          <Button loading={busy} onClick={() => void submit()} disabled={!f.name.trim()}>
            Sačuvaj
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Naziv" className="sm:col-span-2">
          <Input
            value={f.name}
            onChange={(ev) => set({ name: ev.target.value })}
            autoFocus
            placeholder={state.kind === "engine" ? "npr. 2.0 TDI" : undefined}
          />
        </Field>
        {state.kind === "brand" ? (
          <Field
            label="WMI kodovi (VIN, prva 3 znaka)"
            help="Razdvojte zarezom: WVW, WVG"
            className="sm:col-span-2"
          >
            <Input
              value={f.wmi}
              onChange={(ev) => set({ wmi: ev.target.value })}
              inputClassName="font-mono"
            />
          </Field>
        ) : null}
        {state.kind === "generation" ? (
          <>
            <Field label="Kod generacije" optional>
              <Input
                value={f.code}
                onChange={(ev) => set({ code: ev.target.value })}
                placeholder="npr. 5G, 1K"
                inputClassName="font-mono"
              />
            </Field>
            <Field label="Platforma" optional>
              <Input
                value={f.platform}
                onChange={(ev) => set({ platform: ev.target.value })}
                placeholder="npr. MQB"
              />
            </Field>
            <Field label="Od godine">
              <Input
                value={f.yearFrom}
                onChange={(ev) => set({ yearFrom: ev.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Do godine" optional help="Prazno: proizvodi se i danas.">
              <Input
                value={f.yearTo}
                onChange={(ev) => set({ yearTo: ev.target.value })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Kodovi modela u VIN-u (pozicije 7–8)" optional className="sm:col-span-2">
              <Input
                value={f.vinModelCodes}
                onChange={(ev) => set({ vinModelCodes: ev.target.value })}
                placeholder="npr. AU, 5G"
                inputClassName="font-mono"
              />
            </Field>
          </>
        ) : null}
        {state.kind === "engine" ? (
          <>
            <Field
              label="Kodovi motora"
              optional
              help="Razdvojte zarezom: CFFB, CRLB"
              className="sm:col-span-2"
            >
              <Input
                value={f.codes}
                onChange={(ev) => set({ codes: ev.target.value })}
                inputClassName="font-mono"
              />
            </Field>
            <Field label="Gorivo">
              <Select
                value={f.fuel}
                onChange={(ev) => set({ fuel: ev.target.value as Engine["fuel"] })}
                options={Object.entries(FUEL_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Zapremina" optional>
              <Input
                value={f.displacementCc}
                onChange={(ev) => set({ displacementCc: ev.target.value })}
                inputMode="numeric"
                suffix="cm³"
              />
            </Field>
            <Field
              label="Snaga"
              help={
                f.powerKw && Number(f.powerKw) > 0
                  ? `≈ ${Math.round(Number(f.powerKw) * 1.35962)} KS`
                  : undefined
              }
            >
              <Input
                value={f.powerKw}
                onChange={(ev) => set({ powerKw: ev.target.value })}
                inputMode="numeric"
                suffix="kW"
              />
            </Field>
          </>
        ) : null}
        {state.kind !== "engine" ? (
          <>
            <Field
              label="Drugi nazivi"
              optional
              help="Za pretragu i uvoz: npr. „Golf 7, Golf VII“"
              className="sm:col-span-2"
            >
              <Input value={f.aliases} onChange={(ev) => set({ aliases: ev.target.value })} />
            </Field>
            <Switch
              label="Vidljivo na sajtu"
              checked={f.active}
              onCheckedChange={(v) => set({ active: v })}
              className="sm:col-span-2"
            />
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
